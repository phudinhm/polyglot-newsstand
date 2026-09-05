"use client";

import { useMemo, useState } from "react";
import { useSettings } from "@/hooks/useSettings";
import { CATEGORY_LABELS, LEVEL_LABELS, SOURCES } from "@/lib/sources";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { CheckIcon, ExternalIcon, PlusIcon } from "./Icons";

export function SourcesClient() {
  const [settings, update] = useSettings();
  const [lang, setLang] = useState<"all" | "de" | "en">("all");
  const selected = useMemo(() => new Set(settings.sources), [settings.sources]);

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

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <header className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Sources</h1>
        <p className="mt-1 text-sm text-muted">
          {settings.sources.length} on your shelf. The newsstand only fetches what you select, so a
          shorter list means a faster feed.
        </p>
      </header>

      <div className="mb-5 flex flex-wrap items-center gap-2">
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
          onClick={() => update({ sources: SOURCES.map((s) => s.id) })}
          className="chip"
        >
          Select everything
        </button>
        <button
          type="button"
          onClick={() => update({ sources: DEFAULT_SETTINGS.sources })}
          className="chip"
        >
          Reset to the default shelf
        </button>
      </div>

      <div className="space-y-7">
        {grouped.map(([category, list]) => (
          <section key={category}>
            <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted">
              {CATEGORY_LABELS[category]}
            </h2>
            <div className="space-y-2">
              {list.map((source) => {
                const on = selected.has(source.id);
                return (
                  <div
                    key={source.id}
                    className={`card flex items-start gap-3 p-3.5 transition-colors ${
                      on ? "border-accent/45" : ""
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold">{source.name}</h3>
                        <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] uppercase text-muted">
                          {source.lang}
                        </span>
                        <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted">
                          {LEVEL_LABELS[source.level]}
                        </span>
                      </div>
                      {source.note && (
                        <p className="mt-1 text-[13px] leading-relaxed text-muted">{source.note}</p>
                      )}
                      <a
                        href={source.site}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-muted underline underline-offset-2"
                      >
                        {new URL(source.site).hostname.replace(/^www\./, "")}
                        <ExternalIcon width={12} height={12} />
                      </a>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggle(source.id)}
                      className={`btn shrink-0 px-2.5 py-1.5 text-xs ${on ? "btn-primary" : ""}`}
                      aria-pressed={on}
                    >
                      {on ? (
                        <>
                          <CheckIcon width={15} height={15} /> On shelf
                        </>
                      ) : (
                        <>
                          <PlusIcon width={15} height={15} /> Add
                        </>
                      )}
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
