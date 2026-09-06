"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSettings } from "@/hooks/useSettings";
import { useT } from "@/hooks/useT";
import { useTranslator } from "@/hooks/useTranslator";
import { splitWords } from "@/lib/segment";
import { isSaved, toggleSaved } from "@/lib/store";
import { formatDate } from "@/lib/format";
import { SOURCE_BY_ID } from "@/lib/sources";
import type { Article, SourceLang } from "@/lib/types";
import { setReadingNow } from "@/lib/reading";
import { noteRead } from "@/lib/recent";
import { recallItem } from "@/lib/handoff";
import { forgetBlocked, noteBlocked } from "@/lib/blocked";
import { getCachedArticle, setCachedArticle } from "@/lib/feedCache";
import { cancelSpeech, isPaused, pauseSpeech, resumeSpeech, speak, speechSupported } from "@/lib/tts";
import { useScrollActivity } from "@/hooks/useScrollActivity";
import { PronunciationPractice } from "./PronunciationPractice";
import { SentenceStructure } from "./SentenceStructure";
import { LevelControl } from "./LevelControl";
import { vocabIndex } from "@/lib/store";
import { isCommon } from "@/lib/frequency";
import { splitSentences } from "@/lib/segment";
import { SettingsDrawer } from "./SettingsDrawer";
import { ReaderToolbar } from "./ReaderToolbar";
import { SourceAvatar } from "./SourceAvatar";
import { WordPopover, type WordQuery } from "./WordPopover";
import {
  ArrowLeftIcon,
  BookmarkIcon,
  ExternalIcon,
  LanguagesIcon,
  SlidersIcon,
  BranchIcon,
  MicIcon,
  PauseIcon,
  PlayIcon,
  SpeakerIcon,
  SpinnerIcon,
  StopIcon,
} from "./Icons";

interface Line {
  key: string;
  text: string;
  blockId: string;
  kind: Article["blocks"][number]["kind"];
  /** First sentence of its paragraph, used for spacing between blocks. */
  first: boolean;
}

const HINT_KEY = "pn:hint-dismissed:v1";

export function Reader({
  url,
  lang: fallbackLang,
  sourceId,
}: {
  url: string;
  lang: SourceLang;
  sourceId?: string;
}) {
  const [settings, update] = useSettings();
  const t = useT();
  const [article, setArticle] = useState<Article | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [word, setWord] = useState<WordQuery | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [progress, setProgress] = useState(0);
  const [vocab, setVocab] = useState<Map<string, "learning" | "known">>(new Map());
  const [showHint, setShowHint] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [speakingKey, setSpeakingKey] = useState<string | null>(null);
  const [readingAloud, setReadingAloud] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [paused, setPaused] = useState(false);
  const [practiceLine, setPracticeLine] = useState<string | null>(null);
  const [structureLine, setStructureLine] = useState<string | null>(null);
  const [spokenChar, setSpokenChar] = useState<number>(-1);
  const [levelled, setLevelled] = useState<Article | null>(null);
  const chromeActive = useScrollActivity();

  const lang = article?.lang ?? fallbackLang;
  const tr = useTranslator(lang, settings.target);
  const source = sourceId ? SOURCE_BY_ID.get(sourceId) : undefined;
  // The paper's own name, shown in full rather than cut off mid-word.
  const publisher = source?.name ?? article?.siteName;
  // A refusal is worth remembering: the shelf can stop offering this paper
  // rather than letting the same wall be walked into again.
  const [remembered, setRemembered] = useState(false);
  const suppressClick = useRef(false);
  const longPress = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ------------------------------------------------------------ load article
  useEffect(() => {
    let cancelled = false;

    // Re-opening a piece you just read should not show a skeleton again.
    const cached = getCachedArticle<Article>(url);
    if (cached) {
      setArticle(cached);
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);
    (async () => {
      try {
        const res = await fetch(
          `/api/article?url=${encodeURIComponent(url)}&lang=${fallbackLang}`,
        );
        const json = (await res.json()) as Article & { error?: string };
        if (!res.ok) throw new Error(json.error ?? `Could not load the article (${res.status}).`);
        if (!cancelled) {
          setArticle(json);
          setCachedArticle(url, json);
        }
      } catch (err) {
        if (cancelled) return;
        // The publisher blocked us, but the newsstand already had the summary.
        // A shorter read that still translates beats a dead end.
        // Remember the refusal however it went, so the shelf can act on it.
        // Only recording it when a summary happened to be around meant a paper
        // that fails outright was never learned from, and kept being offered.
        if (sourceId) noteBlocked(sourceId);
        const known = recallItem(url);
        if (known?.summary) {
          setBlocked(true);
          setArticle({
            url,
            title: known.title,
            siteName: known.sourceName,
            lang: fallbackLang,
            blocks: splitSentences(known.summary, fallbackLang).length
              ? [
                  {
                    id: "b0",
                    kind: "paragraph",
                    sentences: splitSentences(known.summary, fallbackLang),
                  },
                ]
              : [],
            wordCount: known.summary.split(/\s+/).length,
            readingMinutes: 1,
            partial: true,
          });
        } else {
          setLoadError(err instanceof Error ? err.message : "Could not load it.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url, fallbackLang, sourceId]);

  // Log the open once the article is known, so the history has a real title.
  useEffect(() => {
    if (!article) return;
    noteRead({
      url,
      title: article.title,
      sourceName: source?.name ?? article.siteName ?? "",
      sourceId,
      lang: article.lang,
      progress: 0,
    });
    // Only on arrival; progress is updated by the scroll handler below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article?.url]);

  useEffect(() => {
    setSaved(isSaved(url));
    setVocab(vocabIndex(fallbackLang));
    try {
      setShowHint(!window.localStorage.getItem(HINT_KEY));
    } catch {
      setShowHint(true);
    }
  }, [url]);

  // Reading progress, which doubles as a gentle sense of pace and feeds the
  // "continue reading" bar shown on the other pages.
  useEffect(() => {
    if (!article) return;
    let lastWrite = 0;
    const onScroll = () => {
      const height = document.documentElement.scrollHeight - window.innerHeight;
      const pct = height > 0 ? Math.min(100, (window.scrollY / height) * 100) : 0;
      setProgress(pct);
      const now = Date.now();
      if (now - lastWrite > 1500) {
        lastWrite = now;
        setReadingNow({
          url,
          title: article.title,
          sourceName: source?.name ?? article.siteName ?? "",
          lang: article.lang,
          sourceId,
          progress: pct,
        });
        noteRead({
          url,
          title: article.title,
          sourceName: source?.name ?? article.siteName ?? "",
          sourceId,
          lang: article.lang,
          progress: pct,
        });
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      onScroll();
    };
  }, [article, url, sourceId, source]);

  // --------------------------------------------------------------- flat lines
  const lines: Line[] = useMemo(() => {
    const source = levelled ?? article;
    if (!source) return [];
    const out: Line[] = [];
    for (const block of source.blocks) {
      block.sentences.forEach((text, i) => {
        out.push({ key: `${block.id}:${i}`, text, blockId: block.id, kind: block.kind, first: i === 0 });
      });
    }
    return out;
  }, [article, levelled]);

  const sentencesByBlock = useMemo(() => {
    const map = new Map<string, string[]>();
    (levelled ?? article)?.blocks.forEach((b) => map.set(b.id, b.sentences));
    return map;
  }, [article, levelled]);

  // ------------------------------------------------------------- translations
  const revealLine = useCallback(
    (line: Line) => {
      setActiveKey(line.key);
      setRevealed((prev) => {
        const next = new Set(prev);
        if (next.has(line.key)) {
          next.delete(line.key);
          return next;
        }
        next.add(line.key);
        return next;
      });
      // Translate the whole paragraph at once: it is one request either way,
      // and the next line is then instant.
      const batch = sentencesByBlock.get(line.blockId) ?? [line.text];
      void tr.request(batch);
    },
    [sentencesByBlock, tr],
  );

  // Bilingual mode pays for translations only as paragraphs scroll into view.
  const blockRefs = useRef(new Map<string, HTMLElement>());
  useEffect(() => {
    if (!settings.bilingual || !article) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const texts: string[] = [];
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const id = (entry.target as HTMLElement).dataset.blockId;
          if (id) texts.push(...(sentencesByBlock.get(id) ?? []));
        }
        if (texts.length) void tr.request(texts);
      },
      { rootMargin: "300px 0px" },
    );
    blockRefs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [settings.bilingual, article, sentencesByBlock, tr]);

  // ----------------------------------------------------------- read aloud
  const stopSpeaking = useCallback(() => {
    cancelSpeech();
    setSpeakingKey(null);
    setReadingAloud(false);
    setSpokenChar(-1);
  }, []);

  // Leaving the article mid-sentence should not leave a voice talking.
  useEffect(() => () => cancelSpeech(), []);

  const speakLine = useCallback(
    (index: number, continuous: boolean) => {
      const line = lines[index];
      if (!line) {
        stopSpeaking();
        return;
      }
      setSpeakingKey(line.key);
      setActiveKey(line.key);
      setSpokenChar(-1);
      document.getElementById(`line-${line.key}`)?.scrollIntoView({
        block: "center",
        behavior: "smooth",
      });
      speak(line.text, {
        lang,
        rate: settings.speechRate,
        voiceUri: settings.voices[lang],
        onWord: (charIndex) => setSpokenChar(charIndex),
        onEnd: () => {
          setSpokenChar(-1);
          if (!continuous) {
            setSpeakingKey(null);
            return;
          }
          speakLine(index + 1, true);
        },
        onError: stopSpeaking,
      });
    },
    [lines, lang, settings.speechRate, settings.voices, stopSpeaking],
  );

  function toggleReadAloud() {
    if (readingAloud) {
      stopSpeaking();
      setPaused(false);
      return;
    }
    const start = Math.max(0, lines.findIndex((l) => l.key === activeKey));
    setReadingAloud(true);
    setPaused(false);
    speakLine(start, true);
  }

  function togglePause() {
    if (isPaused()) {
      resumeSpeech();
      setPaused(false);
    } else {
      pauseSpeech();
      setPaused(true);
    }
  }

  // ------------------------------------------------------------------ keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || word) return;
      const index = lines.findIndex((l) => l.key === activeKey);

      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "j") {
        e.preventDefault();
        const next = lines[Math.min(lines.length - 1, index + 1)] ?? lines[0];
        if (next) focusLine(next.key, setActiveKey);
      } else if (e.key === "k") {
        e.preventDefault();
        const prev = lines[Math.max(0, index - 1)] ?? lines[0];
        if (prev) focusLine(prev.key, setActiveKey);
      } else if (e.key === "t" || e.key === "Enter") {
        const line = lines[index >= 0 ? index : 0];
        if (line) {
          e.preventDefault();
          revealLine(line);
        }
      } else if (e.key === "Escape") {
        setActiveKey(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lines, activeKey, revealLine, word]);

  // -------------------------------------------------------------- word lookup
  const openWord = useCallback(
    (event: { clientX: number; clientY: number }, text: string, sentence: string) => {
      if (!settings.wordLookup) return;
      setWord({ word: text, sentence, x: event.clientX, y: event.clientY });
    },
    [settings.wordLookup],
  );

  const closeWord = useCallback(() => {
    setWord(null);
    setVocab(vocabIndex(lang));
  }, [lang]);

  function dismissHint() {
    setShowHint(false);
    try {
      window.localStorage.setItem(HINT_KEY, "1");
    } catch {
      /* nothing to do */
    }
  }

  // ------------------------------------------------------------------ render
  const showTranslation = (key: string) => settings.bilingual || revealed.has(key);

  return (
    <div className="min-h-screen">
      <div
        className="fixed inset-x-0 top-0 z-40 h-0.5 bg-accent transition-[width] duration-150"
        style={{ width: `${progress}%` }}
        aria-hidden
      />

      {article && (
        <div
          className={`glass-strong pointer-events-none fixed right-3 top-[calc(var(--header-height)+0.6rem)] z-40 flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 shadow-[var(--shadow)] transition-opacity duration-300 ${
            chromeActive && progress > 2 ? "opacity-100" : "opacity-0"
          }`}
          aria-label={`${Math.round(progress)} percent read`}
        >
          <span
            aria-hidden
            className="grid h-4 w-4 place-items-center rounded-full"
            style={{
              background: `conic-gradient(var(--accent) ${progress * 3.6}deg, color-mix(in srgb, var(--accent) 20%, transparent) 0deg)`,
            }}
          />
          <span className="text-[11.5px] font-medium tabular-nums">{Math.round(progress)}%</span>
        </div>
      )}

      <header
        className={`glass sticky top-0 z-30 border-b border-border transition-opacity duration-300 ${
          chromeActive ? "opacity-100" : "opacity-30 hover:opacity-100 focus-within:opacity-100"
        }`}
      >
        <div className="mx-auto flex max-w-3xl items-center gap-1.5 px-3 py-2.5 sm:gap-2">
          <Link href="/" className="btn !px-1.5 !py-1.5 sm:!px-2" aria-label={t("reader.back")}>
            <ArrowLeftIcon />
          </Link>
          {source ? (
            <Link
              href={`/s/${source.id}`}
              className="flex min-w-0 flex-1 items-center gap-1.5 text-muted hover:text-fg"
              title={source.name}
            >
              <SourceAvatar name={source.name} site={source.site} size={18} />
              <span className="truncate text-[13px] font-medium">{source.name}</span>
            </Link>
          ) : (
            <span className="min-w-0 flex-1 truncate text-[13px] text-muted">
              {article?.siteName ?? t("reader.back")}
            </span>
          )}

          {article && speechSupported() && readingAloud && (
            <button
              type="button"
              onClick={togglePause}
              className="btn !px-1.5 !py-1.5 sm:!px-2"
              aria-label={paused ? t("reader.resume") : t("reader.pause")}
              title={paused ? t("reader.resume") : t("reader.pause")}
            >
              {paused ? <PlayIcon /> : <PauseIcon />}
            </button>
          )}

          {article && speechSupported() && (
            <button
              type="button"
              onClick={toggleReadAloud}
              className={`btn !px-1.5 !py-1.5 sm:!px-2 ${readingAloud ? "btn-primary" : ""}`}
              aria-pressed={readingAloud}
              aria-label={readingAloud ? t("reader.stopReading") : t("reader.readAloud")}
              title={readingAloud ? t("reader.stopReading") : t("reader.readAloud")}
            >
              {readingAloud ? <StopIcon /> : <SpeakerIcon />}
            </button>
          )}

          <button
            type="button"
            onClick={() => update({ target: settings.target === "en" ? "vi" : "en" })}
            className="btn !px-1.5 !py-1.5 text-xs font-semibold sm:hidden"
            aria-label={t("reader.translateInto")}
            title={t("reader.translateInto")}
          >
            {settings.target === "en" ? "EN" : "VI"}
          </button>

          <div className="hidden items-center gap-1 rounded-lg border border-border bg-surface p-0.5 sm:flex">
            {(["en", "vi"] as const).map((target) => (
              <button
                key={target}
                type="button"
                onClick={() => update({ target })}
                className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                  settings.target === target ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"
                }`}
                aria-pressed={settings.target === target}
              >
                {target === "en" ? "EN" : "VI"}
              </button>
            ))}
          </div>

          <span className="hidden sm:contents">
            <button
              type="button"
              onClick={() => update({ bilingual: !settings.bilingual })}
              className={`btn !px-2 !py-1.5 ${settings.bilingual ? "btn-primary" : ""}`}
              aria-pressed={settings.bilingual}
              aria-label={t("reader.showAll")}
              title={t("reader.showAll")}
            >
              <LanguagesIcon />
            </button>
          </span>

          <button
            type="button"
            onClick={() => {
              if (!article) return;
              setSaved(
                toggleSaved({
                  url,
                  title: article.title,
                  sourceName: source?.name ?? article.siteName ?? "",
                  lang,
                  savedAt: new Date().toISOString(),
                  image: article.leadImage,
                }),
              );
            }}
            className={`btn !px-1.5 !py-1.5 sm:!px-2 ${saved ? "btn-primary" : ""}`}
            aria-pressed={saved}
            aria-label={t("reader.save")}
          >
            <BookmarkIcon />
          </button>

          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="btn !px-1.5 !py-1.5 sm:!px-2"
            aria-label={t("reader.settings")}
          >
            <SlidersIcon />
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 pb-28 pt-8">
        {loading && (
          <div className="space-y-3">
            <div className="skeleton h-7 w-4/5" />
            <div className="skeleton h-4 w-1/3" />
            <div className="mt-6 space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="skeleton h-4" style={{ width: `${70 + (i % 3) * 10}%` }} />
              ))}
            </div>
          </div>
        )}

        {loadError && (
          <div className="card p-6">
            <h1 className="text-lg font-semibold">This one will not open here</h1>
            <p className="mt-2 text-sm text-muted">{loadError}</p>
            {sourceId && publisher && (
              <p className="mt-2 text-[13px] text-muted">
                {remembered ? (
                  <>
                    {publisher} is back on the shelf.{" "}
                    <button
                      type="button"
                      onClick={() => {
                        noteBlocked(sourceId);
                        setRemembered(false);
                      }}
                      className="font-medium text-accent underline underline-offset-2"
                    >
                      Hide it again
                    </button>
                  </>
                ) : (
                  <>
                    {publisher} will be left off the shelf from now on.{" "}
                    <button
                      type="button"
                      onClick={() => {
                        forgetBlocked(sourceId);
                        setRemembered(true);
                      }}
                      className="font-medium text-accent underline underline-offset-2"
                    >
                      Keep showing it
                    </button>
                  </>
                )}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <a href={url} target="_blank" rel="noreferrer noopener" className="btn btn-primary">
                <ExternalIcon /> Read on the publisher&apos;s site
              </a>
              <Link href="/" className="btn">
                Back to the newsstand
              </Link>
            </div>
          </div>
        )}

        {article && (
          <article>
            {article.leadImage && !imageFailed && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={article.leadImage}
                alt=""
                onError={() => setImageFailed(true)}
                // A lead image should set the scene, not fill the first screen.
                className="reading mb-6 !max-w-[var(--reading-measure)] max-h-[min(42vh,18rem)] w-full rounded-xl border border-border object-cover"
              />
            )}
            <h1 className="reading !max-w-[var(--reading-measure)] text-balance text-2xl font-bold !leading-[1.18] sm:text-[1.85rem]">
              {article.title}
            </h1>
            <p className="reading mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs !leading-normal text-muted">
              {publisher && (
                <span className="inline-flex items-center gap-1.5">
                  <SourceAvatar name={publisher} site={source?.site} size={16} />
                  {source ? (
                    <Link href={`/s/${source.id}`} className="font-medium text-fg hover:underline">
                      {publisher}
                    </Link>
                  ) : (
                    <span className="font-medium text-fg">{publisher}</span>
                  )}
                </span>
              )}
              {article.byline && article.byline.toLowerCase() !== publisher?.toLowerCase() && (
                <span>{article.byline}</span>
              )}
              {article.publishedAt && <span>{formatDate(article.publishedAt)}</span>}
              <span>
                {article.wordCount} words · about {article.readingMinutes} min at native pace
              </span>
              <a
                href={url}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 underline underline-offset-2"
              >
                Original <ExternalIcon width={13} height={13} />
              </a>
            </p>

            {showHint && (
              <div className="reading mt-5 rounded-xl border border-border bg-surface-2 px-4 py-3 text-[13px] leading-relaxed text-muted">
                <p>
                  Tap any line to see it in {settings.target === "vi" ? "Vietnamese" : "English"}.
                  Double click or long press a single word to look it up and save it. On a keyboard,
                  use <kbd className="font-semibold">j</kbd> and <kbd className="font-semibold">k</kbd>{" "}
                  to move and <kbd className="font-semibold">t</kbd> to translate.
                </p>
                <button type="button" onClick={dismissHint} className="btn mt-2 px-2 py-1 text-xs">
                  Got it
                </button>
              </div>
            )}

            {(blocked || article.partial) && (
              <div className="reading mt-5 rounded-xl border border-border bg-surface-2 px-4 py-3 text-[13px] leading-relaxed text-muted">
                <p>
                  {blocked
                    ? "This publisher blocked our request, which usually means a paywall. What you see is the summary the publication itself put in its feed."
                    : "Only part of this article was readable, most likely a paywall."}{" "}
                  Everything else still works here: tap a line to translate it, or use read aloud.
                </p>
                {blocked && sourceId && publisher && (
                  <p className="mt-2 text-[12.5px]">
                    {remembered ? (
                      <>
                        {publisher} is back on the shelf.{" "}
                        <button
                          type="button"
                          onClick={() => {
                            noteBlocked(sourceId);
                            setRemembered(false);
                          }}
                          className="font-medium text-accent underline underline-offset-2"
                        >
                          Hide it again
                        </button>
                      </>
                    ) : (
                      <>
                        {publisher} will be left off the shelf from now on.{" "}
                        <button
                          type="button"
                          onClick={() => {
                            forgetBlocked(sourceId);
                            setRemembered(true);
                          }}
                          className="font-medium text-accent underline underline-offset-2"
                        >
                          Keep showing it
                        </button>
                      </>
                    )}
                  </p>
                )}
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="btn mt-2.5 inline-flex !py-1.5 text-xs"
                >
                  <ExternalIcon width={14} height={14} /> Read the full piece on their site
                </a>
              </div>
            )}

            {tr.error && (
              <p className="reading mt-5 rounded-xl border border-accent/40 bg-surface-2 px-4 py-3 text-[13px]">
                {tr.error}
              </p>
            )}

            <LevelControl
              article={article}
              lang={lang}
              levelled={levelled}
              onLevelled={(next) => {
                stopSpeaking();
                setRevealed(new Set());
                setLevelled(next);
              }}
            />

            <div className="reading mt-7" lang={lang}>
              {(levelled ?? article).blocks.map((block) => (
                <div
                  key={block.id}
                  data-block-id={block.id}
                  ref={(el) => {
                    if (el) blockRefs.current.set(block.id, el);
                    else blockRefs.current.delete(block.id);
                  }}
                  className={`para ${block.kind === "quote" ? "quote" : ""}`}
                >
                  {block.kind === "heading" ? (
                    <h2>{block.sentences.join(" ")}</h2>
                  ) : (
                    block.sentences.map((sentence, i) => {
                      const key = `${block.id}:${i}`;
                      const line: Line = {
                        key,
                        text: sentence,
                        blockId: block.id,
                        kind: block.kind,
                        first: i === 0,
                      };
                      const translation = tr.get(sentence);
                      const pending = tr.isPending(sentence);
                      const open = showTranslation(key);
                      const isLines = settings.layout === "lines";

                      return (
                        <div key={key} className={isLines ? "" : "inline"}>
                          <div
                            id={`line-${key}`}
                            role="button"
                            tabIndex={0}
                            data-active={activeKey === key}
                            data-speaking={speakingKey === key}
                            className={isLines ? "sentence-row" : "sentence inline"}
                            onClick={() => {
                              if (suppressClick.current) {
                                suppressClick.current = false;
                                return;
                              }
                              revealLine(line);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === " ") {
                                e.preventDefault();
                                revealLine(line);
                              }
                            }}
                          >
                            {settings.wordLookup ? (
                              (() => {
                                let offset = 0;
                                return splitWords(sentence).map((token, ti) => {
                                  const start = offset;
                                  offset += token.text.length;
                                  if (!token.isWord) return <span key={ti}>{token.text}</span>;
                                  const status = vocab.get(token.text.toLowerCase());
                                  const spoken =
                                    speakingKey === key &&
                                    spokenChar >= start &&
                                    spokenChar < start + token.text.length;
                                  return (
                                  <span
                                    key={ti}
                                    className="word"
                                    data-vocab={
                                      status ??
                                      (settings.heatmap && !isCommon(token.text, lang)
                                        ? "new"
                                        : undefined)
                                    }
                                    data-spoken={spoken || undefined}
                                    onDoubleClick={(e) => {
                                      e.stopPropagation();
                                      suppressClick.current = true;
                                      openWord(e, token.text, sentence);
                                    }}
                                    onPointerDown={(e) => {
                                      const { clientX, clientY } = e;
                                      longPress.current = setTimeout(() => {
                                        suppressClick.current = true;
                                        openWord({ clientX, clientY }, token.text, sentence);
                                      }, 450);
                                    }}
                                    onPointerUp={() => {
                                      if (longPress.current) clearTimeout(longPress.current);
                                    }}
                                    onPointerLeave={() => {
                                      if (longPress.current) clearTimeout(longPress.current);
                                    }}
                                  >
                                    {token.text}
                                  </span>
                                  );
                                });
                              })()
                            ) : (
                              <>{sentence}</>
                            )}{" "}
                          </div>

                          {activeKey === key && speechSupported() && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (speakingKey === key) {
                                  stopSpeaking();
                                } else {
                                  setReadingAloud(false);
                                  speakLine(
                                    lines.findIndex((l) => l.key === key),
                                    false,
                                  );
                                }
                              }}
                              className="mb-1 ml-[-0.55em] inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] text-muted transition-colors hover:bg-surface-2 hover:text-fg"
                              aria-label={speakingKey === key ? "Stop" : "Hear this line"}
                            >
                              {speakingKey === key ? (
                                <>
                                  <StopIcon width={13} height={13} /> {t("reader.stop")}
                                </>
                              ) : (
                                <>
                                  <SpeakerIcon width={13} height={13} /> {t("reader.hearLine")}
                                </>
                              )}
                            </button>
                          )}

                          {activeKey === key && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                stopSpeaking();
                                setPracticeLine(sentence);
                              }}
                              className="mb-1 ml-1 inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] text-muted transition-colors hover:bg-surface-2 hover:text-fg"
                              aria-label="Practise saying this line"
                            >
                              <MicIcon width={13} height={13} /> {t("reader.sayItBack")}
                            </button>
                          )}

                          {activeKey === key && lang === "de" && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setStructureLine(sentence);
                              }}
                              className="mb-1 ml-1 inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] text-muted transition-colors hover:bg-surface-2 hover:text-fg"
                              aria-label="Break this sentence down"
                            >
                              <BranchIcon width={13} height={13} /> {t("reader.structure")}
                            </button>
                          )}

                          {open && (
                            <div className="translation" lang={settings.target}>
                              {translation ? (
                                translation
                              ) : pending ? (
                                <span className="inline-flex items-center gap-1.5 opacity-70">
                                  <SpinnerIcon width={13} height={13} /> translating
                                </span>
                              ) : (
                                <span className="opacity-70">no translation available</span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              ))}
            </div>

            <div className="reading mt-10 border-t border-border pt-5 text-xs text-muted">
              <p>
                Text and images belong to {source?.name ?? article.siteName ?? "the publisher"}.
                {tr.provider ? ` Translations via ${tr.provider}.` : ""}
              </p>
              <a
                href={url}
                target="_blank"
                rel="noreferrer noopener"
                className="btn mt-3 inline-flex"
              >
                <ExternalIcon /> {t("reader.original")}
              </a>
            </div>
          </article>
        )}
      </div>

      {word && (
        <WordPopover
          query={word}
          lang={lang}
          target={settings.target}
          articleTitle={article?.title}
          articleUrl={url}
          sentenceTranslation={tr.get(word.sentence)}
          onClose={closeWord}
        />
      )}

      {article && <ReaderToolbar dimmed={!chromeActive} lang={lang} />}

      {structureLine && (
        <SentenceStructure
          sentence={structureLine}
          lang={lang}
          target={settings.target}
          onClose={() => setStructureLine(null)}
        />
      )}

      {practiceLine && (
        <PronunciationPractice
          sentence={practiceLine}
          lang={lang}
          onClose={() => setPracticeLine(null)}
        />
      )}

      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

function focusLine(key: string, setActive: (k: string) => void) {
  setActive(key);
  const el = document.getElementById(`line-${key}`);
  el?.scrollIntoView({ block: "center", behavior: "smooth" });
}
