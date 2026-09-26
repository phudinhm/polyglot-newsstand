"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useT } from "@/hooks/useT";
import { getSaved, toggleSaved } from "@/lib/store";
import type { SavedArticle } from "@/lib/types";
import { readerHref, timeAgo } from "@/lib/format";
import { recordArticleClick, restoreScrollPosition, saveScrollPosition } from "@/lib/scrollMemory";
import { CloseIcon, SearchIcon, TrashIcon } from "./Icons";

export function SavedClient() {
  const [items, setItems] = useState<SavedArticle[]>([]);
  const t = useT();
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [lang, setLang] = useState<"all" | "de" | "en" | "vi">("all");

  useEffect(() => {
    setItems(getSaved());
    setReady(true);
    const onStore = () => setItems(getSaved());
    window.addEventListener("pn:store", onStore);
    return () => window.removeEventListener("pn:store", onStore);
  }, []);

  useEffect(() => {
    if (!ready) return;
    restoreScrollPosition({ path: "/saved" });
    const onScroll = () => saveScrollPosition("/saved", window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [ready]);

  const filtered = useMemo(() => {
    let list = items;
    if (lang !== "all") list = list.filter((i) => i.lang === lang);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          (i.sourceName ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [items, lang, query]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <header className="mb-5">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{t("saved.title")}</h1>
        <p className="mt-1 text-sm text-muted">
          Stories you set aside ({items.length}). They stay on this device, so nothing you read is sent anywhere.
        </p>
      </header>

      {items.length > 0 && (
        <div className="sticky top-[var(--header-offset)] z-20 -mx-4 mb-4 flex flex-wrap items-center gap-2 px-4 py-2.5 glass">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-surface/80 px-3 py-1.5 focus-within:border-accent">
            <SearchIcon className="shrink-0 text-muted" width={16} height={16} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search saved stories…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
              aria-label="Search saved stories"
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
          <div className="flex items-center gap-1.5">
            {(["all", "de", "en", "vi"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setLang(value)}
                data-selected={lang === value}
                className="chip !py-1.5"
              >
                {value === "all" ? t("feed.all") : value.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      )}

      {ready && !items.length && (
        <div className="card p-8 text-center">
          <p className="font-medium">Nothing saved yet.</p>
          <p className="mt-1 text-sm text-muted">
            Use the bookmark button while reading to keep an article for later.
          </p>
          <Link href="/" className="btn btn-primary mt-4 inline-flex">
            Back to the newsstand
          </Link>
        </div>
      )}

      {ready && items.length > 0 && !filtered.length && (
        <div className="card p-6 text-center text-sm text-muted">
          No saved stories match your current filter.
        </div>
      )}

      <ul className="space-y-2.5">
        {filtered.map((item) => (
          <li key={item.url} className="card card-hover article-card-item flex items-center gap-3.5 p-3.5 sm:p-4">
            <Link
              href={readerHref({ url: item.url, lang: item.lang })}
              onClick={() => recordArticleClick(item.url)}
              className="flex min-w-0 flex-1 items-center gap-3.5"
            >
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted">
                  <span className="font-semibold uppercase tracking-wide text-accent">
                    {item.sourceName || "Saved"}
                  </span>
                  <span aria-hidden>·</span>
                  <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium uppercase">
                    {item.lang}
                  </span>
                  <span aria-hidden>·</span>
                  <span>saved {timeAgo(item.savedAt)}</span>
                </div>
                <h2 className="line-clamp-2 text-[15.5px] font-semibold leading-snug sm:text-base">
                  {item.title}
                </h2>
              </div>
              {item.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.image}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="thumb hidden h-16 w-24 shrink-0 border border-border sm:block"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              )}
            </Link>
            <button
              type="button"
              onClick={() => {
                toggleSaved(item);
                setItems(getSaved());
              }}
              className="btn shrink-0 !px-2.5 !py-2 text-muted hover:text-accent"
              aria-label={`Remove ${item.title}`}
              title="Remove from saved"
            >
              <TrashIcon width={15} height={15} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
