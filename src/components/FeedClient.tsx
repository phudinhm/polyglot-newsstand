"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSettings } from "@/hooks/useSettings";
import { CATEGORY_LABELS, SOURCE_BY_ID } from "@/lib/sources";
import type { FeedItem, FeedResponse } from "@/lib/types";
import { ArticleCard } from "./ArticleCard";
import { RefreshIcon, SearchIcon, SpinnerIcon } from "./Icons";

type LangFilter = "all" | "de" | "en";

export function FeedClient() {
  const [settings, , ready] = useSettings();
  const [data, setData] = useState<FeedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState<LangFilter>("all");
  const [category, setCategory] = useState<string>("all");
  const [query, setQuery] = useState("");

  const sourceKey = settings.sources.join(",");

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/feed?sources=${encodeURIComponent(sourceKey)}`, { signal });
        if (!res.ok) throw new Error(`The newsstand is unreachable (${res.status}).`);
        setData((await res.json()) as FeedResponse);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Could not load the feed.");
      } finally {
        setLoading(false);
      }
    },
    [sourceKey],
  );

  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [ready, load]);

  const items = useMemo(() => {
    let list: FeedItem[] = data?.items ?? [];
    if (lang !== "all") list = list.filter((i) => i.lang === lang);
    if (category !== "all") list = list.filter((i) => i.category === category);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.summary.toLowerCase().includes(q) ||
          i.sourceName.toLowerCase().includes(q),
      );
    }
    return list;
  }, [data, lang, category, query]);

  const categories = useMemo(() => {
    const present = new Set((data?.items ?? []).map((i) => i.category));
    return Object.keys(CATEGORY_LABELS).filter((c) => present.has(c as FeedItem["category"]));
  }, [data]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Today&apos;s newsstand</h1>
          <p className="mt-1 text-sm text-muted">
            {settings.sources.length} sources on the shelf. Pick a story and read it line by line.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="btn"
          aria-label="Refresh the feed"
        >
          {loading ? <SpinnerIcon /> : <RefreshIcon />}
          Refresh
        </button>
      </div>

      {/* Filters. Everything is client side, so switching is instant. */}
      <div className="sticky top-[57px] z-20 -mx-4 mb-4 space-y-2.5 border-b border-border bg-bg/90 px-4 pb-3 pt-1 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-1.5 focus-within:border-accent">
            <SearchIcon className="shrink-0 text-muted" width={16} height={16} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search headlines"
              className="w-40 bg-transparent text-sm outline-none placeholder:text-muted sm:w-56"
              aria-label="Search headlines"
            />
          </div>
          <div className="flex gap-1.5">
            {(["all", "de", "en"] as LangFilter[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setLang(value)}
                data-selected={lang === value}
                className="chip"
              >
                {value === "all" ? "All" : value === "de" ? "Deutsch" : "English"}
              </button>
            ))}
          </div>
        </div>

        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
          <button
            type="button"
            onClick={() => setCategory("all")}
            data-selected={category === "all"}
            className="chip"
          >
            Everything
          </button>
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              data-selected={category === c}
              className="chip"
            >
              {CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="card mb-4 border-accent/40 p-4 text-sm">
          <p className="font-medium">{error}</p>
          <button type="button" onClick={() => void load()} className="btn mt-3">
            Try again
          </button>
        </div>
      )}

      {loading && !data && (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-4">
              <div className="skeleton mb-2 h-3 w-24" />
              <div className="skeleton mb-2 h-4 w-3/4" />
              <div className="skeleton h-3 w-1/2" />
            </div>
          ))}
        </div>
      )}

      {!loading && !items.length && !error && (
        <div className="card p-8 text-center">
          <p className="font-medium">Nothing matches those filters.</p>
          <p className="mt-1 text-sm text-muted">
            Try another category, or add more publications on the{" "}
            <Link href="/sources" className="underline underline-offset-2">
              Sources
            </Link>{" "}
            page.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {items.map((item) => (
          <ArticleCard key={item.id} item={item} />
        ))}
      </div>

      {/* Being upfront about what did not load beats a mysteriously short list. */}
      {data?.failed?.length ? (
        <details className="mt-6 text-xs text-muted">
          <summary className="cursor-pointer">
            {data.failed.length} source{data.failed.length > 1 ? "s" : ""} did not respond
          </summary>
          <ul className="mt-2 space-y-1">
            {data.failed.map((f) => (
              <li key={f.sourceId}>
                <span className="font-medium">{SOURCE_BY_ID.get(f.sourceId)?.name ?? f.name}</span>
                {": "}
                {f.reason}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
