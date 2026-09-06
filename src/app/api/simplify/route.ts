import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { TtlCache } from "@/lib/cache";
import { callerKey, rateLimit } from "@/lib/ratelimit";
import type { SourceLang } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** CEFR levels worth offering. Below A2 a news article stops being news. */
const LEVELS = ["A2", "B1", "B2"] as const;
type Level = (typeof LEVELS)[number];

const LEVEL_GUIDANCE: Record<Level, string> = {
  A2: "Very short sentences, one idea each. Only the most common vocabulary. Avoid the passive, avoid subordinate clauses, avoid the genitive. Explain any term a beginner could not know in a short clause.",
  B1: "Short to medium sentences. Everyday vocabulary. At most one subordinate clause per sentence. Keep specialist terms but gloss them briefly the first time.",
  B2: "Normal sentence length but no nested clauses. Keep most vocabulary, simplify only rare or figurative wording. Keep specialist terms as they are.",
};

const LANGUAGE_NAME: Record<SourceLang, string> = {
  de: "German",
  en: "English",
  vi: "Vietnamese",
};

const MAX_CHARS = 14_000;
// Rewriting the same article at the same level twice should not be paid for twice.
const cache = new TtlCache<{ paragraphs: string[] }>(6 * 60 * 60 * 1000, 300);

/** Route files may only export handlers and config, so this stays local. */
function isConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function GET() {
  // Lets the reader's UI hide the control rather than offer a dead button.
  return NextResponse.json({ available: isConfigured(), levels: LEVELS });
}

export async function POST(req: Request) {
  if (!isConfigured()) {
    return NextResponse.json(
      {
        error:
          "Text levelling needs an ANTHROPIC_API_KEY on the server. Without it the original article is all there is.",
      },
      { status: 501 },
    );
  }

  // Rewriting an article costs real money, so this is tighter than the rest.
  const limit = rateLimit(callerKey(req), { capacity: 12, refillPerMinute: 12 });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "That is a lot of rewriting. Give it a minute." },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
    );
  }

  let body: { paragraphs?: unknown; lang?: unknown; level?: unknown; title?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const paragraphs = Array.isArray(body.paragraphs)
    ? body.paragraphs.filter((p): p is string => typeof p === "string" && p.trim().length > 0)
    : [];
  const lang: SourceLang = body.lang === "en" ? "en" : body.lang === "vi" ? "vi" : "de";
  const level: Level = LEVELS.includes(body.level as Level) ? (body.level as Level) : "B1";
  const title = typeof body.title === "string" ? body.title.slice(0, 300) : "";

  if (!paragraphs.length) {
    return NextResponse.json({ error: "Nothing to simplify." }, { status: 400 });
  }

  const totalChars = paragraphs.reduce((sum, p) => sum + p.length, 0);
  if (totalChars > MAX_CHARS) {
    return NextResponse.json(
      { error: `This article is too long to rewrite in one go (${totalChars} characters).` },
      { status: 413 },
    );
  }

  const key = `${lang}:${level}:${title}:${totalChars}:${paragraphs[0].slice(0, 120)}`;
  const cached = cache.get(key);
  if (cached) return NextResponse.json({ ...cached, cached: true });

  const client = new Anthropic();
  const language = LANGUAGE_NAME[lang];

  const system = `You rewrite news articles at a lower CEFR level for language learners, in ${language}.

Rules, in order of importance:
1. Never change a fact. Numbers, dates, names, quotes and attributions stay exactly as they are. If you cannot simplify something without risking its accuracy, leave it as it is.
2. Write in ${language}. Do not translate.
3. Target level ${level}. ${LEVEL_GUIDANCE[level]}
4. Return the same number of paragraphs, in the same order, covering the same ground. Do not merge, split, add or drop paragraphs.
5. No preamble, no notes, no markdown. Just the rewritten paragraphs.`;

  try {
    // Streaming because a long article plus a generous max_tokens can outrun
    // the default HTTP timeout.
    const stream = client.messages.stream({
      // Sonnet at medium effort: rewriting to a level is a constrained task,
      // and this keeps a per-article rewrite cheap enough to use freely.
      model: "claude-sonnet-5",
      max_tokens: 16000,
      system,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "medium",
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              paragraphs: {
                type: "array",
                items: { type: "string" },
                description: "The rewritten paragraphs, same count and order as the input.",
              },
            },
            required: ["paragraphs"],
            additionalProperties: false,
          },
        },
      },
      messages: [
        {
          role: "user",
          content: `${title ? `Headline: ${title}\n\n` : ""}Rewrite these ${paragraphs.length} paragraphs at ${level}.\n\n${paragraphs
            .map((p, i) => `[${i + 1}] ${p}`)
            .join("\n\n")}`,
        },
      ],
    });

    const message = await stream.finalMessage();
    const text = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    const parsed = JSON.parse(text) as { paragraphs?: unknown };
    const out = Array.isArray(parsed.paragraphs)
      ? parsed.paragraphs.filter((p): p is string => typeof p === "string")
      : [];

    if (!out.length) {
      return NextResponse.json({ error: "The rewrite came back empty." }, { status: 502 });
    }

    const result = { paragraphs: out };
    cache.set(key, result);
    return NextResponse.json({ ...result, level, cached: false });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "The model is rate limited right now. Try again shortly." },
        { status: 429 },
      );
    }
    if (err instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { error: "The server's ANTHROPIC_API_KEY was rejected." },
        { status: 502 },
      );
    }
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json({ error: `The model call failed (${err.status}).` }, { status: 502 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not rewrite the article." },
      { status: 502 },
    );
  }
}
