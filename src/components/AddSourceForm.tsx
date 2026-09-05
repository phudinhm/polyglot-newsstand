"use client";

import { useState } from "react";
import {
  MAX_CUSTOM_SOURCES,
  SOURCE_PRESETS,
  addCustomSource,
  googleNewsFeed,
  type CustomSource,
} from "@/lib/customSources";
import type { SourceLang } from "@/lib/types";
import { CheckIcon, PlusIcon } from "./Icons";

type Mode = "site" | "topic" | "rss";

const MODE_COPY: Record<Mode, { label: string; hint: string; placeholder: string }> = {
  site: {
    label: "Follow a website",
    hint: "Works for publishers that never published an RSS feed, or retired theirs. Headlines come through Google News and every link points at the publisher.",
    placeholder: "deloitte.com",
  },
  topic: {
    label: "Follow a topic",
    hint: "A standing search. Useful for a company, an industry or a story you are tracking over weeks.",
    placeholder: "Zinswende OR Leitzins",
  },
  rss: {
    label: "Paste an RSS feed",
    hint: "The direct route when a publication offers its own feed. RSS, Atom and RDF all work.",
    placeholder: "https://example.com/feed.xml",
  },
};

export function AddSourceForm({
  count,
  onAdded,
}: {
  count: number;
  onAdded: (source: CustomSource) => void;
}) {
  const [mode, setMode] = useState<Mode>("site");
  const [value, setValue] = useState("");
  const [name, setName] = useState("");
  const [lang, setLang] = useState<SourceLang>("en");
  const [error, setError] = useState<string | null>(null);
  const full = count >= MAX_CUSTOM_SOURCES;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = value.trim();
    if (!trimmed) return;

    let feed: string;
    if (mode === "rss") {
      try {
        const url = new URL(trimmed);
        if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error();
        feed = url.toString();
      } catch {
        setError("That does not look like a feed URL. It should start with https://");
        return;
      }
    } else {
      feed = googleNewsFeed({ mode, value: trimmed, lang });
    }

    const label =
      name.trim() ||
      (mode === "site"
        ? trimmed.replace(/^https?:\/\//, "").replace(/\/.*$/, "")
        : mode === "topic"
          ? trimmed
          : new URL(feed).hostname.replace(/^www\./, ""));

    onAdded(
      addCustomSource({
        name: label,
        feed,
        lang,
        category: "world",
        level: "medium",
        kind: mode,
        note: mode === "site" ? "Followed through Google News" : undefined,
      }),
    );
    setValue("");
    setName("");
  }

  return (
    <div className="card p-4">
      <h2 className="text-sm font-semibold">Add your own source</h2>
      <p className="mt-1 text-[13px] leading-relaxed text-muted">
        Anything you add lives in this browser only, and counts towards the same shelf as the
        curated list. {MAX_CUSTOM_SOURCES - count} slot
        {MAX_CUSTOM_SOURCES - count === 1 ? "" : "s"} left.
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {(Object.keys(MODE_COPY) as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            data-selected={mode === m}
            className="chip"
          >
            {MODE_COPY[m].label}
          </button>
        ))}
      </div>

      <p className="mt-2 text-[12px] leading-relaxed text-muted">{MODE_COPY[mode].hint}</p>

      <form onSubmit={submit} className="mt-3 space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={MODE_COPY[mode].placeholder}
            className="input flex-1"
            aria-label={MODE_COPY[mode].label}
            disabled={full}
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (optional)"
            className="input sm:w-40"
            aria-label="Source name"
            disabled={full}
          />
        </div>
        <div className="flex items-center gap-2">
          {(["en", "de"] as SourceLang[]).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              data-selected={lang === l}
              className="chip"
            >
              {l === "en" ? "English" : "Deutsch"}
            </button>
          ))}
          <button type="submit" className="btn btn-primary ml-auto" disabled={full || !value.trim()}>
            <PlusIcon width={15} height={15} /> Add source
          </button>
        </div>
        {error && <p className="text-[12px] text-accent">{error}</p>}
        {full && (
          <p className="text-[12px] text-muted">
            You have reached {MAX_CUSTOM_SOURCES} custom sources. Remove one to add another.
          </p>
        )}
      </form>

      <div className="mt-4 border-t border-border pt-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          One-click follows
        </h3>
        <p className="mt-1 text-[12px] text-muted">
          Research and advisory firms rarely publish a working feed. These follow them through
          Google News instead.
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {SOURCE_PRESETS.map((preset) => (
            <button
              key={preset.domain}
              type="button"
              disabled={full}
              onClick={() =>
                onAdded(
                  addCustomSource({
                    name: preset.label,
                    feed: googleNewsFeed({ mode: "site", value: preset.domain, lang: preset.domain.endsWith(".de") || preset.label.includes("(DE)") ? "de" : "en" }),
                    lang: preset.label.includes("(DE)") ? "de" : "en",
                    category: preset.category,
                    level: preset.level,
                    kind: "site",
                    note: preset.note,
                  }),
                )
              }
              className="chip disabled:opacity-40"
              title={preset.note}
            >
              <PlusIcon width={13} height={13} />
              {preset.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CustomSourceRow({
  source,
  enabled,
  onToggle,
  onRemove,
}: {
  source: CustomSource;
  enabled: boolean;
  onToggle: () => void;
  onRemove: () => void;
}) {
  return (
    <div className={`card flex items-start gap-3 p-3.5 ${enabled ? "border-accent/45" : ""}`}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold">{source.name}</h3>
          <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] uppercase text-muted">
            {source.lang}
          </span>
          <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted">
            {source.kind === "rss" ? "RSS" : source.kind === "site" ? "Website" : "Topic"}
          </span>
        </div>
        {source.note && <p className="mt-1 text-[13px] text-muted">{source.note}</p>}
        <p className="mt-1 truncate text-[11px] text-muted">{source.feed}</p>
      </div>
      <div className="flex shrink-0 flex-col gap-1.5">
        <button
          type="button"
          onClick={onToggle}
          className={`btn px-2.5 py-1.5 text-xs ${enabled ? "btn-primary" : ""}`}
          aria-pressed={enabled}
        >
          {enabled ? (
            <>
              <CheckIcon width={15} height={15} /> On shelf
            </>
          ) : (
            "Off"
          )}
        </button>
        <button type="button" onClick={onRemove} className="btn px-2.5 py-1.5 text-xs">
          Remove
        </button>
      </div>
    </div>
  );
}
