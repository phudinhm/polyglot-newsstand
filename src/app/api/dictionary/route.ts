import { NextResponse } from "next/server";
import { TtlCache } from "@/lib/cache";
import { lookup, type DictionaryEntry } from "@/lib/dictionary";
import { callerKey, rateLimit } from "@/lib/ratelimit";
import { translate } from "@/lib/translate";
import type { SourceLang, TargetLang } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A word's grammar does not change, so this can be cached for a long time.
const cache = new TtlCache<DictionaryEntry & { translation?: string }>(24 * 60 * 60 * 1000, 3_000);

/**
 * Word lookup, with the grammar a learner needs rather than a bare gloss.
 *
 * Wiktionary supplies the article, the plural and the pronunciation; the
 * translation chain fills in a meaning in the reader's own language, and
 * stands in entirely when the dictionary has never heard of the word.
 */
export async function GET(req: Request) {
  const limit = rateLimit(callerKey(req), { capacity: 120, refillPerMinute: 120 });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Slow down a moment: too many lookups." },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
    );
  }

  const params = new URL(req.url).searchParams;
  const word = (params.get("word") ?? "").trim();
  const langParam = params.get("lang");
  const lang: SourceLang = langParam === "en" ? "en" : langParam === "vi" ? "vi" : "de";
  const target: TargetLang = params.get("target") === "vi" ? "vi" : "en";

  if (!word) return NextResponse.json({ error: "Missing ?word" }, { status: 400 });
  if (word.length > 60) return NextResponse.json({ error: "That is not a word." }, { status: 400 });

  const key = `${lang}>${target}:${word.toLowerCase()}`;
  const cached = cache.get(key);
  if (cached) return NextResponse.json(cached);

  // The dictionary and the translation are independent, so fetch together.
  const [entry, translated] = await Promise.all([
    lookup(word, lang).catch(() => null),
    lang === target
      ? Promise.resolve(null)
      : translate([word], lang, target)
          .then((r) => r.translations[0] || null)
          .catch(() => null),
  ]);

  if (!entry && !translated) {
    return NextResponse.json(
      { error: "No dictionary entry and no translation for that word." },
      { status: 404 },
    );
  }

  const body: DictionaryEntry & { translation?: string } = entry
    ? { ...entry, translation: translated ?? undefined }
    : {
        word,
        senses: [],
        source: "translation",
        translation: translated ?? undefined,
      };

  cache.set(key, body);
  return NextResponse.json(body, {
    headers: { "cache-control": "public, s-maxage=86400, stale-while-revalidate=604800" },
  });
}
