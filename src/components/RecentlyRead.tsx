"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getRecent, type RecentArticle } from "@/lib/recent";
import { SOURCE_BY_ID } from "@/lib/sources";
import { readerHref, timeAgo } from "@/lib/format";
import { recordArticleClick } from "@/lib/scrollMemory";
import { SourceAvatar } from "./SourceAvatar";
import { useT } from "@/hooks/useT";
import { useHorizontalScroll } from "@/hooks/useHorizontalScroll";
import { HistoryIcon } from "./Icons";

/**
 * The pieces still in progress, with how far each got.
 *
 * Only unfinished reading appears here. A finished article is not something
 * you want offered back, and a list of everything you have ever opened would
 * cost the front page more space than it returns.
 */
export function RecentlyRead({ limit = 4 }: { limit?: number }) {
  const t = useT();
  const [items, setItems] = useState<RecentArticle[]>([]);
  const rowRef = useHorizontalScroll<HTMLDivElement>();

  useEffect(() => {
    const sync = () =>
      setItems(
        getRecent()
          .filter((a) => a.progress >= 5 && a.progress <= 95)
          .slice(0, limit),
      );
    sync();
    window.addEventListener("pn:store", sync);
    return () => window.removeEventListener("pn:store", sync);
  }, [limit]);

  if (!items.length) return null;

  return (
    <section className="mb-4">
      <h2 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
        <HistoryIcon width={14} height={14} /> {t("feed.stillReading")}
      </h2>
      <div ref={rowRef} className="no-scrollbar scroll-fade-r -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1">
        {items.map((item) => (
          <Link
            key={item.url}
            href={readerHref({ url: item.url, lang: item.lang, source: item.sourceId })}
            onClick={() => recordArticleClick(item.url)}
            className="card card-hover w-56 shrink-0 p-3"
          >
            <div className="flex items-center gap-1.5 text-[11px] text-muted">
              <SourceAvatar
                name={item.sourceName || "Article"}
                site={item.sourceId ? SOURCE_BY_ID.get(item.sourceId)?.site : undefined}
                size={16}
              />
              <span className="truncate font-medium uppercase tracking-wide text-accent">
                {item.sourceName}
              </span>
            </div>
            <p className="mt-1.5 line-clamp-2 text-[13.5px] font-medium leading-snug">
              {item.title}
            </p>
            <div className="mb-0.5 mt-2.5 flex items-center gap-2">
              <span className="h-1 flex-1 overflow-hidden rounded-full bg-surface-2">
                <span
                  className="block h-full rounded-full bg-translation"
                  style={{ width: `${Math.max(3, Math.round(item.progress))}%` }}
                />
              </span>
              <span className="shrink-0 text-[11px] tabular-nums text-muted">
                {Math.round(item.progress)}% · {timeAgo(item.readAt)}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
