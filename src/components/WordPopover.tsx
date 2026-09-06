"use client";

import { useEffect, useState } from "react";
import { addVocab, hasVocab } from "@/lib/store";
import type { SourceLang, TargetLang } from "@/lib/types";
import { CheckIcon, CloseIcon, PlusIcon, SpinnerIcon } from "./Icons";

export interface WordQuery {
  word: string;
  sentence: string;
  x: number;
  y: number;
}

interface Props {
  query: WordQuery;
  lang: SourceLang;
  target: TargetLang;
  articleTitle?: string;
  articleUrl?: string;
  /** Sentence translation, if the reader already revealed it. */
  sentenceTranslation?: string;
  onClose: () => void;
}

export function WordPopover({
  query,
  lang,
  target,
  articleTitle,
  articleUrl,
  sentenceTranslation,
  onClose,
}: Props) {
  const [meaning, setMeaning] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSaved(hasVocab(query.word, lang));
  }, [query.word, lang]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    setMeaning(null);

    (async () => {
      try {
        const res = await fetch("/api/translate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ texts: [query.word], source: lang, target }),
        });
        if (!res.ok) throw new Error("lookup failed");
        const json = (await res.json()) as { translations: string[] };
        if (!cancelled) setMeaning(json.translations[0] ?? "");
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [query.word, lang, target]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function save() {
    addVocab({
      term: query.word,
      translation: meaning ?? "",
      context: query.sentence,
      contextTranslation: sentenceTranslation,
      lang,
      target,
      articleTitle,
      articleUrl,
    });
    setSaved(true);
  }

  // Anchored to the tapped word on a wide screen, a bottom sheet on a phone.
  // The inline coordinates have to stay off on mobile, or they would override
  // the sheet positioning from the class list and push the card off screen.
  const [anchor, setAnchor] = useState<React.CSSProperties | undefined>(undefined);
  useEffect(() => {
    if (window.innerWidth < 640) {
      setAnchor(undefined);
      return;
    }
    const CARD_WIDTH = 304;
    const CARD_HEIGHT = 260;
    setAnchor({
      left: Math.min(Math.max(query.x - CARD_WIDTH / 2, 16), window.innerWidth - CARD_WIDTH - 16),
      top: Math.min(query.y + 14, window.innerHeight - CARD_HEIGHT),
    });
  }, [query.x, query.y]);

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-label={`Meaning of ${query.word}`}
        style={anchor}
        className="fixed inset-x-3 bottom-3 z-50 w-auto rounded-xl border border-border bg-surface p-4 shadow-[var(--shadow)] sm:inset-auto sm:w-[19rem]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold" lang={lang}>
              {query.word}
            </p>
            <p className="mt-0.5 text-[11px] uppercase tracking-wide text-muted">
              {lang === "de" ? "German" : lang === "vi" ? "Vietnamese" : "English"} →{" "}
              {target === "vi" ? "Vietnamese" : "English"}
            </p>
          </div>
          <button type="button" onClick={onClose} className="btn px-1.5 py-1" aria-label="Close">
            <CloseIcon width={16} height={16} />
          </button>
        </div>

        <div className="mt-3 min-h-[1.5rem] text-[15px]">
          {loading && (
            <span className="flex items-center gap-2 text-muted">
              <SpinnerIcon width={15} height={15} /> Looking up…
            </span>
          )}
          {!loading && failed && (
            <span className="text-muted">No meaning found. Try the whole sentence instead.</span>
          )}
          {!loading && !failed && <span className="text-translation">{meaning || "—"}</span>}
        </div>

        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted" lang={lang}>
          {query.sentence}
        </p>

        <button
          type="button"
          onClick={save}
          disabled={saved || loading}
          className={`btn mt-3 w-full ${saved ? "" : "btn-primary"}`}
        >
          {saved ? (
            <>
              <CheckIcon width={16} height={16} /> In your vocabulary
            </>
          ) : (
            <>
              <PlusIcon width={16} height={16} /> Save word
            </>
          )}
        </button>
      </div>
    </>
  );
}
