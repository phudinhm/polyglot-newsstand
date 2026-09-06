import type { SourceLang } from "./types";

/**
 * A structural outline of a long sentence.
 *
 * German news prose nests relative clauses inside subordinate clauses and puts
 * the verb somewhere the English-trained eye does not expect. This is not a
 * parser and does not pretend to be one: it works from closed classes that can
 * be listed exhaustively - subordinating conjunctions, relative pronouns,
 * auxiliaries and modals - and from word order rules that hold in practice. It
 * shows where a sentence hinges, which is usually all a reader needs to get
 * unstuck.
 */

export type ClauseKind = "main" | "subordinate" | "relative" | "infinitive";

export interface Clause {
  text: string;
  kind: ClauseKind;
  /** The word that introduces it: "weil", "der", "um … zu". */
  connector?: string;
  /** The finite verb, when word order makes it identifiable. */
  finiteVerb?: string;
  /** Where that verb sits, which is the whole point in German. */
  verbPosition?: "second" | "final";
}

export interface SentenceStructure {
  clauses: Clause[];
  /** Things worth naming: passive, reported speech, a split verb. */
  notes: string[];
  /** True when the sentence was simple enough that this adds nothing. */
  trivial: boolean;
}

const SUBORDINATORS = new Set([
  "dass", "weil", "da", "obwohl", "obgleich", "wenn", "als", "während",
  "bevor", "nachdem", "damit", "ob", "indem", "sobald", "solange", "seit",
  "seitdem", "falls", "sofern", "bis", "wie", "wo", "wohin", "woher", "warum",
  "weshalb", "wieso", "soweit", "sodass", "zumal", "wenngleich",
]);

const RELATIVE_PRONOUNS = new Set([
  "der", "die", "das", "den", "dem", "deren", "dessen", "denen",
  "welcher", "welche", "welches", "welchen", "welchem", "was",
]);

const COORDINATORS = new Set(["und", "oder", "aber", "denn", "sondern", "doch"]);

/**
 * Finite auxiliaries and modals. A closed class, so listing it is exact rather
 * than a guess, and in news German the finite verb is one of these far more
 * often than not.
 */
const FINITE_AUX = new Set([
  "ist", "sind", "bin", "bist", "seid", "war", "warst", "waren", "wart",
  "sei", "seien", "wäre", "wären",
  "hat", "habe", "hast", "habt", "haben", "hatte", "hatten", "hättest",
  "hätte", "hätten",
  "wird", "werde", "wirst", "werdet", "werden", "wurde", "wurden", "würde",
  "würden", "worden",
  "kann", "kannst", "könnt", "können", "konnte", "konnten", "könnte", "könnten",
  "muss", "musst", "müsst", "müssen", "musste", "mussten", "müsste", "müssten",
  "soll", "sollst", "sollt", "sollen", "sollte", "sollten",
  "will", "willst", "wollt", "wollen", "wollte", "wollten",
  "darf", "darfst", "dürft", "dürfen", "durfte", "durften", "dürfte", "dürften",
  "mag", "magst", "mögt", "mögen", "mochte", "mochten", "möchte", "möchten",
]);

const PASSIVE_AUX = new Set(["wird", "werden", "wurde", "wurden", "worden"]);
/** Konjunktiv I, which is how German journalism marks reported speech. */
const REPORTED = new Set(["sei", "seien", "habe", "hätten", "werde", "würden", "könne", "solle", "wolle", "müsse"]);

const words = (text: string) => text.split(/\s+/).filter(Boolean);
const bare = (word: string) => word.replace(/[^\p{L}\p{M}]/gu, "").toLowerCase();

/** Words that open a sentence as an article, never as a relative pronoun. */
const FUNCTION_WORDS = new Set([
  "der", "die", "das", "den", "dem", "des", "ein", "eine", "einen", "einem",
  "einer", "eines", "und", "oder", "aber", "nicht", "auch", "nur", "noch",
  "schon", "sich", "es", "er", "sie", "wir", "ihr", "man", "im", "in", "an",
  "auf", "für", "mit", "von", "zu", "bei", "nach", "aus", "über", "unter",
  "vor", "seit", "ohne", "um", "durch", "gegen", "am", "zum", "zur", "beim",
]);

function classify(
  segment: string,
  index: number,
): { kind: ClauseKind; connector?: string } {
  const parts = words(segment);
  if (!parts.length) return { kind: "main" };
  const first = bare(parts[0]);

  if (/^um$/.test(first) && /\bzu\b/.test(segment)) {
    return { kind: "infinitive", connector: "um … zu" };
  }
  if (SUBORDINATORS.has(first)) return { kind: "subordinate", connector: parts[0] };
  // A relative clause never opens a sentence: at the start, der/die/das is the
  // article of the subject, and calling it a pronoun would mislead a learner.
  if (index > 0 && RELATIVE_PRONOUNS.has(first)) {
    return { kind: "relative", connector: parts[0] };
  }
  if (COORDINATORS.has(first) && parts.length > 1) {
    const second = bare(parts[1]);
    if (SUBORDINATORS.has(second)) return { kind: "subordinate", connector: parts[1] };
  }
  return { kind: "main" };
}

function finiteVerbOf(segment: string, kind: ClauseKind): Pick<Clause, "finiteVerb" | "verbPosition"> {
  const parts = words(segment).map((w) => ({ raw: w, bare: bare(w) }));
  if (!parts.length) return {};

  // In a subordinate or relative clause the finite verb goes last.
  if (kind === "subordinate" || kind === "relative") {
    const last = parts[parts.length - 1];
    return { finiteVerb: last.raw.replace(/[.,;:!?]$/, ""), verbPosition: "final" };
  }

  // In a main clause it is the second constituent; an auxiliary is the giveaway.
  const auxiliary = parts.find((p) => FINITE_AUX.has(p.bare));
  if (auxiliary) return { finiteVerb: auxiliary.raw, verbPosition: "second" };

  // Failing that, lean on two rules that hold together: a declarative main
  // clause puts the finite verb second, and German verbs are lowercase while
  // nouns are not.
  const second = parts[1];
  if (
    second &&
    /^\p{Ll}/u.test(second.raw) &&
    !FUNCTION_WORDS.has(second.bare) &&
    second.bare.length > 2
  ) {
    return { finiteVerb: second.raw.replace(/[.,;:!?]$/, ""), verbPosition: "second" };
  }
  return {};
}

/**
 * Split on the punctuation and conjunctions that actually open a new clause.
 * A comma inside a list is not one, so a segment with no verb-like word is
 * folded back into its neighbour.
 */
function segments(sentence: string): string[] {
  const rough = sentence
    .split(/(?<=[^,;])\s*[,;]\s+/)
    .flatMap((part) => part.split(/\s+(?=(?:und|oder|aber|denn|sondern)\s+(?:dass|weil|da|obwohl|wenn)\b)/i))
    .map((part) => part.trim())
    .filter(Boolean);

  const merged: string[] = [];
  for (const part of rough) {
    const hasVerb = words(part).some((w) => FINITE_AUX.has(bare(w))) || words(part).length > 3;
    if (!hasVerb && merged.length) merged[merged.length - 1] += `, ${part}`;
    else merged.push(part);
  }
  return merged;
}

export function analyseSentence(sentence: string, lang: SourceLang): SentenceStructure {
  const trimmed = sentence.replace(/\s+/g, " ").trim();
  // The rules below are German word order; other languages get nothing rather
  // than a confidently wrong answer.
  if (lang !== "de" || words(trimmed).length < 8) {
    return { clauses: [], notes: [], trivial: true };
  }

  const clauses: Clause[] = segments(trimmed).map((segment, index) => {
    const { kind, connector } = classify(segment, index);
    return { text: segment, kind, connector, ...finiteVerbOf(segment, kind) };
  });

  const notes: string[] = [];
  const all = words(trimmed).map(bare);

  if (all.some((w) => PASSIVE_AUX.has(w)) && all.some((w) => /^ge\p{L}+(t|en)$/u.test(w))) {
    notes.push("Passive: werden plus a past participle, so the actor may be unnamed.");
  }
  if (all.some((w) => REPORTED.has(w))) {
    notes.push("Reported speech: Konjunktiv I marks this as someone's claim, not the paper's.");
  }
  if (clauses.some((c) => c.kind === "relative")) {
    notes.push("A relative clause describes the noun just before it, and its verb comes last.");
  }
  if (clauses.some((c) => c.kind === "subordinate")) {
    notes.push("In a subordinate clause the finite verb moves to the end.");
  }
  if (clauses.some((c) => c.kind === "infinitive")) {
    notes.push("um … zu introduces a purpose: in order to.");
  }

  return {
    clauses,
    notes,
    trivial: clauses.length < 2 && !notes.length,
  };
}
