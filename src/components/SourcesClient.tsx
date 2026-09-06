"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSettings } from "@/hooks/useSettings";
import { CATEGORY_LABELS, LEVEL_LABELS, SOURCES } from "@/lib/sources";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { suggestSources } from "@/lib/suggest";
import { getCustomSources, removeCustomSource, type CustomSource } from "@/lib/customSources";
import type { SourceHealth } from "@/app/api/source-health/route";
import { AddSourceForm, CustomSourceRow } from "./AddSourceForm";
import { CheckIcon, CloseIcon, PlusIcon, SpinnerIcon } from "./Icons";

export function SourcesClient() {
  const [settings, update] = useSettings();
  const [lang, setLang] = useState<"all" | "de" | "en">("all");
  const [custom, setCustom] = useState<CustomSource[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [health, setHealth] = useState<SourceHealth[] | null>(null);
  const [checking, setChecking] = useState(false);
  const selected = useMemo(() => new Set(settings.sources), [settings.sources]);

  useEffect(() => {
    setCustom(getCustomSources());
  }, []);

  const suggestions = useMemo(() => suggestSources(settings.sources, 4), [settings.sources]);
  const healthById = useMemo(
    () => new Map((health ?? []).map((h) => [h.id, h])),
    [health],
  );

  const visible = SOURCES.filter((s) => lang === "all" || s.lang === lang);
  const grouped = useMemo(() => {
    const map = new Map<string, typeof SOURCES>();
    for (const source of visible) {
      const list = map.get(source.category) ?? [];
      list.push(source);
      map.set(source.category, list);
    }
    return Array.from(map.entries()).sort(
      ([a], [b]) =>
        Object.keys(CATEGORY_LABELS).indexOf(a) - Object.keys(CATEGORY_LABELS).indexOf(b),
    );
  }, [visible]);

  function toggle(id: string) {
    const next = new Set(settings.sources);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    // An empty shelf would show an empty newsstand, so keep at least one.
    update({ sources: next.size ? Array.from(next) : settings.sources });
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

  return (
    <div className="mx-auto max-w-3xl px-4 pb-8 pt-5">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[1.5rem] font-bold tracking-tight sm:text-[1.75rem]">Sources</h1>
          <p className="mt-1 text-[13.5px] text-muted">
            {settings.sources.length} on your shelf, from {SOURCES.length} curated publications.
          </p>
        </div>
        <button type="button" onClick={() => void runHealthCheck()} disabled={checking} className="btn">
          {checking ? <SpinnerIcon /> : <CheckIcon />}
          Check my sources
        </button>
      </header>

      {/* Answers "why can't I see The Guardian" with something specific. */}
      {health && (
        <div className="card mb-5 p-4">
          {broken.length === 0 ? (
            <p className="text-sm">
              All {health.length} sources on your shelf answered. Nothing to fix.
            </p>
          ) : (
            <>
              <p className="text-sm font-medium">
                {broken.length} of {health.length} did not answer
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
        </div>
      )}

      {suggestions.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted">
            Suggested for you
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {suggestions.map(({ source, why }) => (
              <div key={source.id} className="card flex items-start gap-3 p-3.5">
                <div className="min-w-0 flex-1">
                  <Link href={`/s/${source.id}`} className="text-sm font-semibold hover:underline">
                    {source.name}
                  </Link>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{why}</p>
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
            <PlusIcon width={16} height={16} /> Add a source of your own
          </button>
        )}
      </section>

      {custom.length > 0 && (
        <section className="mb-7">
          <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted">
            Your sources
          </h2>
          <div className="space-y-2">
            {custom.map((source) => (
              <CustomSourceRow
                key={source.id}
                source={source}
                enabled={selected.has(source.id)}
                onToggle={() => toggle(source.id)}
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

      <div className="no-scrollbar mb-4 flex gap-1.5 overflow-x-auto">
        {(["all", "de", "en"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setLang(value)}
            data-selected={lang === value}
            className="chip"
          >
            {value === "all" ? "All languages" : value === "de" ? "Deutsch" : "English"}
          </button>
        ))}
        <button
          type="button"
          onClick={() => update({ sources: DEFAULT_SETTINGS.sources })}
          className="chip"
        >
          Reset shelf
        </button>
      </div>

      <div className="space-y-6">
        {grouped.map(([category, list]) => (
          <section key={category}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
              {CATEGORY_LABELS[category]}
            </h2>
            <div className="space-y-2">
              {list.map((source) => {
                const on = selected.has(source.id);
                const status = healthById.get(source.id);
                return (
                  <div
                    key={source.id}
                    className={`card flex items-center gap-3 p-3.5 ${on ? "border-accent/40" : ""}`}
                  >
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
                            {status.ok ? `${status.items} articles` : "not answering"}
                          </span>
                        )}
                      </div>
                      {source.note && (
                        <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{source.note}</p>
                      )}
                    </div>
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
