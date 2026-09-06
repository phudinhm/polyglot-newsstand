import type { Case, CaseFinding, CaseReason, Declension, Gender } from "./cases";
import { CASE_GERMAN } from "./cases";
import type { NoteKey, SentenceNote, WordNote } from "./grammar";
import type { TargetLang } from "./types";

/**
 * The grammar, said out loud, in the language the reader is reading in.
 *
 * The analysis modules deal in facts: this case, that preposition, this
 * ending. Turning a fact into a sentence is a separate job, and it has to be
 * done once per language rather than once. A reader who has the app set to
 * Vietnamese is reading German through Vietnamese, and an English explanation
 * in the middle of that is one more language to work through.
 *
 * German case names are kept as they are in both languages. Every course a
 * German learner will ever take calls them Nominativ, Akkusativ, Dativ and
 * Genitiv, and translating them only makes the textbook harder to follow.
 */

const CASE_EN: Record<Case, string> = {
  nominative: "nominative",
  accusative: "accusative",
  dative: "dative",
  genitive: "genitive",
};

/** English names the case and puts the German alongside; Vietnamese uses the German. */
export function caseLabel(kasus: Case, lang: TargetLang): string {
  return lang === "vi" ? CASE_GERMAN[kasus] : `${CASE_EN[kasus]} (${CASE_GERMAN[kasus]})`;
}

export const GENDER_TEXT: Record<TargetLang, Record<Gender, string>> = {
  en: { m: "masculine", f: "feminine", n: "neuter", pl: "plural" },
  vi: { m: "giống đực", f: "giống cái", n: "giống trung", pl: "số nhiều" },
};

export const DECLENSION_TEXT: Record<TargetLang, Record<Declension, string>> = {
  en: { weak: "weak", mixed: "mixed", strong: "strong" },
  vi: { weak: "yếu", mixed: "hỗn hợp", strong: "mạnh" },
};

const POSSESSIVE_TEXT: Record<TargetLang, Record<string, string>> = {
  en: {
    mein: "my", dein: "your", sein: "his or its", ihr: "her, its or their",
    unser: "our", euer: "your (plural)",
  },
  vi: {
    mein: "của tôi", dein: "của bạn", sein: "của anh ấy hoặc của nó",
    ihr: "của cô ấy, của nó hoặc của họ", unser: "của chúng tôi", euer: "của các bạn",
  },
};

/* ------------------------------------------------------------------ the case */

export function caseReason(reason: CaseReason, kasus: Case, lang: TargetLang): string {
  const c = caseLabel(kasus, lang);
  const { preposition = "", article = "", determiner = "" } = reason;

  if (lang === "vi") {
    switch (reason.key) {
      case "contraction":
        return `${determiner} là ${preposition} + ${article} viết dính vào nhau, và ${article} là ${c}.`;
      case "fixedPreposition":
        return `${preposition} luôn đi với ${c}, không phụ thuộc vào câu.`;
      case "twoWayResolved":
        return determiner
          ? `${preposition} đi được với cả hai cách. Ở đây ${determiner} là ${c}, nên đây là ${
              kasus === "accusative" ? "hướng mà hành động đi tới" : "nơi sự việc đang ở"
            }.`
          : `Ở đây ${preposition} đi với ${c}.`;
      case "twoWayUnmarked":
        return `${preposition} đi được với cả hai cách, mà ${determiner} thì giống nhau ở cả hai, nên nghĩa của động từ mới quyết định: Akkusativ khi có chuyển động tới, Dativ khi đứng yên một chỗ.`;
      case "determinerOnly":
        return `${determiner} chỉ có thể là ${c}, nên không cần giới từ nào cũng biết.`;
      case "determinerLikely":
        return `${determiner} giống hệt nhau ở nhiều cách, nên đây là cách dễ xảy ra nhất chứ chưa chắc chắn.`;
    }
  }

  switch (reason.key) {
    case "contraction":
      return `${determiner} is ${preposition} + ${article} welded together, and ${article} is the ${c}.`;
    case "fixedPreposition":
      return `${preposition} always takes the ${c}, whatever the sentence is doing.`;
    case "twoWayResolved":
      return determiner
        ? `${preposition} can take either case. ${determiner} is the ${c} here, so this is ${
            kasus === "accusative" ? "a direction the action moves toward" : "a place where something already is"
          }.`
        : `${preposition} takes the ${c} here.`;
    case "twoWayUnmarked":
      return `${preposition} takes either case, and ${determiner} is the same in both, so the meaning of the verb decides: accusative for movement toward, dative for staying put.`;
    case "determinerOnly":
      return `${determiner} can only be the ${c}, so that settles it with no preposition in sight.`;
    case "determinerLikely":
      return `${determiner} is the same form in more than one case, so this is the likeliest reading rather than the only one.`;
  }
}

export const caseFindingText = (finding: CaseFinding, lang: TargetLang) =>
  caseReason(finding.reason, finding.kasus, lang);

/* ------------------------------------------------------------- word by word */

const ROLE_TEXT: Record<TargetLang, Record<NoteKey, string>> = {
  en: {
    separablePrefix: "Separable prefix",
    contraction: "Contraction",
    fixedPair: "Part of a fixed pair",
    twoWayResolved: "Two-way preposition",
    twoWayUnmarked: "Two-way preposition",
    twoWayGeneric: "Two-way preposition",
    preposition: "Preposition",
    possessive: "Possessive",
    reflexive: "Reflexive pronoun",
    modal: "Modal verb",
    auxiliary: "Auxiliary verb",
    infinitiveMarker: "Infinitive marker",
    purposeMarker: "Infinitive clause",
    intensifier: "Intensifier",
    copula: "Main verb",
    fullVerbHaben: "Main verb",
    fullVerbWerden: "Main verb",
    auxiliaryPerfect: "Perfect auxiliary",
    auxiliaryPassive: "Passive auxiliary",
    auxiliaryFuture: "Future auxiliary",
  },
  vi: {
    separablePrefix: "Tiền tố tách rời",
    contraction: "Dạng rút gọn",
    fixedPair: "Một phần của cụm cố định",
    twoWayResolved: "Giới từ hai cách",
    twoWayUnmarked: "Giới từ hai cách",
    twoWayGeneric: "Giới từ hai cách",
    preposition: "Giới từ",
    possessive: "Sở hữu",
    reflexive: "Đại từ phản thân",
    modal: "Động từ khuyết thiếu",
    auxiliary: "Trợ động từ",
    infinitiveMarker: "Dấu hiệu nguyên thể",
    purposeMarker: "Mệnh đề nguyên thể",
    intensifier: "Từ nhấn mạnh",
    copula: "Động từ chính",
    fullVerbHaben: "Động từ chính",
    fullVerbWerden: "Động từ chính",
    auxiliaryPerfect: "Trợ động từ thì hoàn thành",
    auxiliaryPassive: "Trợ động từ bị động",
    auxiliaryFuture: "Trợ động từ tương lai",
  },
};

export const noteRole = (note: WordNote, lang: TargetLang) => ROLE_TEXT[lang][note.key];

export function noteDetail(note: WordNote, lang: TargetLang): string {
  const c = note.kasus ? caseLabel(note.kasus, lang) : "";

  if (lang === "vi") {
    switch (note.key) {
      case "separablePrefix":
        return note.verb
          ? note.infinitive
            ? `Ở đây không phải giới từ: đây là nửa đầu của ${note.infinitive}, bị tách ra và để ở cuối câu. Hãy đọc chung với ${note.verb}.`
            : `Ở đây không phải giới từ: nó thuộc về ${note.verb} ở đầu mệnh đề, vì tiếng Đức tách động từ ra làm đôi.`
          : "Ở đây không phải giới từ: đây là một nửa của động từ tách rời, nằm ở cuối mệnh đề.";
      case "contraction":
        return `${note.preposition} + ${note.article} gộp thành một từ, nên danh từ đứng sau ở ${c}.`;
      case "fixedPair":
        return `${note.lemma} là một cụm cố định và đi với ${c}. Ở đây ${note.word} không mang nghĩa riêng, đừng dịch tách ra.`;
      case "twoWayResolved":
        return note.reason && note.kasus ? caseReason(note.reason, note.kasus, lang) : "";
      case "twoWayUnmarked":
        return `Akkusativ khi có chuyển động tới, Dativ khi đứng yên. Trước ${note.noun} không có gì đánh dấu, nên nghĩa của động từ quyết định.`;
      case "twoWayGeneric":
        return "Akkusativ khi có chuyển động tới đó, Dativ khi đã ở sẵn đó.";
      case "preposition":
        return `Luôn đi với ${c}${note.determiner && note.noun ? `: ${note.word} ${note.determiner} ${note.noun}` : ""}.`;
      case "possessive":
        return `${POSSESSIVE_TEXT.vi[note.person ?? ""] ?? ""} - đuôi của nó hợp với danh từ đứng sau, không phải với người sở hữu.`;
      case "reflexive":
        return "Động từ quay hành động trở lại chính chủ ngữ.";
      case "modal":
        return "Đẩy động từ chính, ở dạng nguyên thể, xuống cuối mệnh đề.";
      case "auxiliary":
        return "Mang thì của câu; động từ chính đợi ở cuối dưới dạng phân từ hoặc nguyên thể.";
      case "infinitiveMarker":
        return `Ở đây không phải giới từ. zu + nguyên thể tạo thành dạng nguyên thể có zu, nên hãy đọc chung với ${note.verb ?? "động từ đứng sau"}.`;
      case "purposeMarker":
        return `${note.lemma ?? "Từ này"} mở đầu một mệnh đề nguyên thể, không dẫn một danh từ. Mệnh đề đó mượn chủ ngữ của mệnh đề chính.`;
      case "intensifier":
        return "Ở đây zu nghĩa là quá, đi với tính từ hoặc trạng từ, không phải giới từ.";
      case "copula":
        return "Ở đây sein là động từ chính, nối chủ ngữ với phần đứng sau. Không có phân từ nào ở cuối để nó mang.";
      case "fullVerbHaben":
        return "Ở đây haben là động từ chính, nghĩa là có. Không có phân từ nào ở cuối để nó mang.";
      case "fullVerbWerden":
        return "Ở đây werden là động từ chính, nghĩa là trở nên. Không phải bị động cũng không phải tương lai.";
      case "auxiliaryPerfect":
        return `Tạo thì hoàn thành; phân từ ${note.verb ?? ""} nằm ở cuối mệnh đề.`.replace("  ", " ");
      case "auxiliaryPassive":
        return `Làm câu thành bị động; phân từ ${note.verb ?? ""} nằm ở cuối, và người thực hiện có thể không được nhắc tới.`.replace("  ", " ");
      case "auxiliaryFuture":
        return `Chỉ tương lai hoặc một phỏng đoán; nguyên thể ${note.verb ?? ""} nằm ở cuối.`.replace("  ", " ");
    }
  }

  switch (note.key) {
    case "separablePrefix":
      return note.verb
        ? note.infinitive
          ? `Not a preposition here: it is the front half of ${note.infinitive}, split off and parked at the end. Read it together with ${note.verb}.`
          : `Not a preposition here: it belongs to ${note.verb} at the front of the clause, which German splits in two.`
        : "Not a preposition here: it is half of a separable verb, parked at the end of its clause.";
    case "contraction":
      return `${note.preposition} + ${note.article} in one word, so the noun behind it is ${c}.`;
    case "fixedPair":
      return `${note.lemma} is a fixed pair, and it takes the ${c}. ${note.word} carries no meaning of its own here, so do not translate it separately.`;
    case "twoWayResolved":
      return note.reason && note.kasus ? caseReason(note.reason, note.kasus, lang) : "";
    case "twoWayUnmarked":
      return `Accusative for movement toward, dative for staying put. Nothing in front of ${note.noun} marks which, so the meaning of the verb decides.`;
    case "twoWayGeneric":
      return "Accusative when something moves there, dative when it is already there.";
    case "preposition":
      return `Always takes the ${c}${note.determiner && note.noun ? `: ${note.word} ${note.determiner} ${note.noun}` : ""}.`;
    case "possessive":
      return `${POSSESSIVE_TEXT.en[note.person ?? ""] ?? ""} - its ending agrees with the noun that follows, not with the owner.`;
    case "reflexive":
      return "The verb turns its action back on the subject.";
    case "modal":
      return "Sends the main verb, as an infinitive, to the end of the clause.";
    case "auxiliary":
      return "Carries the tense; the main verb waits at the end as a participle or infinitive.";
    case "infinitiveMarker":
      return `Not a preposition here. zu plus an infinitive is what makes an infinitive, so read it together with ${note.verb ?? "the verb behind it"}.`;
    case "purposeMarker":
      return `${note.lemma ?? "This word"} opens an infinitive clause rather than taking a noun. That clause borrows its subject from the clause it hangs off.`;
    case "intensifier":
      return "Here zu means too, in front of an adjective or an adverb. It is not the preposition.";
    case "copula":
      return "Here sein is the main verb, linking the subject to what follows. There is no participle at the end for it to carry.";
    case "fullVerbHaben":
      return "Here haben is the main verb, meaning to have. There is no participle at the end for it to carry.";
    case "fullVerbWerden":
      return "Here werden is the main verb, meaning to become. Neither passive nor future.";
    case "auxiliaryPerfect":
      return `Forms the perfect tense; the participle ${note.verb ?? ""} sits at the end of the clause.`.replace("  ", " ");
    case "auxiliaryPassive":
      return `Makes this passive; the participle ${note.verb ?? ""} sits at the end, and the actor may go unnamed.`.replace("  ", " ");
    case "auxiliaryFuture":
      return `Marks the future or a supposition; the infinitive ${note.verb ?? ""} sits at the end.`.replace("  ", " ");
  }
}

/**
 * The lookup panel's own words. This panel is entirely a language lesson, so
 * its labels travel with the explanations rather than with the app chrome:
 * a Vietnamese explanation under an English heading reads like a seam.
 */
export const LOOKUP_TEXT: Record<TargetLang, Record<string, string>> = {
  en: {
    looking: "Looking up…",
    nothing: "Nothing found for that word. Try tapping the whole line instead.",
    inUse: "In use",
    usedWith: "Often used with",
    showMore: "Show more",
    save: "Save word",
    saved: "Saved",
    inflected: "inflected form",
    plural: "plural",
    singular: "singular",
    fullEntry: "Full entry on Wiktionary",
  },
  vi: {
    looking: "Đang tra…",
    nothing: "Không tìm thấy từ này. Thử chạm vào cả dòng xem sao.",
    inUse: "Dùng trong câu",
    usedWith: "Hay đi cùng",
    showMore: "Xem thêm",
    save: "Lưu từ",
    saved: "Đã lưu",
    inflected: "dạng biến đổi",
    plural: "số nhiều",
    singular: "số ít",
    fullEntry: "Xem đầy đủ trên Wiktionary",
  },
};

/* ------------------------------------------------- the sentence as a whole */

export function sentenceNoteText(note: SentenceNote, lang: TargetLang): string {
  if (lang === "vi") {
    switch (note.key) {
      case "passive":
        return "Bị động: werden cộng phân từ hai, nên người thực hiện có thể không được nhắc tới.";
      case "reported":
        return "Lời dẫn gián tiếp: Konjunktiv I đánh dấu đây là lời của người khác, không phải của tòa báo.";
      case "relative":
        return "Mệnh đề quan hệ mô tả danh từ ngay trước nó, và động từ của nó nằm cuối.";
      case "subordinate":
        return "Trong mệnh đề phụ, động từ chia chuyển xuống cuối.";
      case "purpose":
        return "um … zu diễn đạt mục đích: để mà.";
      case "infinitiveWithConnector":
        return `${note.connector} mở một mệnh đề nguyên thể, mệnh đề này không có chủ ngữ riêng.`;
      case "infinitiveBare":
        return "Mệnh đề nguyên thể không có chủ ngữ riêng: nó mượn chủ ngữ của mệnh đề mà nó phụ thuộc.";
    }
  }

  switch (note.key) {
    case "passive":
      return "Passive: werden plus a past participle, so the actor may be unnamed.";
    case "reported":
      return "Reported speech: Konjunktiv I marks this as someone's claim, not the paper's.";
    case "relative":
      return "A relative clause describes the noun just before it, and its verb comes last.";
    case "subordinate":
      return "In a subordinate clause the finite verb moves to the end.";
    case "purpose":
      return "um … zu introduces a purpose: in order to.";
    case "infinitiveWithConnector":
      return `${note.connector} opens an infinitive clause, which has no subject of its own.`;
    case "infinitiveBare":
      return "The infinitive clause has no subject of its own: it takes the one from the clause it hangs off.";
  }
}
