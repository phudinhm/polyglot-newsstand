"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSettings } from "@/hooks/useSettings";
import { useT } from "@/hooks/useT";
import { categoryKey } from "@/lib/i18n";
import { CATEGORY_LABELS, LANG_LABELS, LEVEL_LABELS, SOURCES } from "@/lib/sources";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { suggestSources, type Reason } from "@/lib/suggest";
import { getCustomSources, removeCustomSource, type CustomSource } from "@/lib/customSources";
import { getRecent } from "@/lib/recent";
import { SourceAvatar } from "./SourceAvatar";
import type { SourceHealth } from "@/app/api/source-health/route";
import { AddSourceForm, CustomSourceRow } from "./AddSourceForm";
import { CheckIcon, CloseIcon, PlusIcon, SearchIcon, SpinnerIcon, StarIcon } from "./Icons";

export function SourcesClient() {
  const [settings, update] = useSettings();
  const t = useT();
  const [lang, setLang] = useState<"all" | "de" | "en" | "vi">("all");
  const [query, setQuery] = useState("");
  const [favOnly, setFavOnly] = useState(false);
  const [custom, setCustom] = useState<CustomSource[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [health, setHealth] = useState<SourceHealth[] | null>(null);
  const [checking, setChecking] = useState(false);
  const selected = useMemo(() => new Set(settings.sources), [settings.sources]);
  const favorites = useMemo(() => new Set(settings.favorites), [settings.favorites]);

  const [mostRead, setMostRead] = useState<{ id?: string; name: string; count: number }[]>([]);

  useEffect(() => {
    setCustom(getCustomSources());
    // What the reader actually opens, which is rarely what they think it is.
    const tally = new Map<string, { id?: string; name: string; count: number }>();
    for (const article of getRecent()) {
      const key = article.sourceId ?? article.sourceName;
      if (!key) continue;
      const found = tally.get(key) ?? {
        id: article.sourceId,
        name: article.sourceName || key,
        count: 0,
      };
      found.count += 1;
      tally.set(key, found);
    }
    setMostRead([...tally.values()].sort((a, b) => b.count - a.count).slice(0, 5));
  }, []);

  const suggestions = useMemo(() => suggestSources(settings.sources, 4), [settings.sources]);
  const healthById = useMemo(
    () => new Map((health ?? []).map((h) => [h.id, h])),
    [health],
  );

  const grouped = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const visible = SOURCES.filter((source) => {
      if (favOnly && !favorites.has(source.id)) return false;
      if (lang !== "all" && source.lang !== lang) return false;
      if (!needle) return true;
      // Search what a reader would actually type: the paper's name, the
      // shorthand they know it by, and the domain they might remember.
      return [source.name, source.short, source.site, source.note]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(needle));
    });

    const map = new Map<string, typeof SOURCES>();
    for (const source of visible) {
      const list = map.get(source.category) ?? [];
      list.push(source);
      map.set(source.category, list);
    }
    // Alphabetical within a section, so a name can be found by eye rather
    // than by reading the whole list. localeCompare gets Ö next to O.
    for (const list of map.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name, "de"));
    }
    return Array.from(map.entries()).sort(
      ([a], [b]) =>
        Object.keys(CATEGORY_LABELS).indexOf(a) - Object.keys(CATEGORY_LABELS).indexOf(b),
    );
  }, [lang, query, favOnly, favorites]);

  const matches = useMemo(
    () => grouped.reduce((total, [, list]) => total + list.length, 0),
    [grouped],
  );

  /**
   * A suggestion has to say why in the reader's language. "Because you already
   * read business" is a reason; the same sentence in English on a Vietnamese
   * page is just more English to get through.
   */
  function reasonText(why: Reason): string {
    switch (why.key) {
      case "forLearners":
        return t("suggest.forLearners");
      case "lightOnLanguage":
        return `${t("suggest.lightOn")} ${LANG_LABELS[why.lang] ?? why.lang}`;
      case "alreadyRead":
        return `${t("suggest.alreadyRead")} ${t(categoryKey(why.category)).toLowerCase()}`;
      case "note":
        return why.note;
      case "worthALook":
        return t("suggest.worthALook");
    }
  }

  function toggle(id: string) {
    const next = new Set(settings.sources);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    // An empty shelf would show an empty newsstand, so keep at least one.
    update({ sources: next.size ? Array.from(next) : settings.sources });
  }

  // Favoriting only means something for a source already on the shelf -
  // sanitize() drops a favorite the moment its source leaves the shelf, so
  // this never needs to add it back on its own.
  function toggleFavorite(id: string) {
    const next = new Set(settings.favorites);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    update({ favorites: Array.from(next) });
  }

  async function runHealthCheck() {
    setChecking(true);
    try {
      const res = await fetch("/api/source-health", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sources: settings.sources,
          custom: custom.filter((c) => settings.sources.includes(c.id)),
        }),
      });
      const data = (await res.json()) as { results: SourceHealth[] };
      setHealth(data.results ?? []);
    } catch {
      setHealth([]);
    } finally {
      setChecking(false);
    }
  }

  const broken = (health ?? []).filter((h) => !h.ok);
  // Alive, but only after a retry or a rediscovery: worth knowing about.
  const recovered = (health ?? []).filter((h) => h.ok && h.note);

  return (
    <div className="mx-auto max-w-3xl px-4 pb-8 pt-5">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[1.5rem] font-bold tracking-tight sm:text-[1.75rem]">{t("sources.title")}</h1>
          <p className="mt-1 text-[13.5px] text-muted">
            {settings.sources.length} {t("sources.shelfCount")} {SOURCES.length}{" "}
            {t("sources.curated")}
          </p>
        </div>
        <button type="button" onClick={() => void runHealthCheck()} disabled={checking} className="btn">
          {checking ? <SpinnerIcon /> : <CheckIcon />}
          {t("sources.check")}
        </button>
      </header>

      {/* Answers "why can't I see The Guardian" with something specific. */}
      {health && (
        <div className="card mb-5 p-4">
          {broken.length === 0 ? (
            <p className="text-sm">
              {health.length} {t("sources.allAnswered")}
            </p>
          ) : (
            <>
              <p className="text-sm font-medium">
                {broken.length}/{health.length} {t("sources.noAnswer")}
              </p>
              <ul className="mt-2 space-y-1.5">
                {broken.map((h) => (
                  <li key={h.id} className="text-[13px] leading-relaxed">
                    <span className="font-medium">{h.name}</span>
                    <span className="text-muted"> — {h.reason}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2.5 text-[12.5px] text-muted">
                A publisher that blocks us or has retired its feed can still be followed through
                Google News. Use Add a source below.
              </p>
            </>
          )}

          {recovered.length > 0 && (
            <div className="mt-3 border-t border-border pt-2.5">
              <p className="text-[12.5px] text-muted">{t("sources.recovered")}</p>
              <ul className="mt-1 space-y-1">
                {recovered.map((h) => (
                  <li key={h.id} className="text-[12.5px] leading-relaxed">
                    <span className="font-medium">{h.name}</span>
                    <span className="text-muted"> — {h.note}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {mostRead.length > 1 && (
        <section className="mb-6">
          <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted">
            {t("sources.mostRead")}
          </h2>
          <div className="card divide-y divide-border">
            {mostRead.map((entry) => {
              const max = mostRead[0].count || 1;
              const row = (
                <>
                  <SourceAvatar
                    name={entry.name}
                    site={entry.id ? SOURCES.find((s) => s.id === entry.id)?.site : undefined}
                    size={18}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{entry.name}</span>
                  <span className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-surface-2">
                    <span
                      className="block h-full rounded-full bg-accent"
                      style={{ width: `${Math.round((entry.count / max) * 100)}%` }}
                    />
                  </span>
                  <span className="w-14 shrink-0 text-right text-[12px] tabular-nums text-muted">
                    {entry.count} {t("sources.timesRead")}
                  </span>
                </>
              );
              return entry.id ? (
                <Link
                  key={entry.name}
                  href={`/s/${entry.id}`}
                  className="flex items-center gap-2.5 px-3.5 py-2.5 transition-colors hover:bg-surface-2"
                >
                  {row}
                </Link>
              ) : (
                <div key={entry.name} className="flex items-center gap-2.5 px-3.5 py-2.5">
                  {row}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {suggestions.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted">
            {t("sources.suggested")}
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {suggestions.map(({ source, why }) => (
              <div key={source.id} className="card flex items-start gap-3 p-3.5">
                <SourceAvatar name={source.name} site={source.site} size={26} className="mt-0.5" />
                <div className="min-w-0 flex-1">
                  <Link href={`/s/${source.id}`} className="text-sm font-semibold hover:underline">
                    {source.name}
                  </Link>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{reasonText(why)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => toggle(source.id)}
                  className="btn btn-primary shrink-0 !px-2 !py-1.5 text-xs"
                  aria-label={`Add ${source.name}`}
                >
                  <PlusIcon width={15} height={15} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mb-6">
        {showAdd ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="btn absolute right-3 top-3 z-10 !px-1.5 !py-1.5"
              aria-label="Close"
            >
              <CloseIcon width={15} height={15} />
            </button>
            <AddSourceForm
              count={custom.length}
              onAdded={(created) => {
                setCustom(getCustomSources());
                if (!settings.sources.includes(created.id)) {
                  update({ sources: [...settings.sources, created.id] });
                }
              }}
            />
          </div>
        ) : (
          <button type="button" onClick={() => setShowAdd(true)} className="btn w-full justify-center">
            <PlusIcon width={16} height={16} /> {t("sources.addOwn")}
          </button>
        )}
      </section>

      {custom.length > 0 && (
        <section className="mb-7">
          <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted">
            {t("sources.yours")}
          </h2>
          <div className="space-y-2">
            {custom.map((source) => (
              <CustomSourceRow
                key={source.id}
                source={source}
                enabled={selected.has(source.id)}
                favorite={favorites.has(source.id)}
                onToggle={() => toggle(source.id)}
                onToggleFavorite={() => toggleFavorite(source.id)}
                onRemove={() => {
                  removeCustomSource(source.id);
                  setCustom(getCustomSources());
                  update({ sources: settings.sources.filter((id) => id !== source.id) });
                }}
              />
            ))}
          </div>
        </section>
      )}

      <div className="mb-3">
        <div className="relative">
          <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
            <SearchIcon width={16} height={16} />
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("sources.search")}
            aria-label={t("sources.search")}
            className="input w-full !pl-9"
          />
        </div>
        {query.trim() && (
          <p className="mt-1.5 text-[12.5px] tabular-nums text-muted">
            {matches} {t("sources.matches")}
          </p>
        )}
      </div>

      <div className="no-scrollbar mb-4 flex gap-1.5 overflow-x-auto">
        {(["all", "de", "en", "vi"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setLang(value)}
            data-selected={lang === value}
            className="chip"
          >
            {value === "all"
              ? t("sources.langAll")
              : value === "de"
                ? "Deutsch"
                : value === "en"
                  ? "English"
                  : "Tiếng Việt"}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setFavOnly((v) => !v)}
          data-selected={favOnly}
          className="chip !gap-1"
        >
          <StarIcon width={14} height={14} fill={favOnly ? "currentColor" : "none"} />
          {t("sources.favoritesOnly")}
        </button>
        <button
          type="button"
          onClick={() => update({ sources: DEFAULT_SETTINGS.sources })}
          className="chip"
        >
          {t("sources.reset")}
        </button>
        <button
          type="button"
          onClick={() => {
            const visibleIds = grouped.flatMap(([, list]) => list.map((s) => s.id));
            const next = new Set([...settings.sources, ...visibleIds]);
            update({ sources: Array.from(next) });
          }}
          className="chip"
        >
          <PlusIcon width={14} height={14} className="mr-1 inline-block" />
          {t("sources.addAll")}
        </button>
      </div>

      {matches === 0 && (
        <p className="card p-5 text-center text-sm text-muted">{t("sources.noMatch")}</p>
      )}

      <div className="space-y-6">
        {grouped.map(([category, list]) => (
          <section key={category}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
              {t(categoryKey(category))}
            </h2>
            <div className="space-y-2">
              {list.map((source) => {
                const on = selected.has(source.id);
                const fav = favorites.has(source.id);
                const status = healthById.get(source.id);
                return (
                  <div
                    key={source.id}
                    className={`card flex items-center gap-3 p-3.5 ${on ? "border-accent/40" : ""}`}
                  >
                    <SourceAvatar name={source.name} site={source.site} size={26} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/s/${source.id}`} className="text-sm font-semibold hover:underline">
                          {source.name}
                        </Link>
                        <span className="text-[11px] uppercase text-muted">{source.lang}</span>
                        <span className="text-[11px] text-muted">{LEVEL_LABELS[source.level]}</span>
                        {status && (
                          <span
                            className={`text-[11px] ${status.ok ? "text-translation" : "text-accent"}`}
                            title={status.reason}
                          >
                            {status.ok
                              ? `${status.items} ${t("sources.articles")}`
                              : t("sources.notAnswering")}
                          </span>
                        )}
                      </div>
                      {source.note && (
                        <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{source.note}</p>
                      )}
                    </div>
                    {/* Favoriting only means something once a source is on the
                        shelf, so the star only appears alongside it. */}
                    {on && (
                      <button
                        type="button"
                        onClick={() => toggleFavorite(source.id)}
                        className={`btn shrink-0 !px-2 !py-1.5 ${fav ? "text-accent" : ""}`}
                        aria-pressed={fav}
                        aria-label={
                          fav ? `Unfavorite ${source.name}` : `Favorite ${source.name}`
                        }
                        title={t("sources.favorite")}
                      >
                        <StarIcon width={15} height={15} fill={fav ? "currentColor" : "none"} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => toggle(source.id)}
                      className={`btn shrink-0 !px-2.5 !py-1.5 text-xs ${on ? "btn-primary" : ""}`}
                      aria-pressed={on}
                      aria-label={on ? `Remove ${source.name}` : `Add ${source.name}`}
                    >
                      {on ? <CheckIcon width={15} height={15} /> : <PlusIcon width={15} height={15} />}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
