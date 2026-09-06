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

/** A sentence showing the word at work, which is how a word actually sticks. */
export interface DictionaryExample {
  text: string;
  translation?: string;
}

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
  /** Phrases the word habitually appears in, which is how it is really used. */
  collocations?: string[];
  /** Two or three sentences using the word, from the dictionary itself. */
  examples?: DictionaryExample[];
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
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "")
    .replace(/<ref[^>]*\/>/gi, "")
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

/**
 * The {{Beispiele}} block: real sentences, usually pulled from a newspaper,
 * which is exactly the register this app is read in.
 */
function examples(wikitext: string): DictionaryExample[] {
  const section = /\{\{Beispiele\}\}([\s\S]*?)(?:\n\{\{|\n===|$)/.exec(wikitext);
  if (!section) return [];
  return section[1]
    .split("\n")
    .map((line) => cleanWikiMarkup(line.replace(/^:?\s*\[[\d,\s a-z]*\]\s*/, "")))
    .filter((line) => line.length >= 12 && line.length <= 220)
    .slice(0, 3)
    .map((text) => ({ text }));
}

/** {{Charakteristische Wortkombinationen}} is Wiktionary's collocation list. */
function collocations(wikitext: string): string[] {
  const section = /\{\{Charakteristische Wortkombinationen\}\}([\s\S]*?)(?:\n\{\{|\n===|$)/.exec(
    wikitext,
  );
  if (!section) return [];
  return section[1]
    .split("\n")
    .flatMap((line) => cleanWikiMarkup(line.replace(/^:?\[[\d,\s]+\]\s*/, "")).split(/[;,]\s+/))
    .map((phrase) => phrase.trim())
    .filter((phrase) => phrase.length > 2 && phrase.length < 60)
    .slice(0, 8);
}

/** Exported so the wikitext parsing can be tested against fixtures. */
export function parseGerman(word: string, wikitext: string): Omit<DictionaryEntry, "source"> {
  const pos = partsOfSpeech(wikitext);
  // Only a noun has a gender, and the loose {{m}} fallback will happily find
  // one on an adjective page. An article on "klein" is worse than none.
  const noun = pos.some((p) => /Substantiv|Eigenname|Noun|Name/i.test(p));
  const genus = noun
    ? (firstMatch(wikitext, /\|Genus=([mfn])/) ?? firstMatch(wikitext, /\{\{([mfn])\}\}/))
    : undefined;
  const defs = meanings(wikitext);

  return {
    word,
    ipa: firstMatch(wikitext, /\{\{Lautschrift\|([^}|]+)\}\}/),
    article: genus ? GENDER_ARTICLE[genus] : undefined,
    singular: firstMatch(wikitext, /\|Nominativ Singular\s*=\s*([^\n|}]+)/),
    plural: firstMatch(wikitext, /\|Nominativ Plural\s*=\s*([^\n|}]+)/),
    collocations: collocations(wikitext),
    examples: examples(wikitext),
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
/** Definitions from English Wiktionary, and the examples that come with them. */
async function englishGlosses(
  word: string,
  lang: SourceLang,
): Promise<{ senses: DictionarySense[]; examples: DictionaryExample[] }> {
  try {
    const body = await fetchText(
      `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`,
      { timeoutMs: 7_000, accept: "application/json" },
    );
    const json = JSON.parse(body) as Record<
      string,
      {
        partOfSpeech: string;
        definitions: {
          definition: string;
          examples?: string[];
          parsedExamples?: { example?: string }[];
        }[];
      }[]
    >;
    const entries = json[lang] ?? [];
    const senses = entries
      .map((entry) => ({
        partOfSpeech: entry.partOfSpeech,
        definitions: entry.definitions
          .map((d) => cleanWikiMarkup(d.definition))
          .filter(Boolean)
          .slice(0, 4),
      }))
      .filter((s) => s.definitions.length)
      .slice(0, 4);

    const found = entries
      .flatMap((entry) => entry.definitions)
      .flatMap((d) => [...(d.parsedExamples ?? []).map((e) => e.example ?? ""), ...(d.examples ?? [])])
      .map((text) => cleanWikiMarkup(text))
      .filter((text) => text.length >= 12 && text.length <= 220)
      .slice(0, 3)
      .map((text) => ({ text }));

    return { senses, examples: found };
  } catch {
    return { senses: [], examples: [] };
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

  if (!wikitext && !glosses.senses.length) return null;

  const parsed = wikitext
    ? parseGerman(matched, wikitext)
    : {
        word: matched,
        senses: [] as DictionarySense[],
        collocations: [] as string[],
        examples: [] as DictionaryExample[],
      };

  // Prefer English glosses for the meaning; keep the native ones as backup.
  const senses = glosses.senses.length ? glosses.senses : parsed.senses;
  // Prefer examples in the language being read: they are the point.
  const showExamples = parsed.examples?.length ? parsed.examples : glosses.examples;

  return {
    ...parsed,
    word: trimmed,
    lemma: inflection ? matched : parsed.word !== trimmed ? parsed.word : undefined,
    inflectionNote: inflection?.note,
    senses,
    examples: showExamples,
    source: "wiktionary",
    url: `https://${host}/wiki/${encodeURIComponent(matched)}`,
  };
}
