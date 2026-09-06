"use client";

import { analyseSentence, CLAUSE_GERMAN, type Clause } from "@/lib/grammar";
import { noteDetail, noteRole } from "@/lib/explain";
import type { SourceLang, TargetLang } from "@/lib/types";
import { CloseIcon } from "./Icons";

const KIND_LABEL: Record<TargetLang, Record<Clause["kind"], string>> = {
  en: {
    main: "Main clause",
    subordinate: "Subordinate clause",
    relative: "Relative clause",
    infinitive: "Infinitive clause",
  },
  vi: {
    main: "Mệnh đề chính",
    subordinate: "Mệnh đề phụ",
    relative: "Mệnh đề quan hệ",
    infinitive: "Mệnh đề nguyên thể",
  },
};

/** The panel's own words, which have to travel with the explanations. */
const UI = {
  en: {
    title: "Sentence structure",
    onlyGerman:
      "Clause analysis is only available for German, where word order is the thing that trips readers up.",
    introducedBy: "introduced by",
    finiteVerb: "finite verb",
    atTheEnd: "at the end",
    inSecond: "in second position",
    words: "Words doing grammatical work",
    caveat:
      "This is an outline, not a full parse. It works from German word order and closed word classes, so it is reliable about clause boundaries and less so about unusual constructions.",
  },
  vi: {
    title: "Cấu trúc câu",
    onlyGerman:
      "Phần phân tích mệnh đề chỉ có cho tiếng Đức, nơi trật tự từ là thứ hay làm người đọc vấp.",
    introducedBy: "mở đầu bằng",
    finiteVerb: "động từ chia",
    atTheEnd: "ở cuối",
    inSecond: "ở vị trí thứ hai",
    words: "Những từ đang làm nhiệm vụ ngữ pháp",
    caveat:
      "Đây là bản phác, không phải phân tích cú pháp đầy đủ. Nó dựa vào trật tự từ tiếng Đức và các nhóm từ đóng, nên đáng tin về ranh giới mệnh đề và kém chắc hơn với những cấu trúc lạ.",
  },
} as const;

const KIND_TONE: Record<Clause["kind"], string> = {
  main: "border-l-accent",
  subordinate: "border-l-[color-mix(in_srgb,var(--translation)_70%,transparent)]",
  relative: "border-l-[color-mix(in_srgb,#6b6a86_70%,transparent)]",
  infinitive: "border-l-muted",
};

/**
 * Where a long German sentence hinges.
 *
 * News prose nests relative clauses inside subordinate clauses and moves the
 * verb somewhere an English-trained eye does not look. Naming the parts is
 * usually enough to get unstuck, so this shows the skeleton rather than
 * attempting a full parse it could get confidently wrong.
 */
export function SentenceStructure({
  sentence,
  lang,
  target,
  onClose,
}: {
  sentence: string;
  lang: SourceLang;
  /** Explanations follow the language the reader is translating into. */
  target: TargetLang;
  onClose: () => void;
}) {
  const structure = analyseSentence(sentence, lang);
  const ui = UI[target];

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/35 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-label="Sentence structure"
        className="fixed inset-x-3 bottom-3 z-50 max-h-[80vh] overflow-y-auto rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow)] sm:inset-x-auto sm:left-1/2 sm:bottom-auto sm:top-1/2 sm:w-[34rem] sm:-translate-x-1/2 sm:-translate-y-1/2"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-[15px] font-semibold">{ui.title}</h2>
          <button type="button" onClick={onClose} className="btn !px-1.5 !py-1.5" aria-label="Close">
            <CloseIcon width={16} height={16} />
          </button>
        </div>

        {structure.trivial ? (
          <p className="mt-3 text-[13.5px] leading-relaxed text-muted">{ui.onlyGerman}</p>
        ) : (
          <>
            <div className="mt-3 space-y-2">
              {structure.clauses.map((clause, i) => (
                <div
                  key={i}
                  className={`rounded-r-lg border-l-[3px] bg-surface-2 py-2 pl-3 pr-3 ${KIND_TONE[clause.kind]}`}
                >
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
                    <span className="font-semibold uppercase tracking-wide">
                      {KIND_LABEL[target][clause.kind]}
                    </span>
                    <span lang="de" className="italic">
                      {CLAUSE_GERMAN[clause.kind]}
                    </span>
                    {clause.connector && (
                      <span>
                        {ui.introducedBy}{" "}
                        <span className="font-medium text-fg">{clause.connector}</span>
                      </span>
                    )}
                    {clause.finiteVerb && (
                      <span>
                        {ui.finiteVerb} <span className="font-medium text-fg">{clause.finiteVerb}</span>{" "}
                        {clause.verbPosition === "final" ? ui.atTheEnd : ui.inSecond}
                      </span>
                    )}
                  </div>
                  <p className="reading mt-1 !max-w-none !text-[15px] !leading-relaxed" lang={lang}>
                    {clause.text}
                  </p>
                </div>
              ))}
            </div>

            {structure.words.length > 0 && (
              <div className="mt-3 border-t border-border pt-3">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                  {ui.words}
                </h3>
                <ul className="mt-1.5 space-y-1.5">
                  {structure.words.map((note, i) => (
                    <li key={i} className="flex flex-wrap items-baseline gap-x-2 text-[13px]">
                      <span className="font-semibold" lang="de">
                        {note.word}
                      </span>
                      <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10.5px] text-muted">
                        {noteRole(note, target)}
                      </span>
                      <span className="text-muted">{noteDetail(note, target)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {structure.notes.length > 0 && (
              <ul className="mt-3 space-y-1.5 border-t border-border pt-3">
                {structure.notes.map((note, i) => (
                  <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-muted">
                    <span aria-hidden className="text-accent">
                      ·
                    </span>
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            )}

            <p className="mt-3 border-t border-border pt-2.5 text-[11.5px] leading-relaxed text-muted">
              {ui.caveat}
            </p>
          </>
        )}
      </div>
    </>
  );
}
