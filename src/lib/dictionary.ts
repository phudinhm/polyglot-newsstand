import { fetchText } from "./fetcher";
import type { SourceLang } from "./types";

/**
 * A real dictionary entry, not a one-word translation.
 *
 * Wiktionary is the only free source with the grammar a German learner
 * actually needs: the article that goes with a noun, its plural, and how the
 * word is pronounced. It is served as wikitext built from strict templates,
 * which is far more reliable to read than the rendered page.
 */

export interface DictionarySense {
  partOfSpeech: string;
  definitions: string[];
}

export interface DictionaryEntry {
  word: string;
  /** The dictionary form, when the word in the text was inflected. */
  lemma?: string;
  /** How the word in the text relates to its lemma, in plain words. */
  inflectionNote?: string;
  ipa?: string;
  /** "der", "die" or "das", for German nouns only. */
  article?: string;
  singular?: string;
  plural?: string;
  senses: DictionarySense[];
  source: "wiktionary" | "translation";
  /** Wiktionary page for the word, so the reader can go deeper. */
  url?: string;
}

const WIKI_HOST: Record<SourceLang, string> = {
  de: "de.wiktionary.org",
  en: "en.wiktionary.org",
  vi: "vi.wiktionary.org",
};

const GENDER_ARTICLE: Record<string, string> = { m: "der", f: "die", n: "das" };

async function rawWikitext(host: string, word: string): Promise<string | null> {
  const url = `https://${host}/w/index.php?title=${encodeURIComponent(word)}&action=raw`;
  try {
    return await fetchText(url, { timeoutMs: 7_000, accept: "text/plain, */*" });
  } catch {
    return null;
  }
}

/** {{Wortart|Substantiv|Deutsch}} and friends. */
function partsOfSpeech(wikitext: string): string[] {
  const found = new Set<string>();
  for (const m of wikitext.matchAll(/\{\{Wortart\|([^|}]+)\|/g)) found.add(m[1].trim());
  // English Wiktionary uses plain headings instead of templates.
  for (const m of wikitext.matchAll(/^===+\s*(Noun|Verb|Adjective|Adverb|Pronoun|Preposition|Conjunction|Interjection|Numeral|Article)\s*===+/gim)) {
    found.add(m[1]);
  }
  return [...found];
}

function firstMatch(wikitext: string, re: RegExp): string | undefined {
  const m = re.exec(wikitext);
  return m?.[1]?.trim() || undefined;
}

/**
 * German Wiktionary gives an inflected form its own page, which points at the
 * dictionary form. Following that is what turns "Wörtern" into "das Wort,
 * plural Wörter" instead of a dead end.
 */
function lemmaFromInflection(wikitext: string): { lemma: string; note?: string } | null {
  if (!/Grammatische Merkmale|Deklinierte Form|Konjugierte Form/.test(wikitext)) return null;
  const line = /\*\s*([^\n*]*?)\s*(?:des|der|von)\s+(?:Substantivs?|Adjektivs?|Verbs?|Wortes)?\s*'''\[\[([^\]]+)\]\]'''/.exec(
    wikitext,
  );
  if (line) return { lemma: line[2].trim(), note: line[1].trim() || undefined };
  const bare = /'''\[\[([^\]]+)\]\]'''/.exec(wikitext);
  return bare ? { lemma: bare[1].trim() } : null;
}

function cleanWikiMarkup(text: string): string {
  return text
    .replace(/\{\{[^}]*\}\}/g, "")
    .replace(/\[\[([^|\]]+\|)?([^\]]+)\]\]/g, "$2")
    .replace(/'''?/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** The "Bedeutungen" block, which is the definition list on every page. */
function meanings(wikitext: string): string[] {
  const section = /\{\{Bedeutungen\}\}([\s\S]*?)(?:\n\{\{|\n===|$)/.exec(wikitext);
  if (!section) return [];
  return section[1]
    .split("\n")
    .map((line) => cleanWikiMarkup(line.replace(/^:?\[\d+[a-z]?\]\s*/, "")))
    .filter((line) => line.length > 2)
    .slice(0, 5);
}

function parseGerman(word: string, wikitext: string): Omit<DictionaryEntry, "source"> {
  const genus = firstMatch(wikitext, /\|Genus=([mfn])/) ?? firstMatch(wikitext, /\{\{([mfn])\}\}/);
  const pos = partsOfSpeech(wikitext);
  const defs = meanings(wikitext);

  return {
    word,
    ipa: firstMatch(wikitext, /\{\{Lautschrift\|([^}|]+)\}\}/),
    article: genus ? GENDER_ARTICLE[genus] : undefined,
    singular: firstMatch(wikitext, /\|Nominativ Singular\s*=\s*([^\n|}]+)/),
    plural: firstMatch(wikitext, /\|Nominativ Plural\s*=\s*([^\n|}]+)/),
    senses: pos.length
      ? pos.map((p, i) => ({ partOfSpeech: p, definitions: i === 0 ? defs : [] }))
      : defs.length
        ? [{ partOfSpeech: "", definitions: defs }]
        : [],
  };
}

/**
 * English Wiktionary's REST endpoint returns clean definitions grouped by
 * language, which is exactly what a learner wants: German word, English gloss.
 */
async function englishGlosses(word: string, lang: SourceLang): Promise<DictionarySense[]> {
  try {
    const body = await fetchText(
      `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`,
      { timeoutMs: 7_000, accept: "application/json" },
    );
    const json = JSON.parse(body) as Record<
      string,
      { partOfSpeech: string; definitions: { definition: string }[] }[]
    >;
    const entries = json[lang] ?? [];
    return entries
      .map((entry) => ({
        partOfSpeech: entry.partOfSpeech,
        definitions: entry.definitions
          .map((d) => cleanWikiMarkup(d.definition))
          .filter(Boolean)
          .slice(0, 4),
      }))
      .filter((s) => s.definitions.length)
      .slice(0, 4);
  } catch {
    return [];
  }
}

export async function lookup(word: string, lang: SourceLang): Promise<DictionaryEntry | null> {
  const trimmed = word.trim();
  if (!trimmed || trimmed.length > 60) return null;

  const host = WIKI_HOST[lang];
  // German nouns are capitalised, and the text may hand us either form.
  const variants =
    lang === "de"
      ? [trimmed, trimmed[0].toUpperCase() + trimmed.slice(1), trimmed.toLowerCase()]
      : [trimmed, trimmed.toLowerCase()];

  let wikitext: string | null = null;
  let matched = trimmed;
  for (const variant of [...new Set(variants)]) {
    wikitext = await rawWikitext(host, variant);
    if (wikitext) {
      matched = variant;
      break;
    }
  }

  let inflection: { lemma: string; note?: string } | null = null;
  if (wikitext && lang === "de") {
    inflection = lemmaFromInflection(wikitext);
    if (inflection) {
      const lemmaText = await rawWikitext(host, inflection.lemma);
      if (lemmaText) {
        wikitext = lemmaText;
        matched = inflection.lemma;
      }
    }
  }

  const glosses = await englishGlosses(matched, lang);

  if (!wikitext && !glosses.length) return null;

  const parsed = wikitext
    ? parseGerman(matched, wikitext)
    : { word: matched, senses: [] as DictionarySense[] };

  // Prefer English glosses for the meaning; keep the native ones as backup.
  const senses = glosses.length ? glosses : parsed.senses;

  return {
    ...parsed,
    word: trimmed,
    lemma: inflection ? matched : parsed.word !== trimmed ? parsed.word : undefined,
    inflectionNote: inflection?.note,
    senses,
    source: "wiktionary",
    url: `https://${host}/wiki/${encodeURIComponent(matched)}`,
  };
}
