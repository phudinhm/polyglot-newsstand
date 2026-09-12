"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSettings } from "@/hooks/useSettings";
import { useT } from "@/hooks/useT";
import { categoryKey } from "@/lib/i18n";
import { CATEGORY_LABELS } from "@/lib/sources";
import { getCustomSources, type CustomSource } from "@/lib/customSources";
import { getCachedFeed, setCachedFeed } from "@/lib/feedCache";
import { getFeedFilters, setFeedFilters } from "@/lib/feedFilters";
import { blockedIds, forgetBlocked } from "@/lib/blocked";
import { getReadUrls } from "@/lib/recent";
import { getSavedFeedVisible, restoreScrollPosition, saveScrollPosition } from "@/lib/scrollMemory";
import { SOURCES } from "@/lib/sources";
import type { FeedItem, FeedResponse } from "@/lib/types";
import { ArticleCard, FeaturedCard } from "./ArticleCard";
import { Greeting } from "./Greeting";
import { RecentlyRead } from "./RecentlyRead";
import { SourceRail } from "./SourceRail";
import { SourceAvatar } from "./SourceAvatar";
import { CloseIcon, RefreshIcon, SearchIcon, SlidersIcon, SpinnerIcon } from "./Icons";

type LangFilter = "all" | "de" | "en" | "vi";
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
function dayLabel(iso: string | undefined, t: (k: "feed.today" | "feed.yesterday") => string): string {
  if (!iso) return "Undated";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Undated";
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000);
  if (days === 0) return t("feed.today");
  if (days === 1) return t("feed.yesterday");
  return date.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
}

export function FeedClient() {
  const [settings, update, ready] = useSettings();
  const t = useT();
  const [custom, setCustom] = useState<CustomSource[]>([]);
  const [data, setData] = useState<FeedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const initialFilters = useRef(getFeedFilters()).current;
  const [lang, setLang] = useState<LangFilter>(initialFilters.lang);
  const [category, setCategory] = useState(initialFilters.category);
  const [month, setMonth] = useState(initialFilters.month);
  const [sort, setSort] = useState<SortOrder>(initialFilters.sort);
  const [queryInput, setQueryInput] = useState(initialFilters.query);
  const [query, setQuery] = useState(initialFilters.query);
  const [source, setSource] = useState<string | null>(initialFilters.source);
  const [visible, setVisible] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = getSavedFeedVisible();
      if (saved && saved > PAGE_SIZE) return saved;
    }
    return PAGE_SIZE;
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => saveScrollPosition("/");
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const sync = () => setCustom(getCustomSources());
    sync();
    window.addEventListener("pn:store", sync);
    return () => window.removeEventListener("pn:store", sync);
  }, []);

  // Persisted so a trip to an article and back does not reset the filters.
  useEffect(() => {
    setFeedFilters({ lang, category, month, sort, query: queryInput, source });
  }, [lang, category, month, sort, queryInput, source]);

  const [readUrls, setReadUrls] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    const sync = () => setReadUrls(getReadUrls());
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
  const favoritesKey = settings.favorites.join(",");
  // Folded into the cache key, not just load()'s own deps: toggling a
  // favorite has to refetch with the new priority order right away, not wait
  // out however much of the 5-minute staleness window is left.
  const cacheKey = `${sourceKey}|${customKey}|${favoritesKey}`;

  const load = useCallback(
    async (signal?: AbortSignal, background = false) => {
      if (!background) setLoading(true);
      setError(null);
      try {
        // The feed API only ever fetches the first MAX_SOURCES of these, so a
        // favorite needs to be near the front of the list to survive a shelf
        // bigger than that - not wherever it happened to land (Array.sort is
        // stable, so everything else keeps its existing relative order).
        const favoriteSet = new Set(settings.favorites);
        const orderedSources = [...settings.sources].sort(
          (a, b) => Number(favoriteSet.has(b)) - Number(favoriteSet.has(a)),
        );
        const res = await fetch("/api/feed", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            sources: orderedSources,
            custom: custom.filter((c) => settings.sources.includes(c.id)),
          }),
          signal,
        });
        if (!res.ok) throw new Error(`The newsstand is unreachable (${res.status}).`);
        const fresh = (await res.json()) as FeedResponse;
        setData(fresh);
        setCachedFeed(cacheKey, fresh);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        // A background refresh that fails should leave what is on screen alone.
        if (!background) setError(err instanceof Error ? err.message : "Could not load the feed.");
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sourceKey, customKey, favoritesKey],
  );

  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();

    // Paint from what we already have, then quietly catch up if it is old.
    const cached = getCachedFeed(cacheKey);
    if (cached) {
      setData(cached.response);
      setLoading(false);
      restoreScrollPosition({ path: "/" });
      if (cached.stale) void load(controller.signal, true);
    } else {
      void load(controller.signal);
    }

    return () => controller.abort();
  }, [ready, load, cacheKey]);

  useEffect(() => {
    if (!loading && data) {
      restoreScrollPosition({ path: "/" });
    }
  }, [loading, data]);

  // Filtering a few hundred stories per keystroke is felt on a phone.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(queryInput), 180);
    return () => clearTimeout(timer);
  }, [queryInput]);

  useEffect(() => setVisible(PAGE_SIZE), [lang, category, month, sort, query, source]);

  // How much each paper has on the shelf today, for the rail.
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of data?.items ?? []) {
      map.set(item.sourceId, (map.get(item.sourceId) ?? 0) + 1);
    }
    return map;
  }, [data]);

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

  // Sources this device has actually been turned away from, read once per
  // mount: localStorage is not reactive and a render is not the place to ask.
  const [blocked, setBlocked] = useState<Set<string>>(() => new Set());
  useEffect(() => setBlocked(blockedIds()), []);

  const filtered = useMemo(() => {
    let list: FeedItem[] = data?.items ?? [];
    // Papers that lock most articles stay off the shelf until asked for: a
    // headline you cannot open is worse than one you never saw.
    if (settings.hidePaywalled && !source) {
      list = list.filter((i) => i.paywall !== "hard" && !blocked.has(i.sourceId));
    }
    if (settings.hideRead) list = list.filter((i) => !readUrls.has(i.link));
    if (source) list = list.filter((i) => i.sourceId === source);
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
  }, [data, lang, category, month, query, sort, source, settings.hidePaywalled, settings.hideRead, blocked, readUrls]);

  // A tab only ever appears once its category actually has a story behind it.
  // Deriving this from the shelf's sources instead - every category any added
  // source is filed under - looked more stable, but the feed only ever
  // fetches the first MAX_SOURCES of them (see src/app/api/feed/route.ts):
  // past that cap a source sits on the shelf without ever being fetched, so
  // its category got a tab that could never show anything. "Add all" is the
  // fastest way to hit that ceiling - 175 sources on the shelf, 24 fetched.
  const categories = useMemo(() => {
    const present = new Set((data?.items ?? []).map((i) => i.category));
    return Object.keys(CATEGORY_LABELS).filter((c) => present.has(c as FeedItem["category"]));
  }, [data]);

  /**
   * When a section comes up empty, the papers that would fill it. Ranked so a
   * reader gets something they can actually read: their own languages first,
   * then the ones that are not behind a paywall.
   */
  const emptyCategoryPicks = useMemo(() => {
    if (category === "all" || filtered.length) return [];
    const onShelf = new Set(settings.sources);
    return SOURCES.filter((s) => s.category === category && !onShelf.has(s.id))
      .sort(
        (a, b) =>
          Number(a.paywall === "hard") - Number(b.paywall === "hard") ||
          Number(b.lang === "de") - Number(a.lang === "de") ||
          a.name.localeCompare(b.name),
      )
      .slice(0, 3);
  }, [category, filtered.length, settings.sources]);

  const untouched =
    lang === "all" && category === "all" && month === "all" && !query.trim() && !source;
  const showFeatured = untouched && sort === "newest" && filtered.length > 3;
  const featured = showFeatured ? filtered[0] : null;
  const rest = showFeatured ? filtered.slice(1) : filtered;
  const page = rest.slice(0, visible);

  const groups = useMemo(() => {
    const out: { label: string; items: FeedItem[] }[] = [];
    for (const item of page) {
      const label = dayLabel(item.publishedAt, t);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(item);
      else out.push({ label, items: [item] });
    }
    return out;
  }, [page, t]);

  const extraFilters =
    (month !== "all" ? 1 : 0) +
    (sort !== "newest" ? 1 : 0) +
    (settings.hidePaywalled ? 0 : 1) +
    (settings.hideRead ? 1 : 0);

  // How many stories the paywall filter is holding back, so the toggle can say.
  const hiddenByPaywall = useMemo(
    () => (data?.items ?? []).filter((i) => i.paywall === "hard" || blocked.has(i.sourceId)).length,
    [data, blocked],
  );

  // How many stories are already read, so the toggle can say, whether or not
  // it is currently hiding them.
  const hiddenByRead = useMemo(
    () => (data?.items ?? []).filter((i) => readUrls.has(i.link)).length,
    [data, readUrls],
  );

  // Named rather than counted: a reader who wonders where a paper went
  // deserves to see the paper's name and a way to bring it back.
  const blockedNames = useMemo(() => {
    const names = new Map<string, string>();
    for (const item of data?.items ?? []) {
      if (blocked.has(item.sourceId)) names.set(item.sourceId, item.sourceName);
    }
    return [...names].map(([id, name]) => ({ id, name }));
  }, [data, blocked]);

  return (
    <div className="mx-auto max-w-3xl px-4 pb-8 pt-5 sm:pt-7">
      <div className="mb-3.5 flex items-start justify-between gap-3">
        <Greeting count={data?.items.length ?? 0} />
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="btn mt-1 shrink-0 !px-2.5"
          aria-label={t("feed.refresh")}
        >
          {loading ? <SpinnerIcon /> : <RefreshIcon />}
        </button>
      </div>

      <RecentlyRead />

      <SourceRail
        shelf={settings.sources}
        favorites={settings.favorites}
        selected={source}
        onSelect={setSource}
        counts={counts}
      />

      {/* One light bar instead of two dense rows of chips. */}
      <div className="sticky top-[var(--header-height)] z-20 -mx-4 mb-4 space-y-2 px-4 pb-2.5 pt-2 glass">
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-surface/70 px-2.5 py-1.5 focus-within:border-accent">
            <SearchIcon className="shrink-0 text-muted" width={16} height={16} />
            <input
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              placeholder={t("feed.search")}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className="w-full bg-transparent text-[13.5px] outline-none placeholder:text-muted"
              aria-label={t("feed.search")}
            />
            {queryInput && (
              <button
                type="button"
                onClick={() => setQueryInput("")}
                className="shrink-0 text-muted hover:text-fg"
                aria-label={t("feed.clearSearch")}
              >
                <CloseIcon width={14} height={14} />
              </button>
            )}
          </div>

          <div className="flex rounded-lg border border-border bg-surface/70 p-0.5">
            {(["all", "de", "en", "vi"] as LangFilter[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setLang(value)}
                className={`rounded-md px-2 py-1 text-[12.5px] font-medium transition-colors ${
                  lang === value ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"
                }`}
                aria-pressed={lang === value}
              >
                {value === "all" ? t("feed.all") : value.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="relative" ref={filterRef}>
            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              className={`btn !px-2.5 ${extraFilters ? "btn-primary" : ""}`}
              aria-label={t("feed.moreFilters")}
              aria-expanded={filtersOpen}
            >
              <SlidersIcon width={16} height={16} />
            </button>
            {filtersOpen && (
              <div className="absolute right-0 top-full z-30 mt-1.5 w-60 rounded-xl border border-border p-3 shadow-[var(--shadow)] glass-strong">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                  {t("feed.month")}
                </label>
                <select
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="input mt-1 w-full"
                >
                  <option value="all">{t("feed.anyMonth")}</option>
                  {months.map((m) => (
                    <option key={m} value={m}>
                      {monthLabel(m)}
                    </option>
                  ))}
                </select>

                <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wider text-muted">
                  {t("feed.order")}
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
                      {value === "newest" ? t("feed.newest") : t("feed.oldest")}
                    </button>
                  ))}
                </div>

                <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wider text-muted">
                  {t("feed.paywalls")}
                </label>
                <button
                  type="button"
                  onClick={() => update({ hidePaywalled: !settings.hidePaywalled })}
                  data-selected={!settings.hidePaywalled}
                  className="chip mt-1 w-full !justify-center !py-1.5"
                >
                  {settings.hidePaywalled ? t("feed.includeLocked") : t("feed.hidingLocked")}
                </button>
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
                  {settings.hidePaywalled
                    ? `${hiddenByPaywall} ${hiddenByPaywall === 1 ? "story is" : "stories are"} hidden from papers that lock most articles. Papers that only meter some, like ZEIT or SPIEGEL, stay and carry a badge.`
                    : "Showing everything, including papers where most articles open on their own site."}
                </p>

                <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wider text-muted">
                  {t("feed.alreadyRead")}
                </label>
                <button
                  type="button"
                  onClick={() => update({ hideRead: !settings.hideRead })}
                  data-selected={settings.hideRead}
                  className="chip mt-1 w-full !justify-center !py-1.5"
                >
                  {settings.hideRead ? t("feed.showingRead") : t("feed.hideRead")}
                </button>
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
                  {hiddenByRead
                    ? `${hiddenByRead} ${hiddenByRead === 1 ? "story" : "stories"} on the shelf ${hiddenByRead === 1 ? "is" : "are"} already read.`
                    : "Nothing on the shelf today has been read yet."}
                </p>

                {blockedNames.length > 0 && (
                  <div className="mt-2 rounded-lg bg-surface-2 px-2.5 py-2">
                    <p className="text-[11px] leading-relaxed text-muted">
                      These turned us away when you tried to read them, so they are hidden too. Tap
                      one to give it another go.
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {blockedNames.map((entry) => (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => {
                            forgetBlocked(entry.id);
                            setBlocked(blockedIds());
                          }}
                          className="chip !py-1 !text-[11.5px]"
                        >
                          {entry.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {extraFilters > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setMonth("all");
                      setSort("newest");
                      update({ hidePaywalled: true, hideRead: false });
                    }}
                    className="btn mt-3 w-full justify-center !py-1.5 text-xs"
                  >
                    {t("feed.resetFilters")}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Twenty-three sections do not fit on one line anywhere, so a phone
            scrolls them sideways and a wider screen wraps them onto two. */}
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 sm:flex-wrap sm:overflow-x-visible">
          <button
            type="button"
            onClick={() => setCategory("all")}
            data-selected={category === "all"}
            className="chip"
          >
            {t("feed.everything")}
          </button>
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              data-selected={category === c}
              className="chip"
            >
              {t(categoryKey(c))}
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
        <div className="card p-6 text-center sm:p-8">
          {/* An empty section is almost always an empty shelf rather than a
              quiet news day, so the useful answer is the papers that would
              have filled it, not an apology. */}
          {emptyCategoryPicks.length > 0 ? (
            <>
              <p className="font-medium">
                {t("feed.noneOnShelf")} {t(categoryKey(category)).toLowerCase()}
              </p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
                {t("feed.addTheseToFill")}
              </p>
              <div className="mt-4 space-y-2 text-left">
                {emptyCategoryPicks.map((pick) => (
                  <div key={pick.id} className="flex items-center gap-2.5 rounded-xl border border-border p-2.5">
                    <SourceAvatar name={pick.name} site={pick.site} size={24} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{pick.name}</span>
                    <button
                      type="button"
                      onClick={() => update({ sources: [...settings.sources, pick.id] })}
                      className="btn btn-primary shrink-0 !px-2.5 !py-1.5 text-xs"
                      aria-label={`${t("feed.add")} ${pick.name}`}
                    >
                      {t("feed.add")}
                    </button>
                  </div>
                ))}
              </div>
              <Link href="/sources" className="mt-4 inline-block text-[13px] text-accent underline underline-offset-2">
                {t("feed.browseAll")}
              </Link>
            </>
          ) : (
            <>
              <p className="font-medium">{t("feed.nothingMatches")}</p>
              <p className="mt-1 text-sm text-muted">
                {t("feed.tryAnother")}{" "}
                <Link href="/sources" className="underline underline-offset-2">
                  {t("nav.sources")}
                </Link>
                .
              </p>
            </>
          )}
        </div>
      )}

      {featured && (
        <div className="mb-5">
          <FeaturedCard
            item={featured}
            blocked={blocked.has(featured.sourceId)}
            read={readUrls.has(featured.link)}
          />
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
                <ArticleCard
                  key={item.id}
                  item={item}
                  blocked={blocked.has(item.sourceId)}
                  read={readUrls.has(item.link)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {rest.length > visible && (
        <button
          type="button"
          onClick={() =>
            setVisible((v) => {
              const next = v + PAGE_SIZE;
              if (typeof window !== "undefined") {
                try {
                  sessionStorage.setItem("pn:feed-visible:v1", String(next));
                } catch {
                  /* ignore */
                }
              }
              return next;
            })
          }
          className="btn mx-auto mt-6 flex"
        >
          {t("feed.showMore")}
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
