"use client";

import { analyseSentence, CLAUSE_GERMAN, type Clause } from "@/lib/grammar";
import type { SourceLang } from "@/lib/types";
import { CloseIcon } from "./Icons";

const KIND_LABEL: Record<Clause["kind"], string> = {
  main: "Main clause",
  subordinate: "Subordinate clause",
  relative: "Relative clause",
  infinitive: "Infinitive clause",
};

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
  onClose,
}: {
  sentence: string;
  lang: SourceLang;
  onClose: () => void;
}) {
  const structure = analyseSentence(sentence, lang);

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/35 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-label="Sentence structure"
        className="fixed inset-x-3 bottom-3 z-50 max-h-[80vh] overflow-y-auto rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow)] sm:inset-x-auto sm:left-1/2 sm:bottom-auto sm:top-1/2 sm:w-[34rem] sm:-translate-x-1/2 sm:-translate-y-1/2"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-[15px] font-semibold">Sentence structure</h2>
          <button type="button" onClick={onClose} className="btn !px-1.5 !py-1.5" aria-label="Close">
            <CloseIcon width={16} height={16} />
          </button>
        </div>

        {structure.trivial ? (
          <p className="mt-3 text-[13.5px] leading-relaxed text-muted">
            Clause analysis is only available for German, where word order is the thing that trips
            readers up.
          </p>
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
                      {KIND_LABEL[clause.kind]}
                    </span>
                    <span lang="de" className="italic">
                      {CLAUSE_GERMAN[clause.kind]}
                    </span>
                    {clause.connector && (
                      <span>
                        introduced by <span className="font-medium text-fg">{clause.connector}</span>
                      </span>
                    )}
                    {clause.finiteVerb && (
                      <span>
                        finite verb <span className="font-medium text-fg">{clause.finiteVerb}</span>
                        {clause.verbPosition === "final" ? " at the end" : " in second position"}
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
                  Words doing grammatical work
                </h3>
                <ul className="mt-1.5 space-y-1.5">
                  {structure.words.map((note, i) => (
                    <li key={i} className="flex flex-wrap items-baseline gap-x-2 text-[13px]">
                      <span className="font-semibold" lang="de">
                        {note.word}
                      </span>
                      <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10.5px] text-muted">
                        {note.role}
                      </span>
                      <span className="text-muted">{note.detail}</span>
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
              This is an outline, not a full parse. It works from German word order and closed word
              classes, so it is reliable about clause boundaries and less so about unusual
              constructions.
            </p>
          </>
        )}
      </div>
    </>
  );
}
