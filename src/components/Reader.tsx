"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSettings } from "@/hooks/useSettings";
import { useT } from "@/hooks/useT";
import { useTranslator } from "@/hooks/useTranslator";
import { splitWords } from "@/lib/segment";
import { isSaved, toggleSaved } from "@/lib/store";
import { formatDate } from "@/lib/format";
import { SOURCE_BY_ID } from "@/lib/sources";
import type { Article, SourceLang } from "@/lib/types";
import { setReadingNow } from "@/lib/reading";
import { markRead, noteRead } from "@/lib/recent";
import { recallItem } from "@/lib/handoff";
import { forgetBlocked, noteBlocked } from "@/lib/blocked";
import { getCachedArticle, setCachedArticle } from "@/lib/feedCache";
import { markBackAction } from "@/lib/scrollMemory";
import {
  cancelSpeech,
  clearNowPlaying,
  pauseSpeech,
  resumeSpeech,
  setNowPlaying,
  setNowPlayingHandlers,
  setPlaybackState,
  speak,
  speechSupported,
  startBackgroundKeepAlive,
} from "@/lib/tts";
import { useScrollActivity } from "@/hooks/useScrollActivity";
import { useDropdownTransition } from "@/hooks/useDropdownTransition";
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
  CheckIcon,
  CloseIcon,
  CopyIcon,
  ExternalIcon,
  LanguagesIcon,
  SlidersIcon,
  BranchIcon,
  MicIcon,
  PauseIcon,
  PlayIcon,
  SparkIcon,
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

/**
 * Wraps the hear-line / say-it-back / structure row so it grows in
 * (transitions-dev "Accordion expand", height-only, no chevron - the
 * sentence row itself is the toggle) instead of snapping into place. Only
 * mounted for the active line to begin with, so it starts collapsed and
 * flips open a frame later; unmounting on the way out stays instant, same
 * as before, rather than mounting this for every line in the article just
 * to animate the rare case of tapping straight from one open line to another.
 */
function LineActions({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className="t-acc" data-open={open}>
      <div className="t-acc-panel">
        <div className="t-acc-panel-inner">{children}</div>
      </div>
    </div>
  );
}

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
  const router = useRouter();
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
  const [showShortcuts, setShowShortcuts] = useState(false);
  const chromeActive = useScrollActivity();

  const lang = article?.lang ?? fallbackLang;
  // Translating an article into its own language would just repeat it, so
  // that option never appears, and a saved preference that no longer applies
  // (an English preference, opening a German piece) falls back quietly
  // rather than being overwritten - it is still right the next time it fits.
  const targetOptions = (["en", "vi", "de"] as const).filter((t) => t !== lang);
  const target = targetOptions.includes(settings.target) ? settings.target : targetOptions[0];
  const tr = useTranslator(lang, target);
  const source = sourceId ? SOURCE_BY_ID.get(sourceId) : undefined;
  // The paper's own name, shown in full rather than cut off mid-word.
  const publisher = source?.name ?? article?.siteName;
  // A refusal is worth remembering: the shelf can stop offering this paper
  // rather than letting the same wall be walked into again.
  const [remembered, setRemembered] = useState(false);

  const [linkCopied, setLinkCopied] = useState(false);
  const [askAiOpen, setAskAiOpen] = useState(false);
  const askAiRef = useRef<HTMLDivElement>(null);
  const { mounted: askAiMounted, dropdownState: askAiDropdownState } =
    useDropdownTransition(askAiOpen);

  useEffect(() => {
    if (!askAiOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!askAiRef.current?.contains(e.target as Node)) setAskAiOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [askAiOpen]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1800);
    } catch {
      // Clipboard access denied or unavailable on this device - nothing to fall back to.
    }
  }

  // Neither provider documents a reliable way to open with a message already
  // typed, so the prompt goes to the clipboard regardless - a paste away from
  // working even if a prefill link ever stops.
  function askAi(provider: "claude" | "gemini") {
    const title = article?.title;
    const prompt = `Summarize this article and give me other perspectives on it${title ? `, "${title}"` : ""}: ${url}`;
    void navigator.clipboard?.writeText(prompt).catch(() => {});
    const dest =
      provider === "claude"
        ? `https://claude.ai/new?q=${encodeURIComponent(prompt)}`
        : "https://gemini.google.com/app";
    window.open(dest, "_blank", "noopener,noreferrer");
    setAskAiOpen(false);
  }

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
        // noteBlocked is a no-op for verified open sources (BR24, SWR, Tagesschau etc.)
        // so it is safe to call unconditionally here.
        if (sourceId) noteBlocked(sourceId);
        const known = recallItem(url);
        const isOpenSource = source && !source.paywall;
        if (known?.summary) {
          setBlocked(!isOpenSource);
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
    const currentPct = () => {
      const height = document.documentElement.scrollHeight - window.innerHeight;
      return height > 0 ? Math.min(100, (window.scrollY / height) * 100) : 0;
    };
    // Leaving the page is the moment the true final progress matters most, so
    // it always writes, even if the throttle below would otherwise skip it.
    const write = (pct: number) => {
      lastWrite = Date.now();
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
      // Reaching the end, not just opening it, is what "read" means here.
      if (pct >= 99) markRead(url);
    };
    const onScroll = () => {
      const pct = currentPct();
      setProgress(pct);
      if (Date.now() - lastWrite > 1500) write(pct);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      write(currentPct());
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
  /**
   * The line whose translation has just been asked for.
   *
   * On a phone the line you tap is often near the bottom, and its translation
   * arrives a moment later and lands underneath the floating toolbar: the one
   * thing you asked for is the one thing you cannot see. Scrolling at tap time
   * is too early, because the translation is not on the page yet, so this
   * remembers the line and the effect below acts once it is.
   */
  const [justOpened, setJustOpened] = useState<string | null>(null);

  const revealLine = useCallback(
    (line: Line) => {
      setActiveKey(line.key);
      let opening = true;
      setRevealed((prev) => {
        const next = new Set(prev);
        if (next.has(line.key)) {
          next.delete(line.key);
          opening = false;
          return next;
        }
        next.add(line.key);
        return next;
      });

      if (opening) setJustOpened(line.key);
      // Translate the whole paragraph at once: it is one request either way,
      // and the next line is then instant.
      const batch = sentencesByBlock.get(line.blockId) ?? [line.text];
      void tr.request(batch);
    },
    [sentencesByBlock, tr],
  );

  /**
   * Opens a line without ever closing it, for a tap on the line itself.
   *
   * The row used to toggle either way, which meant a tap meant for a word -
   * to hear it or look it up - could land on the row first and collapse a
   * translation that was just opened. Closing now only happens through the
   * line's own collapse button, so a tap on the row can never fight with a
   * tap on a word inside it.
   */
  const openLine = useCallback(
    (line: Line) => {
      setActiveKey(line.key);
      setRevealed((prev) => {
        if (prev.has(line.key)) return prev;
        const next = new Set(prev);
        next.add(line.key);
        return next;
      });
      setJustOpened(line.key);
      const batch = sentencesByBlock.get(line.blockId) ?? [line.text];
      void tr.request(batch);
    },
    [sentencesByBlock, tr],
  );

  const collapseLine = useCallback((line: Line) => {
    setRevealed((prev) => {
      if (!prev.has(line.key)) return prev;
      const next = new Set(prev);
      next.delete(line.key);
      return next;
    });
  }, []);

  const [titleRevealed, setTitleRevealed] = useState(true);
  const activeTitle = (levelled ?? article)?.title ?? "";

  // Always translate the article title immediately so the headline is understood right away.
  useEffect(() => {
    if (!activeTitle) return;
    setTitleRevealed(true);
    void tr.request([activeTitle]);
  }, [activeTitle, target, tr]);

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

  useEffect(() => {
    if (!justOpened) return;

    const settle = () => {
      const block = document.getElementById(`line-${justOpened}`)?.parentElement;
      if (!block) return;
      // Everything below this belongs to the toolbar and the safe area.
      const limit = window.innerHeight - 104;
      const overshoot = block.getBoundingClientRect().bottom - limit;
      if (overshoot > 0) window.scrollBy({ top: overshoot, behavior: "smooth" });
    };

    // Runs once now for the sentence itself, and again when the translation
    // arrives and makes the block taller - which is the case that was landing
    // under the toolbar. Clearing the flag on the first pass, as an earlier
    // version did, meant the second pass never happened.
    settle();
    const done = setTimeout(() => setJustOpened(null), 1500);
    return () => clearTimeout(done);
  }, [justOpened, revealed, tr.version]);

  // ----------------------------------------------------------- read aloud
  const stopSpeaking = useCallback(() => {
    cancelSpeech();
    clearNowPlaying();
    setSpeakingKey(null);
    setReadingAloud(false);
    setSpokenChar(-1);
  }, []);

  // Leaving the article mid-sentence should not leave a voice talking, or a
  // lock-screen card and keep-alive audio running for a page that is gone.
  useEffect(
    () => () => {
      cancelSpeech();
      clearNowPlaying();
    },
    [],
  );

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
        // Something else took over mid-line - a word tapped for its own
        // pronunciation, most often - so this line is no longer speaking,
        // full stop. Never treated as this line finishing: continuing on to
        // the next one would skip past text the reader never actually heard.
        onInterrupted: stopSpeaking,
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
    if (article) {
      setNowPlaying(article.title, publisher);
      setPlaybackState("playing");
      startBackgroundKeepAlive();
      setNowPlayingHandlers({
        onPlay: () => {
          resumeSpeech();
          setPaused(false);
          setPlaybackState("playing");
        },
        onPause: () => {
          pauseSpeech();
          setPaused(true);
          setPlaybackState("paused");
        },
        onStop: stopSpeaking,
      });
    }
    speakLine(start, true);
  }

  function togglePause() {
    // Driven by our own state, not a re-query of the engine's paused flag:
    // the lock screen's own play/pause card can set the engine's paused
    // state directly, and this button's label is already this state, so
    // asking the engine again risked the two disagreeing about which way
    // a tap should go.
    if (paused) {
      resumeSpeech();
      setPaused(false);
      setPlaybackState("playing");
    } else {
      pauseSpeech();
      setPaused(true);
      setPlaybackState("paused");
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
      } else if (e.key === "s") {
        if (article) {
          e.preventDefault();
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
        }
      } else if (e.key === "p" || (e.key === " " && activeKey)) {
        e.preventDefault();
        if (readingAloud) {
          togglePause();
        } else {
          toggleReadAloud();
        }
      } else if (e.key === "?") {
        e.preventDefault();
        setShowShortcuts((v) => !v);
      } else if (e.key === "Escape") {
        setActiveKey(null);
        setShowShortcuts(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lines, activeKey, revealLine, word, article, readingAloud, url, lang, source]);

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

  // A reader can land here from the home feed, a source's own page, Saved,
  // Recently Read or Continue Reading - a fixed "/" undid whichever of those
  // it was and always dropped back to the home feed instead. Real browser
  // history already knows which one it actually was. A page opened fresh
  // (a shared link, a new tab) has nothing to go back to either way, and
  // that is exactly what history.back() already does nothing on its own.
  function goBack() {
    markBackAction();
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  }

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
        className="fixed inset-x-0 top-[env(safe-area-inset-top)] z-50 h-[3px] bg-accent transition-[width] duration-150 ease-out"
        style={{ width: `${progress}%`, boxShadow: progress > 0 ? "0 0 8px var(--accent)" : "none" }}
        aria-hidden
      />

      {article && (
        <div
          className={`glass-strong pointer-events-none fixed right-3 top-[calc(var(--header-offset)+0.6rem)] z-40 flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 shadow-[var(--shadow)] transition-opacity duration-300 ${
            chromeActive && progress > 2 ? "opacity-100" : "opacity-0"
          }`}
          aria-label={`${Math.round(progress)} percent read`}
        >
          <span
            aria-hidden
            className="grid h-4 w-4 place-items-center rounded-full"
            style={{
              background: `conic-gradient(var(--translation) ${progress * 3.6}deg, color-mix(in srgb, var(--translation) 20%, transparent) 0deg)`,
            }}
          />
          <span className="text-[11.5px] font-medium tabular-nums">{Math.round(progress)}%</span>
        </div>
      )}

      <header
        className={`glass sticky top-0 z-30 border-b border-border pt-[env(safe-area-inset-top)] transition-opacity duration-300 ${
          chromeActive ? "opacity-100" : "opacity-30 hover:opacity-100 focus-within:opacity-100"
        }`}
      >
        <div className="mx-auto flex max-w-3xl items-center gap-1.5 px-3 py-2.5 sm:gap-2">
          {/*
            The floating back button below covers mobile now, in the corner a
            thumb already reaches. This one stays for desktop and keyboard
            use, where nothing floats. Wrapped rather than `hidden sm:flex`
            directly on it: .btn sets its own display from unlayered CSS and
            beats a Tailwind hidden/sm: pair on the same element (see the "?"
            shortcuts button below for the same fix).
          */}
          <span className="hidden sm:contents">
            <button
              type="button"
              onClick={goBack}
              className="btn min-h-11 !px-1.5 !py-1.5 sm:!px-2"
              aria-label={t("reader.back")}
            >
              <ArrowLeftIcon />
            </button>
          </span>
          {source ? (
            <Link
              href={`/s/${source.id}`}
              className="flex min-h-11 min-w-0 flex-1 items-center gap-1.5 text-muted hover:text-fg"
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
              className="btn min-h-11 !px-1.5 !py-1.5 sm:!px-2"
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
              className={`btn min-h-11 !px-1.5 !py-1.5 sm:!px-2 ${readingAloud ? "btn-primary" : ""}`}
              aria-pressed={readingAloud}
              aria-label={readingAloud ? t("reader.stopReading") : t("reader.readAloud")}
              title={readingAloud ? t("reader.stopReading") : t("reader.readAloud")}
            >
              {readingAloud ? <StopIcon /> : <SpeakerIcon />}
            </button>
          )}

          {/*
            One control, not two: a same-language target used to still be
            offered here, so a reader on an English piece with an English
            preference saw "translate into English" produce the very text
            they were already reading. Only the languages the article can
            actually be translated into ever appear.
          */}
          <div
            className="flex items-center gap-1 rounded-lg border border-border bg-surface p-0.5"
            role="group"
            aria-label={t("reader.translateInto")}
          >
            {targetOptions.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => update({ target: opt })}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors sm:px-2 sm:py-1 ${
                  target === opt ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"
                }`}
                aria-pressed={target === opt}
                title={t("reader.translateInto")}
              >
                {opt === "en" ? "EN" : opt === "de" ? "DE" : "VI"}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => update({ bilingual: !settings.bilingual })}
            className={`btn min-h-11 !px-1.5 !py-1.5 sm:!px-2 ${settings.bilingual ? "btn-primary" : ""}`}
            aria-pressed={settings.bilingual}
            aria-label={t("reader.showAll")}
            title={t("reader.showAll")}
          >
            <LanguagesIcon />
          </button>

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
            className={`btn min-h-11 !px-1.5 !py-1.5 sm:!px-2 ${saved ? "btn-primary" : ""}`}
            aria-pressed={saved}
            aria-label={t("reader.save")}
          >
            <BookmarkIcon />
          </button>

          {/*
            A "?" keyboard-shortcuts button, on a touchscreen with no
            keyboard, is a button with nothing to open. Unmounted rather
            than hidden with a utility class for the same reason the mobile
            search icon is elsewhere in this app: .btn sets its own display
            from unlayered CSS and beats a Tailwind hidden/sm: pair on the
            same element, so it stayed on screen at every width.
          */}
          <span className="hidden sm:contents">
            <button
              type="button"
              onClick={() => setShowShortcuts((v) => !v)}
              className="btn min-h-11 !px-2 !py-1.5 text-xs font-semibold text-muted hover:text-fg"
              aria-label="Keyboard shortcuts"
              title="Keyboard shortcuts (?)"
            >
              ?
            </button>
          </span>

          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="btn min-h-11 !px-1.5 !py-1.5 sm:!px-2"
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
            <div className="reading !max-w-[var(--reading-measure)]">
              <h1
                lang={lang}
                onClick={() => {
                  if (!titleRevealed) {
                    setTitleRevealed(true);
                    void tr.request([activeTitle]);
                  }
                }}
                className="cursor-pointer text-balance text-2xl font-bold !leading-[1.18] sm:text-[1.85rem]"
              >
                {settings.wordLookup
                  ? splitWords(activeTitle).map((token, ti) => {
                      if (!token.isWord) return <span key={ti}>{token.text}</span>;
                      const status = vocab.get(token.text.toLowerCase());
                      return (
                        <span
                          key={ti}
                          className="word"
                          data-vocab={
                            status ??
                            (settings.heatmap && !isCommon(token.text, lang) ? "new" : undefined)
                          }
                          onClick={(e) => {
                            e.stopPropagation();
                            openWord(e, token.text, activeTitle);
                          }}
                        >
                          {token.text}
                        </span>
                      );
                    })
                  : activeTitle}
              </h1>

              {(settings.bilingual || titleRevealed) && (
                <div
                  lang={target}
                  className="translation mt-2 flex items-start justify-between gap-2 text-[1.05rem] font-medium !leading-snug sm:text-[1.15rem]"
                >
                  <span className="min-w-0">
                    {tr.get(activeTitle) ? (
                      tr.get(activeTitle)
                    ) : tr.isPending(activeTitle) ? (
                      <span className="inline-flex items-center gap-1.5 text-sm opacity-70">
                        <SpinnerIcon width={13} height={13} /> translating title…
                      </span>
                    ) : null}
                  </span>
                  {!settings.bilingual && tr.get(activeTitle) && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setTitleRevealed(false);
                      }}
                      className="mt-0.5 shrink-0 text-muted hover:text-fg"
                      aria-label={t("reader.hideTranslation")}
                      title={t("reader.hideTranslation")}
                    >
                      <CloseIcon width={13} height={13} />
                    </button>
                  )}
                </div>
              )}
            </div>
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
              // One line, not a paragraph. This sits between the reader and
              // the first sentence, and on a phone the old version took half
              // the screen to explain something a single tap teaches anyway.
              <div className="reading mt-4 flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2 text-[12.5px] leading-snug text-muted">
                <span className="min-w-0 flex-1">
                  {t("reader.hintTap")}{" "}
                  <span className="hidden sm:inline">{t("reader.hintKeys")}</span>
                </span>
                <button
                  type="button"
                  onClick={dismissHint}
                  className="btn shrink-0 !px-2 !py-1 text-[12px]"
                >
                  {t("reader.gotIt")}
                </button>
              </div>
            )}

            {(blocked || article.partial) && (
              <div className="reading mt-5 rounded-xl border border-border bg-surface-2 px-4 py-3 text-[13px] leading-relaxed text-muted">
                <p>
                  {blocked
                    ? "This publisher blocked our request, which usually means a paywall. What you see is the summary the publication itself put in its feed."
                    : "Only the summary from this article's feed was available to load."}{" "}
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
                  href={article.url || url}
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
                    <div>
                      <h2
                        className="cursor-pointer"
                        onClick={() => {
                          const headingLine: Line = {
                            key: `${block.id}:0`,
                            text: block.sentences.join(" "),
                            blockId: block.id,
                            kind: "heading",
                            first: true,
                          };
                          revealLine(headingLine);
                        }}
                      >
                        {block.sentences.join(" ")}
                      </h2>
                      {(settings.bilingual || revealed.has(`${block.id}:0`)) && (
                        <div className="translation mt-1 text-base font-medium" lang={target}>
                          {tr.get(block.sentences.join(" ")) ??
                            block.sentences.map((s) => tr.get(s)).filter(Boolean).join(" ")}
                        </div>
                      )}
                    </div>
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
                              // Once open, only the collapse button closes it -
                              // a tap here is a tap meant for a word inside it.
                              if (open) return;
                              openLine(line);
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
                                    onClick={(e) => {
                                      // Before the line is open, a tap here is
                                      // still a tap meant to open it - only
                                      // once its translation is showing does a
                                      // tap on a word mean "look this up".
                                      if (!open) return;
                                      e.stopPropagation();
                                      openWord(e, token.text, sentence);
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

                          {activeKey === key && (
                            <LineActions>
                              {speechSupported() && (
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
                                  className="line-action"
                                  aria-label={speakingKey === key ? "Stop" : "Hear this line"}
                                >
                                  {speakingKey === key ? (
                                    <>
                                      <StopIcon width={15} height={15} /> {t("reader.stop")}
                                    </>
                                  ) : (
                                    <>
                                      <SpeakerIcon width={15} height={15} /> {t("reader.hearLine")}
                                    </>
                                  )}
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  stopSpeaking();
                                  setPracticeLine(sentence);
                                }}
                                className="line-action"
                                aria-label="Practise saying this line"
                              >
                                <MicIcon width={15} height={15} /> {t("reader.sayItBack")}
                              </button>

                              {lang === "de" && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setStructureLine(sentence);
                                  }}
                                  className="line-action"
                                  aria-label="Break this sentence down"
                                >
                                  <BranchIcon width={15} height={15} /> {t("reader.structure")}
                                </button>
                              )}
                            </LineActions>
                          )}

                          {open && (
                            <div className="translation flex items-start justify-between gap-2" lang={target}>
                              <span className="min-w-0">
                                {translation ? (
                                  translation
                                ) : pending ? (
                                  <span className="inline-flex items-center gap-1.5 opacity-70">
                                    <SpinnerIcon width={13} height={13} /> translating
                                  </span>
                                ) : (
                                  <span className="opacity-70">no translation available</span>
                                )}
                              </span>
                              {revealed.has(key) && !settings.bilingual && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    collapseLine(line);
                                  }}
                                  className="shrink-0 text-muted hover:text-fg"
                                  aria-label={t("reader.hideTranslation")}
                                  title={t("reader.hideTranslation")}
                                >
                                  <CloseIcon width={13} height={13} />
                                </button>
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

            <div className="reading mt-10 border-t border-border pb-8 pt-6">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={goBack}
                  className="btn btn-primary inline-flex !py-1.5"
                >
                  <ArrowLeftIcon width={15} height={15} /> {t("reader.back")}
                </button>
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="btn !px-2.5 !py-1.5"
                  aria-label={t("reader.original")}
                  title={t("reader.original")}
                >
                  <ExternalIcon width={15} height={15} /> {t("reader.original")}
                </a>
                <button
                  type="button"
                  onClick={() => void copyLink()}
                  className="btn !px-2 !py-1.5"
                  aria-label={linkCopied ? t("reader.linkCopied") : t("reader.copyLink")}
                  title={linkCopied ? t("reader.linkCopied") : t("reader.copyLink")}
                >
                  <span className="t-icon-swap" data-state={linkCopied ? "b" : "a"}>
                    <span className="t-icon" data-icon="a">
                      <CopyIcon width={15} height={15} />
                    </span>
                    <span className="t-icon" data-icon="b">
                      <CheckIcon width={15} height={15} />
                    </span>
                  </span>
                </button>
                <div className="relative" ref={askAiRef}>
                  <button
                    type="button"
                    onClick={() => setAskAiOpen((v) => !v)}
                    className="btn !px-2 !py-1.5"
                    aria-label={t("reader.askAi")}
                    title={t("reader.askAi")}
                    aria-expanded={askAiOpen}
                  >
                    <SparkIcon width={15} height={15} />
                  </button>
                  {askAiMounted && (
                    <div
                      data-origin="bottom-left"
                      className={`t-dropdown ${askAiDropdownState} glass-strong absolute bottom-full left-0 z-10 mb-1.5 w-36 rounded-lg border border-border p-1 shadow-[var(--shadow)]`}
                    >
                      <button
                        type="button"
                        onClick={() => askAi("claude")}
                        className="block w-full rounded-md px-2.5 py-1.5 text-left text-[13px] hover:bg-surface-2"
                      >
                        Claude
                      </button>
                      <button
                        type="button"
                        onClick={() => askAi("gemini")}
                        className="block w-full rounded-md px-2.5 py-1.5 text-left text-[13px] hover:bg-surface-2"
                      >
                        Gemini
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <p className="mt-3 text-[11.5px] leading-relaxed text-muted/80">
                Text and images belong to {source?.name ?? article.siteName ?? "the publisher"}.
                {tr.provider ? ` Translations via ${tr.provider}.` : ""}
              </p>
            </div>
          </article>
        )}
      </div>

      {word && (
        <WordPopover
          query={word}
          lang={lang}
          target={target}
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
          target={target}
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

      {showShortcuts && (
        <div
          className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
          onClick={() => setShowShortcuts(false)}
        >
          <div
            className="animate-popover card max-w-sm w-full p-5 space-y-4 shadow-2xl glass-strong border border-border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base">Keyboard Shortcuts</h3>
              <button
                type="button"
                onClick={() => setShowShortcuts(false)}
                className="btn !p-1 text-muted hover:text-fg"
                aria-label="Close"
              >
                <CloseIcon width={16} height={16} />
              </button>
            </div>
            <div className="space-y-2 text-xs divide-y divide-border/60">
              <div className="flex justify-between items-center pt-2">
                <span className="text-muted">Next / Prev line</span>
                <span className="flex gap-1 font-mono">
                  <kbd className="rounded bg-surface-2 px-1.5 py-0.5 border border-border">j</kbd>
                  <kbd className="rounded bg-surface-2 px-1.5 py-0.5 border border-border">k</kbd>
                </span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-muted">Reveal translation</span>
                <span className="flex gap-1 font-mono items-center">
                  <kbd className="rounded bg-surface-2 px-1.5 py-0.5 border border-border">t</kbd>
                  <span className="text-muted text-[10px]">or</span>
                  <kbd className="rounded bg-surface-2 px-1.5 py-0.5 border border-border">Enter</kbd>
                </span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-muted">Play / Pause read aloud</span>
                <span className="flex gap-1 font-mono items-center">
                  <kbd className="rounded bg-surface-2 px-1.5 py-0.5 border border-border">p</kbd>
                  <span className="text-muted text-[10px]">or</span>
                  <kbd className="rounded bg-surface-2 px-1.5 py-0.5 border border-border">Space</kbd>
                </span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-muted">Save / Bookmark article</span>
                <kbd className="rounded bg-surface-2 px-1.5 py-0.5 border border-border font-mono">s</kbd>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-muted">Close active line / popups</span>
                <kbd className="rounded bg-surface-2 px-1.5 py-0.5 border border-border font-mono">Esc</kbd>
              </div>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={goBack}
        aria-label={t("reader.back")}
        title={t("reader.back")}
        className={`glass-strong fixed bottom-[calc(8.25rem+env(safe-area-inset-bottom))] right-4 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-border shadow-[var(--shadow)] transition-all duration-200 hover:scale-105 active:scale-95 sm:hidden ${
          chromeActive ? "opacity-100" : "opacity-25 hover:opacity-100 focus-within:opacity-100"
        }`}
      >
        <ArrowLeftIcon width={18} height={18} />
      </button>

      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

function focusLine(key: string, setActive: (k: string) => void) {
  setActive(key);
  const el = document.getElementById(`line-${key}`);
  el?.scrollIntoView({ block: "center", behavior: "smooth" });
}
