"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useT } from "@/hooks/useT";
import { useSettings } from "@/hooks/useSettings";
import { clearVocab, getVocab, removeVocab, setVocabStatus, vocabToCsv } from "@/lib/store";
import { restoreScrollPosition, saveScrollPosition } from "@/lib/scrollMemory";
import type { VocabEntry } from "@/lib/types";
import { readerHref, timeAgo } from "@/lib/format";
import { speak, speechSupported } from "@/lib/tts";
import { CheckIcon, CloseIcon, DownloadIcon, SearchIcon, SpeakerIcon, TrashIcon } from "./Icons";

export function VocabClient() {
  const [entries, setEntries] = useState<VocabEntry[]>([]);
  const [settings] = useSettings();
  const t = useT();
  const [query, setQuery] = useState("");
  const [lang, setLang] = useState<"all" | "de" | "en" | "vi">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "learning" | "known">("all");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setEntries(getVocab());
    setReady(true);
    const onStore = () => setEntries(getVocab());
    window.addEventListener("pn:store", onStore);
    return () => window.removeEventListener("pn:store", onStore);
  }, []);

  useEffect(() => {
    if (!ready) return;
    restoreScrollPosition({ path: "/vocab" });
    const onScroll = () => saveScrollPosition("/vocab", window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [ready]);

  const counts = useMemo(() => {
    let learning = 0;
    let known = 0;
    for (const e of entries) {
      if (e.status === "known") known += 1;
      else learning += 1;
    }
    return { learning, known };
  }, [entries]);

  const filtered = useMemo(() => {
    let list = entries;
    if (lang !== "all") list = list.filter((e) => e.lang === lang);
    if (statusFilter !== "all") {
      list = list.filter((e) => (e.status ?? "learning") === statusFilter);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (e) =>
          e.term.toLowerCase().includes(q) ||
          e.translation.toLowerCase().includes(q) ||
          (e.context ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [entries, lang, statusFilter, query]);

  function download(kind: "csv" | "json") {
    const body =
      kind === "csv" ? vocabToCsv(filtered) : JSON.stringify(filtered, null, 2);
    const blob = new Blob([body], {
      type: kind === "csv" ? "text/csv;charset=utf-8" : "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `polyglot-vocabulary-${new Date().toISOString().slice(0, 10)}.${kind}`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{t("vocab.title")}</h1>
          <p className="mt-1 text-sm text-muted">
            {entries.length} word{entries.length === 1 ? "" : "s"} saved, each with the sentence you
            met it in. Export to CSV and it imports straight into Anki or Quizlet.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => download("csv")}
            disabled={!filtered.length}
            className="btn"
          >
            <DownloadIcon /> CSV
          </button>
          <button
            type="button"
            onClick={() => download("json")}
            disabled={!filtered.length}
            className="btn"
          >
            <DownloadIcon /> JSON
          </button>
        </div>
      </header>

      <div className="sticky top-[var(--header-offset)] z-20 -mx-4 mb-4 space-y-2 px-4 py-2.5 glass">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-surface/80 px-3 py-1.5 focus-within:border-accent">
            <SearchIcon className="shrink-0 text-muted" width={16} height={16} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("vocab.search")}
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
              aria-label="Search your vocabulary"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="text-muted hover:text-fg"
                aria-label="Clear search"
              >
                <CloseIcon width={14} height={14} />
              </button>
            )}
          </div>
          {entries.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Delete every saved word? This cannot be undone.")) {
                  clearVocab();
                  setEntries([]);
                }
              }}
              className="btn !px-2.5 !py-1.5 text-xs text-muted hover:text-accent"
            >
              <TrashIcon width={14} height={14} /> {t("vocab.clearAll")}
            </button>
          )}
        </div>

        <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {(["all", "learning", "known"] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              data-selected={statusFilter === st}
              className="chip !py-1.5"
            >
              {st === "all"
                ? `All (${entries.length})`
                : st === "learning"
                  ? `Learning (${counts.learning})`
                  : `${t("vocab.known")} (${counts.known})`}
            </button>
          ))}
          <span className="mx-1 h-4 w-px shrink-0 bg-border" aria-hidden />
          {(["all", "de", "en", "vi"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setLang(value)}
              data-selected={lang === value}
              className="chip !py-1.5"
            >
              {value === "all"
                ? t("feed.all")
                : value === "de"
                  ? "Deutsch"
                  : value === "en"
                    ? "English"
                    : "Tiếng Việt"}
            </button>
          ))}
        </div>
      </div>

      {ready && !entries.length && (
        <div className="card p-8 text-center">
          <p className="font-medium">Your vocabulary is empty for now.</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            While reading, tap any word to look it up and save it. The
            sentence it came from is saved with it, which is what makes a word stick.
          </p>
          <Link href="/" className="btn btn-primary mt-4 inline-flex">
            Find something to read
          </Link>
        </div>
      )}

      <ul className="space-y-2.5">
        {filtered.map((entry) => (
          <li
            key={entry.id}
            className={`card vocab-card-item p-3.5 transition-colors sm:p-4 ${
              entry.status === "known" ? "border-l-4 border-l-[var(--translation)]" : "border-l-4 border-l-accent"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <span className="text-[16px] font-bold tracking-tight" lang={entry.lang}>
                    {entry.term}
                  </span>
                  {speechSupported() && (
                    <button
                      type="button"
                      onClick={() =>
                        speak(entry.term, {
                          lang: entry.lang,
                          rate: settings.speechRate,
                          voiceUri: settings.voices[entry.lang],
                        })
                      }
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-surface-2 text-muted transition-colors hover:bg-accent/15 hover:text-accent active:scale-90"
                      aria-label={`Listen to ${entry.term}`}
                      title={`Pronounce "${entry.term}"`}
                    >
                      <SpeakerIcon width={14} height={14} />
                    </button>
                  )}
                  <span className="font-medium text-translation">{entry.translation || "—"}</span>
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold uppercase text-muted">
                    {entry.lang}
                  </span>
                  {entry.status === "known" && (
                    <span className="rounded-full bg-[color-mix(in_srgb,var(--translation)_18%,transparent)] px-2 py-0.5 text-[10.5px] font-semibold text-translation">
                      ✓ {t("vocab.known")}
                    </span>
                  )}
                </div>
                {entry.context && (
                  <p className="mt-2 rounded-lg bg-surface-2/60 px-3 py-2 text-[13.5px] leading-relaxed text-fg/90" lang={entry.lang}>
                    “{entry.context}”
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-x-2 text-[11.5px] text-muted">
                  <span>{timeAgo(entry.createdAt)}</span>
                  {entry.articleUrl && (
                    <>
                      <span aria-hidden>·</span>
                      <Link
                        href={readerHref({ url: entry.articleUrl, lang: entry.lang })}
                        className="truncate font-medium text-accent hover:underline"
                      >
                        {entry.articleTitle ?? "Open in Reader →"}
                      </Link>
                    </>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5 sm:flex-col">
                <button
                  type="button"
                  onClick={() => {
                    setVocabStatus(entry.id, entry.status === "known" ? "learning" : "known");
                    setEntries(getVocab());
                  }}
                  className={`btn !px-2.5 !py-2 text-xs ${entry.status === "known" ? "btn-primary" : ""}`}
                  aria-pressed={entry.status === "known"}
                  title={entry.status === "known" ? "Known" : "Mark as known"}
                >
                  <CheckIcon width={15} height={15} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    removeVocab(entry.id);
                    setEntries(getVocab());
                  }}
                  className="btn !px-2.5 !py-2 text-muted hover:text-accent"
                  aria-label={`Remove ${entry.term}`}
                >
                  <TrashIcon width={15} height={15} />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
