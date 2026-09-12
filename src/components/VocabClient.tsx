"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useT } from "@/hooks/useT";
import { clearVocab, getVocab, removeVocab, setVocabStatus, vocabToCsv } from "@/lib/store";
import type { VocabEntry } from "@/lib/types";
import { timeAgo } from "@/lib/format";
import { CheckIcon, DownloadIcon, SearchIcon, TrashIcon } from "./Icons";

export function VocabClient() {
  const [entries, setEntries] = useState<VocabEntry[]>([]);
  const t = useT();
  const [query, setQuery] = useState("");
  const [lang, setLang] = useState<"all" | "de" | "en" | "vi">("all");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setEntries(getVocab());
    setReady(true);
    const onStore = () => setEntries(getVocab());
    window.addEventListener("pn:store", onStore);
    return () => window.removeEventListener("pn:store", onStore);
  }, []);

  const filtered = useMemo(() => {
    let list = entries;
    if (lang !== "all") list = list.filter((e) => e.lang === lang);
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
  }, [entries, lang, query]);

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
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{t("vocab.title")}</h1>
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

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-1.5 focus-within:border-accent">
          <SearchIcon className="shrink-0 text-muted" width={16} height={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("vocab.search")}
            className="w-44 bg-transparent text-sm outline-none placeholder:text-muted sm:w-60"
            aria-label="Search your vocabulary"
          />
        </div>
        {(["all", "de", "en", "vi"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setLang(value)}
            data-selected={lang === value}
            className="chip"
          >
            {value === "all" ? "All" : value === "de" ? "Deutsch" : value === "en" ? "English" : "Tiếng Việt"}
          </button>
        ))}
        {entries.length > 0 && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Delete every saved word? This cannot be undone.")) {
                clearVocab();
                setEntries([]);
              }
            }}
            className="btn ml-auto !px-2.5 !py-1.5 text-xs"
          >
            <TrashIcon width={14} height={14} /> {t("vocab.clearAll")}
          </button>
        )}
      </div>

      {ready && !entries.length && (
        <div className="card p-8 text-center">
          <p className="font-medium">Your vocabulary is empty for now.</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            While reading, double click or long press any word to look it up and save it. The
            sentence it came from is saved with it, which is what makes a word stick.
          </p>
          <Link href="/" className="btn btn-primary mt-4 inline-flex">
            Find something to read
          </Link>
        </div>
      )}

      <ul className="space-y-2">
        {filtered.map((entry) => (
          <li key={entry.id} className="card p-3.5">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="text-[15px] font-semibold" lang={entry.lang}>
                    {entry.term}
                  </span>
                  <span className="text-translation">{entry.translation || "—"}</span>
                  <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] uppercase text-muted">
                    {entry.lang}
                  </span>
                  {entry.status === "known" && (
                    <span className="rounded-full bg-[color-mix(in_srgb,var(--translation)_18%,transparent)] px-1.5 py-0.5 text-[10px] text-translation">
                      {t("vocab.known")}
                    </span>
                  )}
                </div>
                {entry.context && (
                  <p className="mt-1.5 text-[13px] leading-relaxed text-muted" lang={entry.lang}>
                    {entry.context}
                  </p>
                )}
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted">
                  <span>{timeAgo(entry.createdAt)}</span>
                  {entry.articleUrl && (
                    <>
                      <span aria-hidden>·</span>
                      <a
                        href={entry.articleUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="truncate underline underline-offset-2"
                      >
                        {entry.articleTitle ?? "source article"}
                      </a>
                    </>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setVocabStatus(entry.id, entry.status === "known" ? "learning" : "known");
                    setEntries(getVocab());
                  }}
                  className={`btn px-2 py-1.5 text-xs ${entry.status === "known" ? "btn-primary" : ""}`}
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
                  className="btn px-2 py-1.5"
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
