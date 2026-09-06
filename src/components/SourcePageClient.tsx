"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSettings } from "@/hooks/useSettings";
import { LANG_LABELS, LEVEL_LABELS, SOURCE_BY_ID } from "@/lib/sources";
import { getCustomSources } from "@/lib/customSources";
import type { FeedItem, FeedResponse, Source } from "@/lib/types";
import { ArticleCard, FeaturedCard } from "./ArticleCard";
import { ArrowLeftIcon, CheckIcon, ExternalIcon, PlusIcon, RefreshIcon, SpinnerIcon } from "./Icons";

/**
 * One publication at a time.
 *
 * Choosing the paper first and the story second is how people actually read a
 * newsstand, and it is the only way to browse a source that is not on the
 * shelf without disturbing the shelf.
 */
export function SourcePageClient({ id }: { id: string }) {
  const [settings, update] = useSettings();
  const [source, setSource] = useState<Source | null>(SOURCE_BY_ID.get(id) ?? null);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState(20);

  useEffect(() => {
    if (SOURCE_BY_ID.has(id)) return;
    const custom = getCustomSources().find((c) => c.id === id);
    if (custom) {
      setSource({
        id: custom.id,
        name: custom.name,
        short: custom.name,
        lang: custom.lang,
        category: custom.category,
        level: custom.level,
        feed: custom.feed,
        site: safeOrigin(custom.feed),
        note: custom.note,
      });
    } else {
      setError("This source is not in the catalogue or in your own list.");
      setLoading(false);
    }
  }, [id]);

  const load = useCallback(async () => {
    if (!source) return;
    setLoading(true);
    setError(null);
    try {
      const isCurated = SOURCE_BY_ID.has(source.id);
      const res = await fetch("/api/feed", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          isCurated ? { sources: [source.id], custom: [] } : { sources: [], custom: [source] },
        ),
      });
      if (!res.ok) throw new Error(`Could not reach this publication (${res.status}).`);
      const data = (await res.json()) as FeedResponse;
      if (data.failed.length) {
        setError(data.failed[0].reason);
      }
      setItems(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this publication.");
    } finally {
      setLoading(false);
    }
  }, [source]);

  useEffect(() => {
    void load();
  }, [load]);

  const onShelf = source ? settings.sources.includes(source.id) : false;

  function toggleShelf() {
    if (!source) return;
    update({
      sources: onShelf
        ? settings.sources.filter((s) => s !== source.id)
        : [...settings.sources, source.id],
    });
  }

  const [featured, rest] = useMemo(
    () => (items.length > 3 ? [items[0], items.slice(1)] : [null, items]),
    [items],
  );

  if (!source) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-sm text-muted">{error ?? "Loading…"}</p>
        <Link href="/sources" className="btn mt-4 inline-flex">
          Browse all sources
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-8 pt-5">
      <Link href="/sources" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeftIcon width={16} height={16} /> All sources
      </Link>

      <header className="card mb-5 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{source.name}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted">
              <span>{LANG_LABELS[source.lang]}</span>
              <span aria-hidden>·</span>
              <span>{LEVEL_LABELS[source.level]}</span>
              <span aria-hidden>·</span>
              <a
                href={source.site}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 underline underline-offset-2"
              >
                {hostOf(source.site)}
                <ExternalIcon width={12} height={12} />
              </a>
            </div>
            {source.note && (
              <p className="mt-2 max-w-prose text-[13.5px] leading-relaxed text-muted">
                {source.note}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => void load()} disabled={loading} className="btn px-2.5">
              {loading ? <SpinnerIcon /> : <RefreshIcon />}
            </button>
            <button
              type="button"
              onClick={toggleShelf}
              className={`btn ${onShelf ? "btn-primary" : ""}`}
              aria-pressed={onShelf}
            >
              {onShelf ? (
                <>
                  <CheckIcon width={16} height={16} /> On shelf
                </>
              ) : (
                <>
                  <PlusIcon width={16} height={16} /> Add to shelf
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="card mb-4 border-accent/40 p-4">
          <p className="text-sm font-medium">This publication did not answer.</p>
          <p className="mt-1 text-[13px] text-muted">{error}</p>
          <p className="mt-2 text-[13px] text-muted">
            Publishers move feed URLs without notice. If this keeps happening, follow the site
            through Google News instead, on the{" "}
            <Link href="/sources" className="underline underline-offset-2">
              Sources
            </Link>{" "}
            page.
          </p>
        </div>
      )}

      {loading && !items.length && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="card p-4">
              <div className="skeleton h-3 w-24" />
              <div className="skeleton mt-2 h-4 w-3/4" />
            </div>
          ))}
        </div>
      )}

      {featured && (
        <div className="mb-4">
          <FeaturedCard item={featured} />
        </div>
      )}

      <div className="space-y-2.5">
        {rest.slice(0, visible).map((item) => (
          <ArticleCard key={item.id} item={item} linkSource={false} />
        ))}
      </div>

      {rest.length > visible && (
        <button type="button" onClick={() => setVisible((v) => v + 20)} className="btn mx-auto mt-6 flex">
          Show more
        </button>
      )}

      {!loading && !items.length && !error && (
        <p className="py-10 text-center text-sm text-muted">Nothing published recently.</p>
      )}
    </div>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function safeOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}
