/**
 * Splitting a paragraph into sentences is the whole trick of this app: a
 * sentence is the unit a learner reads, translates and remembers.
 *
 * Intl.Segmenter does the heavy lifting and ships in Node 18+ and every
 * current browser, but its German rules break after abbreviations and
 * ordinals, so mergeStragglers() below repairs the output. The regex path is
 * only a safety net for the rare runtime without a segmenter.
 */
export function splitSentences(paragraph: string, locale = "de"): string[] {
  const text = paragraph.replace(/\s+/g, " ").trim();
  if (!text) return [];

  const Segmenter = (Intl as unknown as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  if (Segmenter) {
    const segmenter = new Segmenter(locale, { granularity: "sentence" });
    const parts = Array.from(segmenter.segment(text), (s) => s.segment.trim()).filter(Boolean);
    if (parts.length) return mergeStragglers(parts);
  }

  const fallback = text
    .split(/(?<=[.!?…])\s+(?=[A-ZÄÖÜ"'„«(])/u)
    .map((s) => s.trim())
    .filter(Boolean);
  return mergeStragglers(fallback.length ? fallback : [text]);
}

/**
 * German abbreviations that ICU does not suppress, so Intl.Segmenter happily
 * breaks "z. B." into two sentences. Everything here is a fragment that must
 * stay glued to what follows.
 *
 * Deliberately excluded: usw., etc., ff. and similar, which normally do end a
 * sentence. A slightly long line is a much smaller problem than a broken one.
 */
const ABBREVIATIONS = new Set([
  // German
  "z", "b", "bzw", "ca", "d", "h", "u", "a", "evtl", "ggf", "inkl", "zzgl",
  "vgl", "bspw", "sog", "max", "min", "mio", "mrd", "tsd", "nr", "abs", "art",
  "bzgl", "ehem", "geb", "gest", "lt", "od", "bd", "hrsg", "anm", "jh", "jhd",
  "kap", "pkt", "tel", "urspr", "verf", "zit", "dt", "engl", "franz",
  // Titles, German and English
  "dr", "prof", "dipl", "ing", "med", "phil", "jur", "mr", "mrs", "ms", "st",
  "jr", "sr", "hr", "fr",
  // Months, often abbreviated in datelines
  "jan", "feb", "mrz", "apr", "jun", "jul", "aug", "sep", "sept", "okt", "nov",
  "dez", "mar", "oct", "dec",
  // English and business
  "inc", "ltd", "co", "corp", "vs", "approx", "dept", "est", "fig", "vol",
  "no", "pp", "al",
]);

const ENDS_WITH_ABBREVIATION = /(?:^|[\s("'„»])([\p{L}]{1,6})\.$/u;
/** "am 1." or "im 20." - an ordinal, not the end of a thought. */
const ENDS_WITH_ORDINAL = /(?:^|\s)\d{1,4}\.$/;
/** A lone initial such as "J." in "J. Müller". */
const ENDS_WITH_INITIAL = /(?:^|\s)\p{Lu}\.$/u;
/** A continuation almost never opens with a lowercase letter. */
const STARTS_LOWERCASE = /^[\p{Ll}\d]/u;

const MAX_MERGED_LENGTH = 400;

function shouldMerge(previous: string, next: string): boolean {
  if (previous.length + next.length > MAX_MERGED_LENGTH) return false;

  const abbrev = ENDS_WITH_ABBREVIATION.exec(previous);
  if (abbrev && ABBREVIATIONS.has(abbrev[1].toLowerCase())) return true;
  if (ENDS_WITH_ORDINAL.test(previous)) return true;
  if (ENDS_WITH_INITIAL.test(previous)) return true;
  if (STARTS_LOWERCASE.test(next)) return true;
  // An unterminated fragment is a segmenter artefact, not a sentence.
  if (!/[.!?…:]["'»«)\]]?$/.test(previous)) return true;
  return false;
}

/**
 * Repair the segmenter's output.
 *
 * Two things go wrong on German news text: ICU breaks after abbreviations and
 * ordinals ("z. B.", "am 1. Januar", "Dr. Müller"), and quotation marks leave
 * stray one- or two-character fragments. Both produce lines a learner cannot
 * read, so we glue them back onto the sentence they belong to.
 */
function mergeStragglers(parts: string[], minChars = 12): string[] {
  const out: string[] = [];
  for (const part of parts) {
    const previous = out[out.length - 1];
    // A short part that opens like a sentence and closes with real punctuation
    // is a short sentence ("Warum?"), not a fragment to be glued on.
    const isFragment = part.length < minChars && !isSelfContained(part);
    if (
      previous !== undefined &&
      (shouldMerge(previous, part) || isFragment) &&
      previous.length + part.length <= MAX_MERGED_LENGTH
    ) {
      out[out.length - 1] = `${previous} ${part}`;
      continue;
    }
    out.push(part);
  }
  return out;
}

function isSelfContained(part: string): boolean {
  return /^[\p{Lu}\p{Lt}"'\u201e\u00ab(\[\d]/u.test(part) && /[.!?\u2026]["'\u00bb\u00ab)\]]?$/u.test(part);
}

/**
 * Split a sentence into word and non-word runs so each word can be tapped for
 * a lookup while punctuation and spacing stay exactly where the author put it.
 */
export function splitWords(sentence: string): { text: string; isWord: boolean }[] {
  const tokens: { text: string; isWord: boolean }[] = [];
  // Letters include the German umlauts and eszett plus any accented Latin.
  const re = /[\p{L}\p{M}]+(?:[-'’][\p{L}\p{M}]+)*/gu;
  let lastIndex = 0;
  for (const match of sentence.matchAll(re)) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      tokens.push({ text: sentence.slice(lastIndex, start), isWord: false });
    }
    tokens.push({ text: match[0], isWord: true });
    lastIndex = start + match[0].length;
  }
  if (lastIndex < sentence.length) {
    tokens.push({ text: sentence.slice(lastIndex), isWord: false });
  }
  return tokens;
}

export function countWords(text: string): number {
  return (text.match(/[\p{L}\p{M}]+/gu) ?? []).length;
}
