"use client";

import { useEffect, useState } from "react";
import { addVocab, hasVocab } from "@/lib/store";
import { speak, speechSupported } from "@/lib/tts";
import { useSettings } from "@/hooks/useSettings";
import type { DictionaryEntry } from "@/lib/dictionary";
import type { SourceLang, TargetLang } from "@/lib/types";
import { CheckIcon, CloseIcon, ExternalIcon, PlusIcon, SpeakerIcon, SpinnerIcon } from "./Icons";
import { CaseCard } from "./CaseCard";
import { LOOKUP_TEXT } from "@/lib/explain";

export interface WordQuery {
  word: string;
  sentence: string;
  x: number;
  y: number;
}

type Entry = DictionaryEntry & { translation?: string };

interface Props {
  query: WordQuery;
  lang: SourceLang;
  target: TargetLang;
  articleTitle?: string;
  articleUrl?: string;
  sentenceTranslation?: string;
  onClose: () => void;
}

const ARTICLE_TONE: Record<string, string> = {
  der: "bg-[color-mix(in_srgb,#4d6079_22%,transparent)] text-[#5b7ba6]",
  die: "bg-[color-mix(in_srgb,#8a5a4a_22%,transparent)] text-[#b5705c]",
  das: "bg-[color-mix(in_srgb,#4f6d63_22%,transparent)] text-[#5f9382]",
};

export function WordPopover({
  query,
  lang,
  target,
  articleTitle,
  articleUrl,
  sentenceTranslation,
  onClose,
}: Props) {
  const [settings] = useSettings();
  const [entry, setEntry] = useState<Entry | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setSaved(hasVocab(query.word, lang));
  }, [query.word, lang]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    setEntry(null);
    setExpanded(false);

    (async () => {
      try {
        const res = await fetch(
          `/api/dictionary?word=${encodeURIComponent(query.word)}&lang=${lang}&target=${target}`,
        );
        if (!res.ok) throw new Error("lookup failed");
        if (!cancelled) setEntry((await res.json()) as Entry);
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
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Anchored to the tapped word on a wide screen, a bottom sheet on a phone.
  const [anchor, setAnchor] = useState<React.CSSProperties | undefined>(undefined);
  useEffect(() => {
    if (window.innerWidth < 640) {
      setAnchor(undefined);
      return;
    }
    const WIDTH = 340;
    const HEIGHT = 460;
    setAnchor({
      left: Math.min(Math.max(query.x - WIDTH / 2, 16), window.innerWidth - WIDTH - 16),
      top: Math.min(query.y + 14, Math.max(16, window.innerHeight - HEIGHT)),
    });
  }, [query.x, query.y]);

  const headword = entry?.lemma ?? entry?.word ?? query.word;

  // What kind of word this is decides which lesson is worth giving. An
  // adjective has no gender of its own, so the article table would be an
  // answer to a question nobody asked.
  const ui = LOOKUP_TEXT[target];

  const partsOfSpeech = (entry?.senses ?? []).map((sense) => sense.partOfSpeech.toLowerCase());
  const isNoun = partsOfSpeech.some((p) => /substantiv|eigenname|noun|name/.test(p));
  const isAdjective =
    !isNoun && partsOfSpeech.some((p) => /adjektiv|adjective|partizip|participle/.test(p));
  const meaning =
    entry?.senses.flatMap((s) => s.definitions)[0] ?? entry?.translation ?? "";

  function save() {
    addVocab({
      term: headword,
      translation: entry?.translation || meaning,
      context: query.sentence,
      contextTranslation: sentenceTranslation,
      lang,
      target,
      articleTitle,
      articleUrl,
    });
    setSaved(true);
  }

  const visibleSenses = expanded ? entry?.senses ?? [] : (entry?.senses ?? []).slice(0, 2);

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-label={`Dictionary entry for ${query.word}`}
        style={anchor}
        className="fixed inset-x-3 bottom-3 z-50 max-h-[70vh] w-auto overflow-y-auto rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow)] sm:inset-auto sm:w-[22.5rem] sm:max-h-[30rem]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              {entry?.article && !isAdjective && (
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[12px] font-semibold ${
                    ARTICLE_TONE[entry.article] ?? "bg-surface-2 text-muted"
                  }`}
                >
                  {entry.article}
                </span>
              )}
              <span className="text-[17px] font-semibold" lang={lang}>
                {headword}
              </span>
              {entry?.ipa && (
                <span className="text-[13px] text-muted" aria-label="pronunciation">
                  [{entry.ipa}]
                </span>
              )}
            </div>

            {entry?.lemma && entry.lemma !== query.word && (
              <p className="mt-0.5 text-[11.5px] text-muted">
                {query.word}
                {entry.inflectionNote ? ` · ${entry.inflectionNote}` : ` · ${ui.inflected}`}
              </p>
            )}

            {entry?.plural && (
              <p className="mt-0.5 text-[11.5px] text-muted">
                {ui.plural}: <span className="font-medium text-fg">{entry.plural}</span>
                {entry.singular && entry.singular !== entry.plural && (
                  <>
                    <span aria-hidden> · </span>{ui.singular}:{" "}
                    <span className="font-medium text-fg">{entry.singular}</span>
                  </>
                )}
              </p>
            )}
          </div>

          <div className="flex shrink-0 gap-1">
            {speechSupported() && (
              <button
                type="button"
                onClick={() =>
                  speak(headword, {
                    lang,
                    rate: settings.speechRate,
                    voiceUri: settings.voices[lang],
                  })
                }
                className="btn !px-1.5 !py-1.5"
                aria-label={`Hear ${headword}`}
              >
                <SpeakerIcon width={16} height={16} />
              </button>
            )}
            <button type="button" onClick={onClose} className="btn !px-1.5 !py-1.5" aria-label="Close">
              <CloseIcon width={16} height={16} />
            </button>
          </div>
        </div>

        <div className="mt-3 min-h-[1.5rem] text-[14px]">
          {loading && (
            <span className="flex items-center gap-2 text-muted">
              <SpinnerIcon width={15} height={15} /> {ui.looking}
            </span>
          )}

          {!loading && failed && (
            <span className="text-muted">{ui.nothing}</span>
          )}

          {!loading && entry && (
            <>
              {entry.translation && (
                <p className="text-translation">
                  {entry.translation}
                  <span className="ml-1.5 text-[11px] uppercase tracking-wide text-muted">
                    {target === "vi" ? "vi" : "en"}
                  </span>
                </p>
              )}

              {visibleSenses.map((sense, i) => (
                <div key={`${sense.partOfSpeech}-${i}`} className="mt-2.5">
                  {sense.partOfSpeech && (
                    <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted">
                      {sense.partOfSpeech}
                    </span>
                  )}
                  <ul className="mt-1 space-y-1">
                    {sense.definitions.map((definition, j) => (
                      <li key={j} className="flex gap-1.5 text-[13.5px] leading-relaxed">
                        <span aria-hidden className="text-accent">
                          ·
                        </span>
                        <span>{definition}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

              {lang === "de" && (
                <CaseCard
                  sentence={query.sentence}
                  word={headword}
                  surface={query.word}
                  article={entry.article}
                  isAdjective={isAdjective}
                  target={target}
                />
              )}

              {entry.examples && entry.examples.length > 0 && (
                <div className="mt-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                    {ui.inUse}
                  </span>
                  <ul className="mt-1.5 space-y-2">
                    {entry.examples.slice(0, expanded ? 3 : 2).map((example, i) => (
                      <li key={i} className="border-l-2 border-border pl-2.5">
                        <p className="text-[13px] leading-relaxed" lang={lang}>
                          {example.text}
                        </p>
                        {example.translation && (
                          <p className="text-translation mt-0.5 text-[12.5px] leading-relaxed">
                            {example.translation}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {entry.collocations && entry.collocations.length > 0 && (
                <div className="mt-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                    {ui.usedWith}
                  </span>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {entry.collocations.slice(0, expanded ? 8 : 4).map((phrase) => (
                      <span
                        key={phrase}
                        lang={lang}
                        className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[12px]"
                      >
                        {phrase}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {!expanded &&
                ((entry.senses?.length ?? 0) > 2 ||
                  (entry.collocations?.length ?? 0) > 4 ||
                  (entry.examples?.length ?? 0) > 2) && (
                  <button
                    type="button"
                    onClick={() => setExpanded(true)}
                    className="mt-2 text-[12.5px] font-medium text-accent underline underline-offset-2"
                  >
                    {ui.showMore}
                  </button>
                )}
            </>
          )}
        </div>

        <p className="mt-3 line-clamp-2 border-t border-border pt-2.5 text-[12px] leading-relaxed text-muted" lang={lang}>
          {query.sentence}
        </p>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={save}
            disabled={saved || loading}
            className={`btn flex-1 ${saved ? "" : "btn-primary"}`}
          >
            {saved ? (
              <>
                <CheckIcon width={16} height={16} /> {ui.saved}
              </>
            ) : (
              <>
                <PlusIcon width={16} height={16} /> {ui.save}
              </>
            )}
          </button>
          {entry?.url && (
            <a
              href={entry.url}
              target="_blank"
              rel="noreferrer noopener"
              className="btn !px-2.5"
              aria-label="Open the full dictionary entry"
              title={ui.fullEntry}
            >
              <ExternalIcon width={15} height={15} />
            </a>
          )}
        </div>
      </div>
    </>
  );
}
