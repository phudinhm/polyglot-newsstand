/**
 * German case, worked out from the words that mark it.
 *
 * A learner reading a news sentence does not need a parser; they need an
 * answer to one question: why is it "dem" here and not "das"? That question is
 * answerable from closed classes. Determiners carry the case on their endings,
 * prepositions govern a case outright, and where a two-way preposition leaves
 * a choice, the determiner settles it. Everything below works from those two
 * facts and says so plainly when they do not settle it.
 */

export type Case = "nominative" | "accusative" | "dative" | "genitive";
export type Gender = "m" | "f" | "n" | "pl";

export const CASE_GERMAN: Record<Case, string> = {
  nominative: "Nominativ",
  accusative: "Akkusativ",
  dative: "Dativ",
  genitive: "Genitiv",
};

/** English first, German in brackets: a learner needs both words. */
export const caseName = (kasus: Case) =>
  `${kasus} (${CASE_GERMAN[kasus]})`;

export const CASE_SHORT: Record<Case, string> = {
  nominative: "Nom",
  accusative: "Akk",
  dative: "Dat",
  genitive: "Gen",
};

export const GENDER_LABEL: Record<Gender, string> = {
  m: "masculine",
  f: "feminine",
  n: "neuter",
  pl: "plural",
};

/** The table every learner ends up memorising, kept here as the one copy. */
export const DEFINITE: Record<Case, Record<Gender, string>> = {
  nominative: { m: "der", f: "die", n: "das", pl: "die" },
  accusative: { m: "den", f: "die", n: "das", pl: "die" },
  dative: { m: "dem", f: "der", n: "dem", pl: "den" },
  genitive: { m: "des", f: "der", n: "des", pl: "der" },
};

export const ARTICLE_GENDER: Record<string, Gender> = { der: "m", die: "f", das: "n" };

export interface Reading {
  kasus: Case;
  gender: Gender;
}

const r = (kasus: Case, gender: Gender): Reading => ({ kasus, gender });

/** Definite articles, listed rather than derived: there are only six forms. */
const DEFINITE_FORMS: Record<string, Reading[]> = {
  der: [r("nominative", "m"), r("dative", "f"), r("genitive", "f"), r("genitive", "pl")],
  die: [r("nominative", "f"), r("accusative", "f"), r("nominative", "pl"), r("accusative", "pl")],
  das: [r("nominative", "n"), r("accusative", "n")],
  den: [r("accusative", "m"), r("dative", "pl")],
  dem: [r("dative", "m"), r("dative", "n")],
  des: [r("genitive", "m"), r("genitive", "n")],
};

/** ein, kein and the possessives: no ending in the masculine and neuter. */
const EIN_STEMS = ["ein", "kein", "mein", "dein", "sein", "ihr", "unser", "euer"];
const EIN_ENDINGS: Record<string, Reading[]> = {
  "": [r("nominative", "m"), r("nominative", "n"), r("accusative", "n")],
  e: [r("nominative", "f"), r("accusative", "f"), r("nominative", "pl"), r("accusative", "pl")],
  en: [r("accusative", "m"), r("dative", "pl")],
  em: [r("dative", "m"), r("dative", "n")],
  er: [r("dative", "f"), r("genitive", "f"), r("genitive", "pl")],
  es: [r("genitive", "m"), r("genitive", "n")],
};

/** dieser, jeder, welcher and friends take the definite article's endings. */
const DIES_STEMS = ["dies", "jed", "jen", "welch", "manch", "solch", "all"];
const DIES_ENDINGS: Record<string, Reading[]> = {
  er: [r("nominative", "m"), r("dative", "f"), r("genitive", "f"), r("genitive", "pl")],
  e: [r("nominative", "f"), r("accusative", "f"), r("nominative", "pl"), r("accusative", "pl")],
  es: [r("nominative", "n"), r("accusative", "n"), r("genitive", "m"), r("genitive", "n")],
  en: [r("accusative", "m"), r("dative", "pl")],
  em: [r("dative", "m"), r("dative", "n")],
};

/** Every case a determiner form could be carrying, or null if it is not one. */
export function readDeterminer(word: string): Reading[] | null {
  const w = word.toLowerCase();
  if (DEFINITE_FORMS[w]) return DEFINITE_FORMS[w];

  for (const stem of EIN_STEMS) {
    if (w.startsWith(stem)) {
      const ending = w.slice(stem.length);
      if (ending in EIN_ENDINGS) return EIN_ENDINGS[ending];
    }
  }
  for (const stem of DIES_STEMS) {
    if (w.startsWith(stem)) {
      const ending = w.slice(stem.length);
      if (ending in DIES_ENDINGS) return DIES_ENDINGS[ending];
    }
  }
  return null;
}

/** Prepositions that govern one case and never another. */
export const FIXED_CASE: Record<string, Case> = {
  durch: "accusative", für: "accusative", gegen: "accusative", ohne: "accusative",
  um: "accusative", bis: "accusative", wider: "accusative", entlang: "accusative",
  aus: "dative", außer: "dative", bei: "dative", mit: "dative", nach: "dative",
  seit: "dative", von: "dative", zu: "dative", gegenüber: "dative", ab: "dative",
  entgegen: "dative", gemäß: "dative", nebst: "dative", binnen: "dative",
  während: "genitive", wegen: "genitive", trotz: "genitive", statt: "genitive",
  anstatt: "genitive", innerhalb: "genitive", außerhalb: "genitive",
  oberhalb: "genitive", unterhalb: "genitive", aufgrund: "genitive",
  mittels: "genitive", angesichts: "genitive", hinsichtlich: "genitive",
  infolge: "genitive", zwecks: "genitive", jenseits: "genitive", diesseits: "genitive",
};

/** The nine that take either, depending on whether there is movement. */
export const TWO_WAY = new Set([
  "an", "auf", "hinter", "in", "neben", "über", "unter", "vor", "zwischen",
]);

/** A preposition and an article welded together, so both are pinned. */
export const CONTRACTIONS: Record<string, { preposition: string; article: string; kasus: Case; gender: Gender }> = {
  am: { preposition: "an", article: "dem", kasus: "dative", gender: "m" },
  ans: { preposition: "an", article: "das", kasus: "accusative", gender: "n" },
  im: { preposition: "in", article: "dem", kasus: "dative", gender: "m" },
  ins: { preposition: "in", article: "das", kasus: "accusative", gender: "n" },
  zum: { preposition: "zu", article: "dem", kasus: "dative", gender: "m" },
  zur: { preposition: "zu", article: "der", kasus: "dative", gender: "f" },
  beim: { preposition: "bei", article: "dem", kasus: "dative", gender: "m" },
  vom: { preposition: "von", article: "dem", kasus: "dative", gender: "m" },
  aufs: { preposition: "auf", article: "das", kasus: "accusative", gender: "n" },
  fürs: { preposition: "für", article: "das", kasus: "accusative", gender: "n" },
  vors: { preposition: "vor", article: "das", kasus: "accusative", gender: "n" },
  übers: { preposition: "über", article: "das", kasus: "accusative", gender: "n" },
  unterm: { preposition: "unter", article: "dem", kasus: "dative", gender: "m" },
  hinterm: { preposition: "hinter", article: "dem", kasus: "dative", gender: "m" },
};

export const stripPunctuation = (word: string) =>
  word.replace(/^[„"'»«(\[]+/u, "").replace(/[.,;:!?…"'»«)\]]+$/u, "");

export const normalise = (word: string) =>
  stripPunctuation(word).replace(/[^\p{L}\p{M}]/gu, "").toLowerCase();

/**
 * Why a word is in the case it is in. A key and its parts rather than a
 * sentence, because the sentence has to be sayable in more than one language.
 */
export type ReasonKey =
  | "contraction"
  | "fixedPreposition"
  | "twoWayResolved"
  | "twoWayUnmarked"
  | "determinerOnly"
  | "determinerLikely";

export interface CaseReason {
  key: ReasonKey;
  preposition?: string;
  article?: string;
  determiner?: string;
}

export interface CaseFinding {
  kasus: Case;
  gender?: Gender;
  /** The determiner that carries the ending, when there is one. */
  determiner?: string;
  /** The word that forces the case. */
  trigger?: string;
  triggerKind?: "preposition" | "two-way" | "contraction" | "determiner";
  reason: CaseReason;
  /** False when more than one reading survives and this is the likeliest. */
  certain: boolean;
  alternatives?: Case[];
}

const CLAUSE_END = /[,;:.!?]$/;

/**
 * Work out what case a word sits in, from the determiner and preposition in
 * front of it. Returns null rather than guessing when nothing marks it, which
 * is the honest answer for a bare noun like "in Ostsachsen".
 */
export function findCase(
  sentence: string,
  target: string,
  knownGender?: Gender,
): CaseFinding | null {
  const tokens = sentence.split(/\s+/).filter(Boolean);
  const wanted = normalise(target);
  if (!wanted) return null;

  let index = tokens.findIndex((t) => normalise(t) === wanted);
  // The text may hand us an inflected form of what the dictionary matched.
  if (index < 0) index = tokens.findIndex((t) => normalise(t).startsWith(wanted.slice(0, 5)));
  if (index < 1) return null;

  let determiner: string | undefined;
  let readings: Reading[] | null = null;
  let preposition: string | undefined;
  let contraction: (typeof CONTRACTIONS)[string] | undefined;

  for (let i = index - 1; i >= 0 && i >= index - 4; i--) {
    const raw = stripPunctuation(tokens[i]);
    const word = normalise(raw);
    if (!word) break;

    if (CONTRACTIONS[word]) {
      contraction = CONTRACTIONS[word];
      preposition = raw;
      break;
    }
    if (!determiner) {
      const read = readDeterminer(word);
      if (read) {
        determiner = raw;
        readings = read;
        // Keep walking: the preposition sits in front of the determiner.
        if (CLAUSE_END.test(tokens[i])) break;
        continue;
      }
    }
    if (FIXED_CASE[word] || TWO_WAY.has(word)) {
      preposition = raw;
      break;
    }
    // A clause boundary means anything further back governs something else.
    if (CLAUSE_END.test(tokens[i])) break;
  }

  const narrow = (list: Reading[]) =>
    knownGender ? list.filter((x) => x.gender === knownGender) : list;

  if (contraction) {
    return {
      kasus: contraction.kasus,
      gender: knownGender ?? contraction.gender,
      determiner: contraction.article,
      trigger: preposition,
      triggerKind: "contraction",
      reason: {
        key: "contraction",
        preposition: contraction.preposition,
        article: contraction.article,
        determiner: preposition,
      },
      certain: true,
    };
  }

  const prep = preposition ? normalise(preposition) : undefined;

  if (prep && FIXED_CASE[prep]) {
    const kasus = FIXED_CASE[prep];
    const genders = narrow(readings ?? []).filter((x) => x.kasus === kasus);
    return {
      kasus,
      gender: knownGender ?? (genders.length === 1 ? genders[0].gender : undefined),
      determiner,
      trigger: preposition,
      triggerKind: "preposition",
      reason: { key: "fixedPreposition", preposition },
      certain: true,
    };
  }

  if (prep && TWO_WAY.has(prep)) {
    const possible = narrow(readings ?? []).filter(
      (x) => x.kasus === "accusative" || x.kasus === "dative",
    );
    const cases = [...new Set(possible.map((x) => x.kasus))];
    if (cases.length === 1) {
      const kasus = cases[0];
      const genders = possible.filter((x) => x.kasus === kasus);
      return {
        kasus,
        gender: knownGender ?? (genders.length === 1 ? genders[0].gender : undefined),
        determiner,
        trigger: preposition,
        triggerKind: "two-way",
        reason: { key: "twoWayResolved", preposition, determiner },
        certain: true,
      };
    }
    if (determiner) {
      return {
        kasus: "accusative",
        determiner,
        trigger: preposition,
        triggerKind: "two-way",
        reason: { key: "twoWayUnmarked", preposition, determiner },
        certain: false,
        alternatives: ["dative"],
      };
    }
    return null;
  }

  if (readings && determiner) {
    const possible = narrow(readings);
    const cases = [...new Set(possible.map((x) => x.kasus))];
    if (cases.length === 1) {
      const genders = possible.filter((x) => x.kasus === cases[0]);
      return {
        kasus: cases[0],
        gender: knownGender ?? (genders.length === 1 ? genders[0].gender : undefined),
        determiner,
        triggerKind: "determiner",
        reason: { key: "determinerOnly", determiner },
        certain: true,
      };
    }
    // Ranked by what actually turns up in news prose in this position.
    const order: Case[] = ["nominative", "accusative", "dative", "genitive"];
    const first = order.find((c) => cases.includes(c));
    if (!first) return null;
    return {
      kasus: first,
      gender: knownGender,
      determiner,
      triggerKind: "determiner",
      reason: { key: "determinerLikely", determiner },
      certain: false,
      alternatives: cases.filter((c) => c !== first),
    };
  }

  return null;
}

/* ------------------------------------------------------------------ adjectives */

/**
 * Which set of adjective endings applies. German asks the adjective to carry
 * the case only when the determiner in front of it has not already done the
 * job, which is why the same adjective has three tables rather than one.
 */
export type Declension = "weak" | "mixed" | "strong";

export const ADJECTIVE_ENDINGS: Record<Declension, Record<Case, Record<Gender, string>>> = {
  // After der/die/das and its relatives: the article says everything, so the
  // adjective settles for -e or -en.
  weak: {
    nominative: { m: "-e", f: "-e", n: "-e", pl: "-en" },
    accusative: { m: "-en", f: "-e", n: "-e", pl: "-en" },
    dative: { m: "-en", f: "-en", n: "-en", pl: "-en" },
    genitive: { m: "-en", f: "-en", n: "-en", pl: "-en" },
  },
  // After ein/kein/mein: those have no ending in three slots, so the adjective
  // steps in for exactly those three.
  mixed: {
    nominative: { m: "-er", f: "-e", n: "-es", pl: "-en" },
    accusative: { m: "-en", f: "-e", n: "-es", pl: "-en" },
    dative: { m: "-en", f: "-en", n: "-en", pl: "-en" },
    genitive: { m: "-en", f: "-en", n: "-en", pl: "-en" },
  },
  // With no determiner at all the adjective carries the case on its own, which
  // is why these endings look like the definite article.
  strong: {
    nominative: { m: "-er", f: "-e", n: "-es", pl: "-e" },
    accusative: { m: "-en", f: "-e", n: "-es", pl: "-e" },
    dative: { m: "-em", f: "-er", n: "-em", pl: "-en" },
    genitive: { m: "-en", f: "-er", n: "-en", pl: "-er" },
  },
};

const EIN_WORD = new RegExp(`^(?:${EIN_STEMS.join("|")})(?:e|en|em|er|es)?$`);

/** The five endings an attributive adjective can wear, longest first. */
const ENDING_PATTERN = /(en|em|er|es|e)$/;

const GENDERS: Gender[] = ["m", "f", "n", "pl"];

export function declensionAfter(determiner?: string): Declension {
  if (!determiner) return "strong";
  const word = normalise(determiner);
  if (EIN_WORD.test(word)) return "mixed";
  return readDeterminer(word) ? "weak" : "strong";
}

export interface AdjectiveFinding {
  declension: Declension;
  kasus: Case;
  gender?: Gender;
  /** The ending the adjective is wearing, when it can be pinned down. */
  ending?: string;
  determiner?: string;
  /** The noun it is describing. */
  noun?: string;
  /** Why that case, so both halves of the answer can be given. */
  reason?: CaseReason;
}

/**
 * Why an adjective ends the way it does.
 *
 * This is the question German learners actually get stuck on, and it has an
 * exact answer in two steps: the determiner and the preposition fix the case,
 * and the determiner also decides which of the three ending tables applies.
 * Where the gender stays open but every candidate gives the same ending, the
 * ending is still certain and is reported without naming a gender.
 */
export function findAdjective(sentence: string, adjective: string): AdjectiveFinding | null {
  const tokens = sentence.split(/\s+/).filter(Boolean);
  const wanted = normalise(adjective);
  if (!wanted) return null;

  let index = tokens.findIndex((t) => normalise(t) === wanted);
  if (index < 0) {
    const stem = wanted.replace(/(e|en|em|er|es)$/, "");
    index = tokens.findIndex((t) => stem.length > 2 && normalise(t).startsWith(stem));
  }
  if (index < 0) return null;

  // An adjective sits in front of the noun it describes.
  let noun: string | undefined;
  for (let i = index + 1; i < tokens.length && i <= index + 3; i++) {
    const raw = stripPunctuation(tokens[i]);
    if (/^\p{Lu}/u.test(raw)) {
      noun = raw;
      break;
    }
  }

  // The determiner in front settles both the case and which table applies.
  let determiner: string | undefined;
  for (let i = index - 1; i >= 0 && i >= index - 3; i--) {
    const raw = stripPunctuation(tokens[i]);
    const word = normalise(raw);
    if (CONTRACTIONS[word]) {
      determiner = CONTRACTIONS[word].article;
      break;
    }
    if (readDeterminer(word)) {
      determiner = raw;
      break;
    }
    if (FIXED_CASE[word] || TWO_WAY.has(word)) break;
  }

  const finding = noun ? findCase(sentence, noun) : null;
  if (!finding) return null;

  const declension = declensionAfter(determiner);
  const table = ADJECTIVE_ENDINGS[declension][finding.kasus];

  // Narrow the gender as far as the determiner allows.
  let candidates: Gender[] = finding.gender
    ? [finding.gender]
    : determiner
      ? [...new Set((readDeterminer(normalise(determiner)) ?? [])
          .filter((r) => r.kasus === finding.kasus)
          .map((r) => r.gender))]
      : [];
  if (!candidates.length) candidates = [...GENDERS];

  // The adjective is wearing its own answer. Where the ending it actually has
  // is one the table allows here, it settles what the determiner left open:
  // "ein kleines Haus" can only be neuter, and "versuchten Angriffen" after a
  // dative preposition can only be plural.
  const worn = ENDING_PATTERN.exec(normalise(adjective))?.[1];
  const allowed = candidates.filter((g) => worn && table[g] === `-${worn}`);
  if (allowed.length) candidates = allowed;

  const endings = new Set(candidates.map((g) => table[g]));

  return {
    declension,
    kasus: finding.kasus,
    gender: candidates.length === 1 ? candidates[0] : undefined,
    ending: endings.size === 1 ? [...endings][0] : undefined,
    determiner,
    noun,
    reason: finding.reason,
  };
}
