import { NextResponse } from "next/server";
import { callerKey, rateLimit } from "@/lib/ratelimit";
import { configuredProviders, translate } from "@/lib/translate";
import type { SourceLang, TargetLang } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TEXTS = 40;
const MAX_CHARS = 6_000;

export async function GET() {
  // Lets the settings panel say which provider is actually live.
  return NextResponse.json({ providers: configuredProviders() });
}

export async function POST(req: Request) {
  const limit = rateLimit(callerKey(req), { capacity: 90, refillPerMinute: 90 });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Slow down a moment: too many translation requests." },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
    );
  }

  let body: { texts?: unknown; source?: unknown; target?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const texts = Array.isArray(body.texts)
    ? body.texts.filter((t): t is string => typeof t === "string")
    : [];
  const source: SourceLang = body.source === "en" ? "en" : "de";
  const target: TargetLang = body.target === "vi" ? "vi" : "en";

  if (!texts.length) {
    return NextResponse.json({ error: "Nothing to translate." }, { status: 400 });
  }
  if (texts.length > MAX_TEXTS) {
    return NextResponse.json(
      { error: `Send at most ${MAX_TEXTS} strings per request.` },
      { status: 400 },
    );
  }
  const totalChars = texts.reduce((sum, t) => sum + t.length, 0);
  if (totalChars > MAX_CHARS) {
    return NextResponse.json(
      { error: `Send at most ${MAX_CHARS} characters per request.` },
      { status: 400 },
    );
  }

  try {
    const result = await translate(texts, source, target);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Translation failed." },
      { status: 502 },
    );
  }
}
