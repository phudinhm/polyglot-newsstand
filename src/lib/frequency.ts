/**
 * The German words too common to be worth flagging.
 *
 * A vocabulary heatmap that lights up "der", "und" and "ist" tells a reader
 * nothing. This is a closed list of function words and the most frequent verbs
 * and nouns, which can be written out exactly rather than estimated. Anything
 * outside it and outside the reader's own vocabulary counts as new.
 */
export const COMMON_GERMAN = new Set([
  // articles, pronouns, determiners
  "der", "die", "das", "den", "dem", "des", "ein", "eine", "einen", "einem",
  "einer", "eines", "kein", "keine", "keinen", "keinem", "keiner", "dieser",
  "diese", "dieses", "diesen", "diesem", "jener", "jene", "jenes", "welche",
  "welcher", "welches", "welchen", "welchem", "alle", "allen", "aller", "alles",
  "beide", "beiden", "manche", "mancher", "viele", "vielen", "wenige", "einige",
  "ich", "du", "er", "sie", "es", "wir", "ihr", "mich", "dich", "ihn", "uns",
  "euch", "ihnen", "mir", "dir", "ihm", "sich", "man", "wer", "wen", "wem",
  "mein", "meine", "dein", "deine", "sein", "seine", "seinen", "seiner",
  "unser", "unsere", "euer", "eure", "ihre", "ihren", "ihrer", "ihrem",
  // prepositions and conjunctions
  "in", "an", "auf", "für", "mit", "von", "zu", "bei", "nach", "aus", "über",
  "unter", "vor", "seit", "ohne", "um", "durch", "gegen", "zwischen", "hinter",
  "neben", "trotz", "während", "wegen", "statt", "bis", "am", "im", "zum",
  "zur", "beim", "vom", "ins", "ans", "aufs",
  "und", "oder", "aber", "denn", "sondern", "doch", "sowie", "sowohl", "als",
  "wie", "dass", "weil", "da", "wenn", "ob", "obwohl", "damit", "sodass",
  "bevor", "nachdem", "solange", "sobald", "falls", "indem", "während",
  // very frequent verbs
  "ist", "sind", "war", "waren", "sein", "bin", "bist", "seid", "sei", "wäre",
  "hat", "haben", "hatte", "hatten", "habe", "hast", "habt", "hätte",
  "wird", "werden", "wurde", "wurden", "werde", "würde", "worden",
  "kann", "können", "konnte", "konnten", "könnte", "muss", "müssen", "musste",
  "soll", "sollen", "sollte", "will", "wollen", "wollte", "darf", "dürfen",
  "mag", "mögen", "möchte", "gibt", "geben", "gab", "macht", "machen", "machte",
  "sagt", "sagen", "sagte", "geht", "gehen", "ging", "kommt", "kommen", "kam",
  "steht", "stehen", "stand", "sieht", "sehen", "sah", "weiß", "wissen",
  "wusste", "bleibt", "bleiben", "blieb", "liegt", "liegen", "lag", "heißt",
  "nimmt", "nehmen", "nahm", "findet", "finden", "fand", "stellt", "stellen",
  // adverbs, particles, quantifiers
  "nicht", "auch", "nur", "noch", "schon", "sehr", "mehr", "immer", "wieder",
  "hier", "dort", "da", "so", "dann", "jetzt", "heute", "gestern", "morgen",
  "sehr", "etwa", "fast", "rund", "etwas", "nichts", "alles", "viel", "wenig",
  "gut", "neu", "groß", "klein", "lang", "hoch", "erst", "letzte", "letzten",
  "ersten", "zweiten", "dritten", "eigen", "eigene", "ganz", "ganze", "selbst",
  "zwar", "eben", "gerade", "bereits", "jedoch", "allerdings", "deshalb",
  "dabei", "dazu", "damit", "davon", "daran", "darauf", "darüber", "dafür",
  // frequent nouns of news prose
  "jahr", "jahre", "jahren", "tag", "tage", "tagen", "zeit", "zeiten", "mensch",
  "menschen", "land", "länder", "ländern", "stadt", "städte", "welt", "leben",
  "arbeit", "prozent", "euro", "million", "millionen", "milliarde", "milliarden",
  "regierung", "unternehmen", "frage", "fragen", "teil", "teile", "ende",
  "beispiel", "grund", "gründe", "woche", "wochen", "monat", "monate",
]);

/** Common English, for the same reason. */
export const COMMON_ENGLISH = new Set([
  "the", "a", "an", "and", "or", "but", "if", "of", "to", "in", "on", "at",
  "by", "for", "with", "from", "as", "is", "are", "was", "were", "be", "been",
  "being", "has", "have", "had", "do", "does", "did", "will", "would", "can",
  "could", "should", "may", "might", "must", "shall", "not", "no", "yes",
  "this", "that", "these", "those", "there", "here", "it", "its", "he", "she",
  "they", "them", "his", "her", "their", "we", "us", "our", "you", "your",
  "i", "me", "my", "who", "whom", "which", "what", "when", "where", "why",
  "how", "all", "any", "some", "more", "most", "other", "such", "only", "own",
  "same", "than", "too", "very", "just", "also", "about", "after", "before",
  "over", "under", "between", "through", "during", "against", "into", "out",
  "up", "down", "again", "further", "then", "once", "said", "says", "year",
  "years", "time", "people", "government", "company", "percent", "new", "one",
  "two", "three", "first", "last", "many", "much", "way", "world", "day",
]);

export function isCommon(word: string, lang: string): boolean {
  const lower = word.toLowerCase();
  if (lang === "de") return COMMON_GERMAN.has(lower);
  if (lang === "en") return COMMON_ENGLISH.has(lower);
  return true;
}

/**
 * How many distinct words in this text are worth learning, at a glance.
 *
 * A headline and its summary are a rough preview, not a lesson, so this is
 * an estimate rather than the heatmap's word-by-word judgement - but it is
 * enough to tell a browsing reader which story is worth the vocabulary. Only
 * meaningful for German and English, the two languages with a common-word
 * list; Vietnamese always reads as zero rather than counting every word.
 */
export function newWordCount(text: string, lang: string): number {
  if (lang !== "de" && lang !== "en") return 0;
  const seen = new Set<string>();
  for (const match of text.matchAll(/[\p{L}\p{M}]+/gu)) {
    const word = match[0].toLowerCase();
    if (!isCommon(word, lang)) seen.add(word);
  }
  return seen.size;
}
