"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSettings } from "@/hooks/useSettings";
import { CATEGORY_LABELS } from "@/lib/sources";
import { getCustomSources, type CustomSource } from "@/lib/customSources";
import type { FeedItem, FeedResponse } from "@/lib/types";
import { ArticleCard, FeaturedCard } from "./ArticleCard";
import { Greeting } from "./Greeting";
import { RefreshIcon, SearchIcon, SlidersIcon, SpinnerIcon } from "./Icons";

type LangFilter = "all" | "de" | "en";
type SortOrder = "newest" | "oldest";

const PAGE_SIZE = 24;

const monthLabel = (key: string) => {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
};

/** "Today", "Yesterday", then the date. Gives a long list a spine. */
function dayLabel(iso?: string): string {
  if (!iso) return "Undated";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Undated";
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return date.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
}

export function FeedClient() {
  const [settings, , ready] = useSettings();
  const [custom, setCustom] = useState<CustomSource[]>([]);
  const [data, setData] = useState<FeedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [lang, setLang] = useState<LangFilter>("all");
  const [category, setCategory] = useState("all");
  const [month, setMonth] = useState("all");
  const [sort, setSort] = useState<SortOrder>("newest");
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sync = () => setCustom(getCustomSources());
    sync();
    window.addEventListener("pn:store", sync);
    return () => window.removeEventListener("pn:store", sync);
  }, []);

  // Close the filter popover on an outside click, the way a menu should behave.
  useEffect(() => {
    if (!filtersOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!filterRef.current?.contains(e.target as Node)) setFiltersOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFiltersOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [filtersOpen]);

  const sourceKey = settings.sources.join(",");
  const customKey = custom.map((c) => c.feed).join(",");

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/feed", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            sources: settings.sources,
            custom: custom.filter((c) => settings.sources.includes(c.id)),
          }),
          signal,
        });
        if (!res.ok) throw new Error(`The newsstand is unreachable (${res.status}).`);
        setData((await res.json()) as FeedResponse);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Could not load the feed.");
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sourceKey, customKey],
  );

  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [ready, load]);

  useEffect(() => setVisible(PAGE_SIZE), [lang, category, month, sort, query]);

  const months = useMemo(() => {
    const keys = new Set<string>();
    for (const item of data?.items ?? []) {
      if (!item.publishedAt) continue;
      const date = new Date(item.publishedAt);
      if (Number.isNaN(date.getTime())) continue;
      keys.add(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
    }
    return Array.from(keys).sort().reverse();
  }, [data]);

  const filtered = useMemo(() => {
    let list: FeedItem[] = data?.items ?? [];
    if (lang !== "all") list = list.filter((i) => i.lang === lang);
    if (category !== "all") list = list.filter((i) => i.category === category);
    if (month !== "all") {
      list = list.filter((i) => {
        if (!i.publishedAt) return false;
        const d = new Date(i.publishedAt);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` === month;
      });
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.summary.toLowerCase().includes(q) ||
          i.sourceName.toLowerCase().includes(q),
      );
    }
    // Newest first is the default and the point; the toggle is for archives.
    return [...list].sort((a, b) => {
      const ta = a.publishedAt ? Date.parse(a.publishedAt) : 0;
      const tb = b.publishedAt ? Date.parse(b.publishedAt) : 0;
      return sort === "newest" ? tb - ta : ta - tb;
    });
  }, [data, lang, category, month, query, sort]);

  const categories = useMemo(() => {
    const present = new Set((data?.items ?? []).map((i) => i.category));
    return Object.keys(CATEGORY_LABELS).filter((c) => present.has(c as FeedItem["category"]));
  }, [data]);

  const untouched = lang === "all" && category === "all" && month === "all" && !query.trim();
  const showFeatured = untouched && sort === "newest" && filtered.length > 3;
  const featured = showFeatured ? filtered[0] : null;
  const rest = showFeatured ? filtered.slice(1) : filtered;
  const page = rest.slice(0, visible);

  const groups = useMemo(() => {
    const out: { label: string; items: FeedItem[] }[] = [];
    for (const item of page) {
      const label = dayLabel(item.publishedAt);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(item);
      else out.push({ label, items: [item] });
    }
    return out;
  }, [page]);

  const extraFilters = (month !== "all" ? 1 : 0) + (sort !== "newest" ? 1 : 0);

  return (
    <div className="mx-auto max-w-3xl px-4 pb-8 pt-5 sm:pt-7">
      <div className="mb-4 flex items-start justify-between gap-3">
        <Greeting count={data?.items.length ?? 0} />
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="btn mt-1 shrink-0 !px-2.5"
          aria-label="Refresh the feed"
        >
          {loading ? <SpinnerIcon /> : <RefreshIcon />}
        </button>
      </div>

      {/* One light bar instead of two dense rows of chips. */}
      <div className="sticky top-[var(--header-height)] z-20 -mx-4 mb-4 space-y-2 px-4 pb-2.5 pt-2 glass">
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-surface/70 px-2.5 py-1.5 focus-within:border-accent">
            <SearchIcon className="shrink-0 text-muted" width={16} height={16} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search headlines"
              className="w-full bg-transparent text-[13.5px] outline-none placeholder:text-muted"
              aria-label="Search headlines"
            />
          </div>

          <div className="flex rounded-lg border border-border bg-surface/70 p-0.5">
            {(["all", "de", "en"] as LangFilter[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setLang(value)}
                className={`rounded-md px-2 py-1 text-[12.5px] font-medium transition-colors ${
                  lang === value ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"
                }`}
                aria-pressed={lang === value}
              >
                {value === "all" ? "All" : value.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="relative" ref={filterRef}>
            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              className={`btn !px-2.5 ${extraFilters ? "btn-primary" : ""}`}
              aria-label="More filters"
              aria-expanded={filtersOpen}
            >
              <SlidersIcon width={16} height={16} />
            </button>
            {filtersOpen && (
              <div className="absolute right-0 top-full z-30 mt-1.5 w-60 rounded-xl border border-border p-3 shadow-[var(--shadow)] glass-strong">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                  Month
                </label>
                <select
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="input mt-1 w-full"
                >
                  <option value="all">Any month</option>
                  {months.map((m) => (
                    <option key={m} value={m}>
                      {monthLabel(m)}
                    </option>
                  ))}
                </select>

                <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wider text-muted">
                  Order
                </label>
                <div className="mt-1 flex gap-1.5">
                  {(["newest", "oldest"] as SortOrder[]).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setSort(value)}
                      data-selected={sort === value}
                      className="chip flex-1 !justify-center"
                    >
                      {value === "newest" ? "Newest" : "Oldest"}
                    </button>
                  ))}
                </div>

                {extraFilters > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setMonth("all");
                      setSort("newest");
                    }}
                    className="btn mt-3 w-full justify-center !py-1.5 text-xs"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
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
        <div className="space-y-2.5">
          <div className="card overflow-hidden">
            <div className="skeleton h-44 w-full !rounded-none sm:h-52" />
            <div className="space-y-2 p-5">
              <div className="skeleton h-3 w-28" />
              <div className="skeleton h-6 w-3/4" />
            </div>
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="card flex gap-4 p-4">
              <div className="flex-1 space-y-2">
                <div className="skeleton h-3 w-24" />
                <div className="skeleton h-4 w-3/4" />
              </div>
              <div className="skeleton h-[5.5rem] w-[7.5rem] shrink-0" />
            </div>
          ))}
        </div>
      )}

      {!loading && !filtered.length && !error && (
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

      {featured && (
        <div className="mb-5">
          <FeaturedCard item={featured} />
        </div>
      )}

      <div className="space-y-6">
        {groups.map((group) => (
          <section key={group.label}>
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
              {group.label}
            </h2>
            <div className="space-y-2.5">
              {group.items.map((item) => (
                <ArticleCard key={item.id} item={item} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {rest.length > visible && (
        <button
          type="button"
          onClick={() => setVisible((v) => v + PAGE_SIZE)}
          className="btn mx-auto mt-6 flex"
        >
          Show more
        </button>
      )}

      {/* One quiet line instead of a status block and a details disclosure. */}
      {data?.failed?.length ? (
        <p className="mt-8 text-center text-[12.5px] text-muted">
          {data.failed.length} source{data.failed.length > 1 ? "s" : ""} did not answer.{" "}
          <Link href="/sources" className="underline underline-offset-2">
            Check my sources
          </Link>
        </p>
      ) : null}
    </div>
  );
}
