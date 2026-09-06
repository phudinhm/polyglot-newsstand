import type { SourceLang } from "./types";
import {
  caseName,
  CONTRACTIONS,
  FIXED_CASE,
  TWO_WAY,
  findCase,
  normalise,
  readDeterminer,
  stripPunctuation,
} from "./cases";

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

/** What a German grammar book calls each of these. */
export const CLAUSE_GERMAN: Record<ClauseKind, string> = {
  main: "Hauptsatz",
  subordinate: "Nebensatz",
  relative: "Relativsatz",
  infinitive: "Infinitivsatz",
};

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

/** A word worth pointing at, with what it is doing. */
export interface WordNote {
  word: string;
  role: string;
  detail: string;
}

export interface SentenceStructure {
  clauses: Clause[];
  /** Things worth naming: passive, reported speech, a split verb. */
  notes: string[];
  /** Prepositions, possessives and the like, even in a one-clause sentence. */
  words: WordNote[];
  /** True when there is genuinely nothing to say about this sentence. */
  trivial: boolean;
}

const POSSESSIVES: Record<string, string> = {
  mein: "my", dein: "your", sein: "his or its", ihr: "her, its or their",
  unser: "our", euer: "your (plural)",
};

const REFLEXIVES = new Set(["sich", "mich", "dich", "uns", "euch"]);

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

  // Failing that, lean on rules that hold together. German verbs are lowercase
  // where nouns are not, and the finite verb never sits directly behind a
  // preposition or an article - that slot belongs to an adjective or a
  // participle, which is what "Nach versuchten Angriffen" puts there.
  for (let i = 1; i < parts.length; i++) {
    const here = parts[i];
    const previous = parts[i - 1];
    if (!/^\p{Ll}/u.test(here.raw)) continue;
    if (FUNCTION_WORDS.has(here.bare) || here.bare.length <= 2) continue;
    if (SEPARABLE_PREFIXES.has(here.bare)) continue;
    if (FIXED_CASE[previous.bare] || TWO_WAY.has(previous.bare) || CONTRACTIONS[previous.bare]) continue;
    if (readDeterminer(previous.bare)) continue;
    return { finiteVerb: here.raw.replace(/[.,;:!?]$/, ""), verbPosition: "second" };
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

/**
 * Prefixes that detach from their verb and wait at the end of the clause.
 * Closed class, and the reason a learner meets "an" at a full stop and reads
 * it as a preposition when it is half a verb.
 */
const SEPARABLE_PREFIXES = new Set([
  "ab", "an", "auf", "aus", "bei", "dar", "ein", "fest", "fort", "frei",
  "her", "heim", "hin", "los", "mit", "nach", "statt", "teil", "vor", "wahr",
  "weg", "weiter", "zu", "zurück", "zusammen", "zurecht", "voran", "voraus",
  "vorbei", "vorüber", "entgegen", "gegenüber", "hinzu", "davon", "dazu",
  "empor", "nieder", "über", "um", "unter", "durch", "wieder",
]);

/** Finite forms whose infinitive cannot be reached by stripping an ending. */
const IRREGULAR_INFINITIVE: Record<string, string> = {
  nimmt: "nehmen", nehmen: "nehmen", gibt: "geben", geben: "geben",
  hält: "halten", halten: "halten", fällt: "fallen", fallen: "fallen",
  fährt: "fahren", fahren: "fahren", läuft: "laufen", laufen: "laufen",
  tritt: "treten", treten: "treten", sieht: "sehen", sehen: "sehen",
  spricht: "sprechen", sprechen: "sprechen", bricht: "brechen",
  wirft: "werfen", werfen: "werfen", trägt: "tragen", tragen: "tragen",
  lädt: "laden", schlägt: "schlagen", zieht: "ziehen", ziehen: "ziehen",
  ruft: "rufen", rufen: "rufen", geht: "gehen", gehen: "gehen",
  steht: "stehen", stehen: "stehen", kommt: "kommen", kommen: "kommen",
  liegt: "liegen", liegen: "liegen", stellt: "stellen", setzt: "setzen",
  bringt: "bringen", bringen: "bringen", findet: "finden", finden: "finden",
  hört: "hören", sieht_zu: "zusehen",
};

/**
 * Rebuild the infinitive of a finite verb well enough to name the split verb.
 * Regular German is regular here, and the irregulars that matter are listed
 * above, so this is a reconstruction rather than a guess.
 */
function infinitiveOf(finite: string): string | null {
  const verb = normalise(finite);
  if (!verb || verb.length < 3) return null;
  if (IRREGULAR_INFINITIVE[verb]) return IRREGULAR_INFINITIVE[verb];
  if (verb.endsWith("en")) return verb;
  if (verb.endsWith("t")) {
    const stem = verb.slice(0, -1);
    if (/[aeiouäöü]$/.test(stem) || /(er|el)$/.test(stem)) return `${stem}n`;
    return `${stem}en`;
  }
  return null;
}

interface Governed {
  stem: string;
  lemma: string;
  preposition: string;
  kasus: "accusative" | "dative";
}

/**
 * Verbs married to a preposition. The preposition here has lost its own
 * meaning: "warten auf" is one vocabulary item, and reading "auf" as "on"
 * is exactly the wrong move.
 */
const VERB_PREPOSITIONS: Governed[] = [
  { stem: "wart", lemma: "warten auf", preposition: "auf", kasus: "accusative" },
  { stem: "denk", lemma: "denken an", preposition: "an", kasus: "accusative" },
  { stem: "erinner", lemma: "sich erinnern an", preposition: "an", kasus: "accusative" },
  { stem: "glaub", lemma: "glauben an", preposition: "an", kasus: "accusative" },
  { stem: "freu", lemma: "sich freuen über", preposition: "über", kasus: "accusative" },
  { stem: "sprech", lemma: "sprechen über", preposition: "über", kasus: "accusative" },
  { stem: "spricht", lemma: "sprechen über", preposition: "über", kasus: "accusative" },
  { stem: "red", lemma: "reden über", preposition: "über", kasus: "accusative" },
  { stem: "bericht", lemma: "berichten über", preposition: "über", kasus: "accusative" },
  { stem: "diskutier", lemma: "diskutieren über", preposition: "über", kasus: "accusative" },
  { stem: "informier", lemma: "informieren über", preposition: "über", kasus: "accusative" },
  { stem: "beschwer", lemma: "sich beschweren über", preposition: "über", kasus: "accusative" },
  { stem: "handel", lemma: "es handelt sich um", preposition: "um", kasus: "accusative" },
  { stem: "bitt", lemma: "bitten um", preposition: "um", kasus: "accusative" },
  { stem: "kümmer", lemma: "sich kümmern um", preposition: "um", kasus: "accusative" },
  { stem: "sorg", lemma: "sorgen für", preposition: "für", kasus: "accusative" },
  { stem: "interessier", lemma: "sich interessieren für", preposition: "für", kasus: "accusative" },
  { stem: "acht", lemma: "achten auf", preposition: "auf", kasus: "accusative" },
  { stem: "verzicht", lemma: "verzichten auf", preposition: "auf", kasus: "accusative" },
  { stem: "reagier", lemma: "reagieren auf", preposition: "auf", kasus: "accusative" },
  { stem: "hoff", lemma: "hoffen auf", preposition: "auf", kasus: "accusative" },
  { stem: "verlass", lemma: "sich verlassen auf", preposition: "auf", kasus: "accusative" },
  { stem: "vorbereit", lemma: "sich vorbereiten auf", preposition: "auf", kasus: "accusative" },
  { stem: "einig", lemma: "sich einigen auf", preposition: "auf", kasus: "accusative" },
  { stem: "teilnehm", lemma: "teilnehmen an", preposition: "an", kasus: "dative" },
  { stem: "leid", lemma: "leiden unter", preposition: "unter", kasus: "dative" },
  { stem: "arbeit", lemma: "arbeiten an", preposition: "an", kasus: "dative" },
  { stem: "zweifel", lemma: "zweifeln an", preposition: "an", kasus: "dative" },
  { stem: "beteilig", lemma: "sich beteiligen an", preposition: "an", kasus: "dative" },
  { stem: "gehör", lemma: "gehören zu", preposition: "zu", kasus: "dative" },
  { stem: "führ", lemma: "führen zu", preposition: "zu", kasus: "dative" },
  { stem: "beitrag", lemma: "beitragen zu", preposition: "zu", kasus: "dative" },
  { stem: "besteh", lemma: "bestehen aus", preposition: "aus", kasus: "dative" },
  { stem: "stamm", lemma: "stammen aus", preposition: "aus", kasus: "dative" },
  { stem: "rechn", lemma: "rechnen mit", preposition: "mit", kasus: "dative" },
  { stem: "beschäftig", lemma: "sich beschäftigen mit", preposition: "mit", kasus: "dative" },
  { stem: "frag", lemma: "fragen nach", preposition: "nach", kasus: "dative" },
  { stem: "such", lemma: "suchen nach", preposition: "nach", kasus: "dative" },
  { stem: "streb", lemma: "streben nach", preposition: "nach", kasus: "dative" },
  { stem: "schütz", lemma: "schützen vor", preposition: "vor", kasus: "dative" },
  { stem: "warn", lemma: "warnen vor", preposition: "vor", kasus: "dative" },
  { stem: "abhäng", lemma: "abhängen von", preposition: "von", kasus: "dative" },
  { stem: "profitier", lemma: "profitieren von", preposition: "von", kasus: "dative" },
  { stem: "überzeug", lemma: "überzeugen von", preposition: "von", kasus: "dative" },
  { stem: "erzähl", lemma: "erzählen von", preposition: "von", kasus: "dative" },
];

/**
 * Nouns that carry their own preposition, which is how "Angriffe auf das
 * Stromnetz" works: the "auf" belongs to the attack, not to the verb.
 */
const NOUN_PREPOSITIONS: Governed[] = [
  { stem: "angriff", lemma: "der Angriff auf", preposition: "auf", kasus: "accusative" },
  { stem: "anschlag", lemma: "der Anschlag auf", preposition: "auf", kasus: "accusative" },
  { stem: "anspruch", lemma: "der Anspruch auf", preposition: "auf", kasus: "accusative" },
  { stem: "antwort", lemma: "die Antwort auf", preposition: "auf", kasus: "accusative" },
  { stem: "einfluss", lemma: "der Einfluss auf", preposition: "auf", kasus: "accusative" },
  { stem: "bericht", lemma: "der Bericht über", preposition: "über", kasus: "accusative" },
  { stem: "debatte", lemma: "die Debatte über", preposition: "über", kasus: "accusative" },
  { stem: "streit", lemma: "der Streit über", preposition: "über", kasus: "accusative" },
  { stem: "hinweis", lemma: "der Hinweis auf", preposition: "auf", kasus: "accusative" },
  { stem: "reaktion", lemma: "die Reaktion auf", preposition: "auf", kasus: "accusative" },
  { stem: "verzicht", lemma: "der Verzicht auf", preposition: "auf", kasus: "accusative" },
  { stem: "grund", lemma: "der Grund für", preposition: "für", kasus: "accusative" },
  { stem: "interesse", lemma: "das Interesse an", preposition: "an", kasus: "dative" },
  { stem: "kritik", lemma: "die Kritik an", preposition: "an", kasus: "dative" },
  { stem: "mangel", lemma: "der Mangel an", preposition: "an", kasus: "dative" },
  { stem: "zweifel", lemma: "der Zweifel an", preposition: "an", kasus: "dative" },
  { stem: "teilnahme", lemma: "die Teilnahme an", preposition: "an", kasus: "dative" },
  { stem: "zugang", lemma: "der Zugang zu", preposition: "zu", kasus: "dative" },
  { stem: "beitrag", lemma: "der Beitrag zu", preposition: "zu", kasus: "dative" },
  { stem: "suche", lemma: "die Suche nach", preposition: "nach", kasus: "dative" },
  { stem: "schutz", lemma: "der Schutz vor", preposition: "vor", kasus: "dative" },
  { stem: "angst", lemma: "die Angst vor", preposition: "vor", kasus: "dative" },
];

/**
 * Does this word start with that verb stem? Only a real word start counts, or
 * one behind a ge- participle: "versuchten" is not a form of "suchen", and
 * treating it as one is how "nach" gets called half of "suchen nach".
 */
function startsWithStem(word: string, stem: string): boolean {
  if (word.length < 4) return false;
  return word.startsWith(stem) || (word.startsWith("ge") && word.slice(2).startsWith(stem));
}

/** The noun a preposition is pointing at: the next capitalised word. */
function headNounAfter(tokens: string[], from: number): string | undefined {
  for (let i = from + 1; i < tokens.length && i <= from + 4; i++) {
    const raw = stripPunctuation(tokens[i]);
    if (/^\p{Lu}/u.test(raw)) return raw;
  }
  return undefined;
}

/**
 * Point at the words that carry grammar rather than meaning, and name what
 * each is actually doing. The order matters: a word that looks like a
 * preposition is checked first against the jobs that outrank that reading -
 * half of a split verb, or half of a fixed verb-plus-preposition pair.
 */
function annotateWords(sentence: string, clauses: Clause[]): WordNote[] {
  const tokens = words(sentence);
  const notes: WordNote[] = [];
  const seen = new Set<string>();
  const add = (note: WordNote) => {
    if (seen.has(note.word.toLowerCase())) return;
    seen.add(note.word.toLowerCase());
    notes.push(note);
  };

  // Which tokens end a clause, so a prefix parked there can be spotted.
  const clauseFinal = new Set<number>();
  for (const clause of clauses) {
    const last = words(clause.text).pop();
    if (!last) continue;
    const at = tokens.lastIndexOf(last);
    if (at > 0) clauseFinal.add(at);
  }
  clauseFinal.add(tokens.length - 1);

  // Which clause each token belongs to, walked in order so a repeated word
  // does not get attributed to the wrong half of the sentence.
  const clauseAt: (Clause | undefined)[] = [];
  let cursor = 0;
  for (const clause of clauses) {
    for (let i = 0; i < words(clause.text).length; i++) clauseAt[cursor++] = clause;
  }
  const verbOf = (index: number) => clauseAt[index]?.finiteVerb;

  tokens.forEach((raw, index) => {
    const clean = stripPunctuation(raw);
    const word = normalise(raw);
    if (!word) return;

    // A separable prefix sits where a preposition never does: at the very end
    // of its clause, with the rest of its verb at the front.
    if (SEPARABLE_PREFIXES.has(word) && clauseFinal.has(index) && index > 1) {
      const verb = verbOf(index);
      const infinitive = verb ? infinitiveOf(verb) : null;
      add({
        word: clean,
        role: "Separable prefix",
        detail: verb
          ? infinitive
            ? `not a preposition here: it is the front half of ${word}${infinitive}, split off and parked at the end. Read it together with ${verb}.`
            : `not a preposition here: it belongs to ${verb} at the front of the clause, which German splits in two.`
          : "not a preposition here: it is half of a separable verb, parked at the end of its clause.",
      });
      return;
    }

    if (CONTRACTIONS[word]) {
      const c = CONTRACTIONS[word];
      add({
        word: clean,
        role: "Contraction",
        detail: `${c.preposition} + ${c.article} in one word, so the noun after it is ${caseName(c.kasus)}.`,
      });
      return;
    }

    const isPreposition = FIXED_CASE[word] || TWO_WAY.has(word);
    if (isPreposition) {
      // A preposition welded to a verb or a noun is one vocabulary item, and
      // translating it on its own is what makes a sentence stop making sense.
      const context = tokens.map(normalise);
      // Also try the verb put back together with its separable prefix, so
      // "nimmt ... teil" can be recognised as teilnehmen an.
      const rejoined = clauses.flatMap((clause) => {
        const parts = words(clause.text).map(normalise);
        const prefix = parts.find((t) => SEPARABLE_PREFIXES.has(t));
        const infinitive = clause.finiteVerb ? infinitiveOf(clause.finiteVerb) : null;
        return prefix && infinitive ? [prefix + infinitive] : [];
      });
      const governedByVerb = VERB_PREPOSITIONS.find(
        (g) => g.preposition === word && [...context, ...rejoined].some((t) => startsWithStem(t, g.stem)),
      );
      const before = [context[index - 1], context[index - 2]].filter(Boolean);
      const governedByNoun = NOUN_PREPOSITIONS.find(
        (g) => g.preposition === word && before.some((t) => startsWithStem(t, g.stem)),
      );
      const governed = governedByNoun ?? governedByVerb;

      if (governed) {
        add({
          word: clean,
          role: "Part of a fixed pair",
          detail: `${governed.lemma} is a fixed pair, and it takes the ${caseName(governed.kasus)}. ${clean} carries no meaning of its own here, so do not translate it separately.`,
        });
        return;
      }

      const noun = headNounAfter(tokens, index);
      const finding = noun ? findCase(sentence, noun) : null;

      if (TWO_WAY.has(word)) {
        add({
          word: clean,
          role: "Two-way preposition",
          detail:
            finding && finding.certain && finding.trigger
              ? finding.reason
              : noun
                ? `accusative for movement toward, dative for staying put. Nothing in front of ${noun} marks which, so the meaning of the verb decides.`
                : "accusative when something moves there, dative when it is already there.",
        });
        return;
      }

      add({
        word: clean,
        role: "Preposition",
        detail: `always takes the ${caseName(FIXED_CASE[word])}${
          finding?.determiner && finding.certain ? `: ${clean} ${finding.determiner} ${noun}` : ""
        }.`,
      });
      return;
    }

    const possessive = Object.keys(POSSESSIVES).find(
      (base) => word === base || (word.startsWith(base) && word.length - base.length <= 2),
    );
    if (possessive) {
      add({
        word: clean,
        role: "Possessive",
        detail: `${POSSESSIVES[possessive]} - its ending agrees with the noun that follows, not with the owner.`,
      });
      return;
    }

    if (REFLEXIVES.has(word)) {
      add({
        word: clean,
        role: "Reflexive pronoun",
        detail: "the verb turns its action back on the subject.",
      });
      return;
    }

    if (FINITE_AUX.has(word)) {
      const modal =
        /^(kann|können|konnte|könnte|muss|müssen|musste|müsste|soll|sollen|sollte|will|wollen|wollte|darf|dürfen|durfte|dürfte|mag|mögen|möchte)/.test(
          word,
        );
      add({
        word: clean,
        role: modal ? "Modal verb" : "Auxiliary verb",
        detail: modal
          ? "sends the main verb, as an infinitive, to the end of the clause."
          : "carries the tense; the main verb waits at the end as a participle or infinitive.",
      });
    }
  });

  return notes.slice(0, 8);
}

export function analyseSentence(sentence: string, lang: SourceLang): SentenceStructure {
  const trimmed = sentence.replace(/\s+/g, " ").trim();
  // The rules below are German word order; other languages get nothing rather
  // than a confidently wrong answer.
  if (lang !== "de" || !trimmed) {
    return { clauses: [], notes: [], words: [], trivial: true };
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

  const wordNotes = annotateWords(trimmed, clauses);

  return {
    clauses,
    notes,
    words: wordNotes,
    // Only a sentence with nothing to say about it at all is skipped.
    trivial: clauses.length === 0 && !notes.length && !wordNotes.length,
  };
}
