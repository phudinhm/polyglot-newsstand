import type { SourceLang, TargetLang } from "../types";

const LANG_NAME: Record<SourceLang | TargetLang, string> = {
  de: "German",
  en: "English",
  vi: "Vietnamese",
};

/** Shared instruction for every LLM-backed provider below. */
function translationPrompt(texts: string[], source: SourceLang, target: TargetLang): string {
  const numbered = texts.map((t, i) => `${i + 1}. ${t}`).join("\n");
  return (
    `Translate each numbered ${LANG_NAME[source]} sentence below into ${LANG_NAME[target]}. ` +
    `Return exactly ${texts.length} translation${texts.length === 1 ? "" : "s"}, one per input, in the ` +
    `same order, with nothing added or omitted and no numbering in the output.\n\n${numbered}`
  );
}

export interface Provider {
  name: string;
  /** Cheap check so we can skip unconfigured providers without a network call. */
  isConfigured(): boolean;
  translate(texts: string[], source: SourceLang, target: TargetLang): Promise<string[]>;
}

async function postJson(url: string, body: unknown, headers: Record<string, string> = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`${res.status} ${detail.slice(0, 200)}`);
    }
    return (await res.json()) as unknown;
  } finally {
    clearTimeout(timer);
  }
}

/** DeepL: the strongest option for German, and the one worth a key. */
export const deepl: Provider = {
  name: "deepl",
  isConfigured: () => Boolean(process.env.DEEPL_API_KEY),
  async translate(texts, source, target) {
    const key = process.env.DEEPL_API_KEY!;
    // Free-tier keys carry a ":fx" suffix and live on a different host.
    const host = key.endsWith(":fx") ? "https://api-free.deepl.com" : "https://api.deepl.com";
    const json = (await postJson(
      `${host}/v2/translate`,
      {
        text: texts,
        source_lang: source.toUpperCase(),
        target_lang: target === "en" ? "EN-US" : target.toUpperCase(),
        preserve_formatting: true,
      },
      { authorization: `DeepL-Auth-Key ${key}` },
    )) as { translations?: { text: string }[] };
    const out = json.translations?.map((t) => t.text);
    if (!out || out.length !== texts.length) throw new Error("DeepL returned an unexpected shape");
    return out;
  },
};

/** Google Cloud Translation v2: widest coverage, reliable Vietnamese. */
export const google: Provider = {
  name: "google",
  isConfigured: () => Boolean(process.env.GOOGLE_TRANSLATE_API_KEY),
  async translate(texts, source, target) {
    const key = process.env.GOOGLE_TRANSLATE_API_KEY!;
    const json = (await postJson(
      `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(key)}`,
      { q: texts, source, target, format: "text" },
    )) as { data?: { translations?: { translatedText: string }[] } };
    const out = json.data?.translations?.map((t) => decodeEntities(t.translatedText));
    if (!out || out.length !== texts.length) throw new Error("Google returned an unexpected shape");
    return out;
  },
};

/** LibreTranslate: self-hostable, so nothing leaves your own infrastructure. */
export const libre: Provider = {
  name: "libretranslate",
  isConfigured: () => Boolean(process.env.LIBRETRANSLATE_URL),
  async translate(texts, source, target) {
    const base = process.env.LIBRETRANSLATE_URL!.replace(/\/$/, "");
    const json = (await postJson(`${base}/translate`, {
      q: texts,
      source,
      target,
      format: "text",
      ...(process.env.LIBRETRANSLATE_API_KEY ? { api_key: process.env.LIBRETRANSLATE_API_KEY } : {}),
    })) as { translatedText?: string | string[] };
    const raw = json.translatedText;
    const out = Array.isArray(raw) ? raw : raw ? [raw] : undefined;
    if (!out || out.length !== texts.length) throw new Error("LibreTranslate returned an unexpected shape");
    return out;
  },
};

/** Google Gemini: strong quality, and a generous free tier once you have a key. */
export const gemini: Provider = {
  name: "gemini",
  isConfigured: () => Boolean(process.env.GEMINI_API_KEY),
  async translate(texts, source, target) {
    const key = process.env.GEMINI_API_KEY!;
    const json = (await postJson(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(key)}`,
      {
        contents: [{ parts: [{ text: translationPrompt(texts, source, target) }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: { type: "ARRAY", items: { type: "STRING" } },
        },
      },
    )) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const raw = json.candidates?.[0]?.content?.parts?.[0]?.text;
    let parsed: unknown;
    try {
      parsed = raw ? JSON.parse(raw) : undefined;
    } catch {
      throw new Error("Gemini returned invalid JSON");
    }
    if (!Array.isArray(parsed) || parsed.length !== texts.length) {
      throw new Error("Gemini returned an unexpected shape");
    }
    return parsed.map((t) => String(t));
  },
};

/**
 * Chat-completion providers (Groq, DeepSeek) speak the same OpenAI-style
 * protocol, so one helper drives both - only the endpoint, model and key differ.
 */
async function chatJsonTranslate(
  url: string,
  model: string,
  apiKey: string,
  texts: string[],
  source: SourceLang,
  target: TargetLang,
  label: string,
): Promise<string[]> {
  const json = (await postJson(
    url,
    {
      model,
      messages: [
        {
          role: "user",
          content:
            `${translationPrompt(texts, source, target)}\n\n` +
            `Reply with only a JSON object of the exact shape {"translations": ["...", ...]}, ` +
            `${texts.length} items long, and no other text.`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
    },
    { authorization: `Bearer ${apiKey}` },
  )) as { choices?: { message?: { content?: string } }[] };
  const raw = json.choices?.[0]?.message?.content;
  let parsed: unknown;
  try {
    parsed = raw ? JSON.parse(raw) : undefined;
  } catch {
    throw new Error(`${label} returned invalid JSON`);
  }
  const out = (parsed as { translations?: unknown } | undefined)?.translations;
  if (!Array.isArray(out) || out.length !== texts.length) {
    throw new Error(`${label} returned an unexpected shape`);
  }
  return out.map((t) => String(t));
}

/** Groq: an OpenAI-compatible endpoint, and the fastest response time of any provider here. */
export const groq: Provider = {
  name: "groq",
  isConfigured: () => Boolean(process.env.GROQ_API_KEY),
  translate: (texts, source, target) =>
    chatJsonTranslate(
      "https://api.groq.com/openai/v1/chat/completions",
      "llama-3.3-70b-versatile",
      process.env.GROQ_API_KEY!,
      texts,
      source,
      target,
      "Groq",
    ),
};

/** DeepSeek: also OpenAI-compatible. Needs a funded account, so it fails closed, not open, when the balance runs out. */
export const deepseek: Provider = {
  name: "deepseek",
  isConfigured: () => Boolean(process.env.DEEPSEEK_API_KEY),
  translate: (texts, source, target) =>
    chatJsonTranslate(
      "https://api.deepseek.com/chat/completions",
      "deepseek-chat",
      process.env.DEEPSEEK_API_KEY!,
      texts,
      source,
      target,
      "DeepSeek",
    ),
};

/**
 * MyMemory: no key, no signup, modest daily quota. This is what makes the app
 * work the moment you clone it, and what you outgrow once you add a real key.
 */
export const mymemory: Provider = {
  name: "mymemory",
  isConfigured: () => true,
  async translate(texts, source, target) {
    const email = process.env.MYMEMORY_EMAIL;
    const results: string[] = new Array(texts.length);
    const CONCURRENCY = 4;

    // A 429 here is usually the free tier's burst limit, not the daily word
    // quota (that one comes back as a 200 with a warning string instead), so
    // a couple of short, jittered waits recover a request that just landed
    // in a crowded second rather than one that is genuinely out for the day.
    async function fetchOnce(params: URLSearchParams, attempt: number): Promise<Response> {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15_000);
      try {
        const res = await fetch(`https://api.mymemory.translated.net/get?${params}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (res.status === 429 && attempt < 2) {
          const wait = 500 * 2 ** attempt + Math.random() * 300;
          await new Promise((r) => setTimeout(r, wait));
          return fetchOnce(params, attempt + 1);
        }
        return res;
      } finally {
        clearTimeout(timer);
      }
    }

    async function one(index: number): Promise<void> {
      const text = texts[index];
      // The endpoint rejects long strings, so send a trimmed request and
      // return the original rather than an error if it is oversized.
      if (text.length > 480) {
        results[index] = "";
        return;
      }
      const params = new URLSearchParams({ q: text, langpair: `${source}|${target}` });
      if (email) params.set("de", email);
      const res = await fetchOnce(params, 0);
      if (!res.ok) throw new Error(`${res.status}`);
      const json = (await res.json()) as {
        responseData?: { translatedText?: string };
        responseStatus?: number | string;
      };
      const status = Number(json.responseStatus);
      if (status && status !== 200) throw new Error(`MyMemory status ${status}`);
      results[index] = decodeEntities(json.responseData?.translatedText ?? "");
    }

    for (let i = 0; i < texts.length; i += CONCURRENCY) {
      await Promise.all(
        texts.slice(i, i + CONCURRENCY).map((_, offset) => one(i + offset)),
      );
    }
    if (results.every((r) => !r)) throw new Error("MyMemory returned nothing usable");
    return results;
  },
};

function decodeEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}
