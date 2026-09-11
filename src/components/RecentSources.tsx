"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getRecentSources } from "@/lib/recent";
import { getCustomSources } from "@/lib/customSources";
import { SOURCE_BY_ID } from "@/lib/sources";
import { timeAgo } from "@/lib/format";
import { useT } from "@/hooks/useT";
import { useHorizontalScroll } from "@/hooks/useHorizontalScroll";
import { SourceAvatar } from "./SourceAvatar";
import { HistoryIcon } from "./Icons";

interface Entry {
  id: string;
  name: string;
  short: string;
  site?: string;
  at: string;
}

/**
 * The papers you were just in.
 *
 * The shelf rail above answers "which of my papers today"; this answers the
 * different question of "take me back to where I was". It reaches papers that
 * are not on the shelf at all, which is how a paper found through search or a
 * suggestion stays reachable without being subscribed to.
 */
export function RecentSources({ limit = 8 }: { limit?: number }) {
  const t = useT();
  const [items, setItems] = useState<Entry[]>([]);
  const rowRef = useHorizontalScroll<HTMLDivElement>();

  useEffect(() => {
    const sync = () => {
      const custom = getCustomSources();
      setItems(
        getRecentSources(limit).flatMap(({ sourceId, at }) => {
          const curated = SOURCE_BY_ID.get(sourceId);
          if (curated) {
            return [{
              id: curated.id,
              name: curated.name,
              short: curated.short ?? curated.name,
              site: curated.site,
              at,
            }];
          }
          const own = custom.find((c) => c.id === sourceId);
          // A source the reader added has no home page of its own, only a
          // feed, so the avatar falls back to a monogram.
          return own ? [{ id: own.id, name: own.name, short: own.name, at }] : [];
        }),
      );
    };
    sync();
    window.addEventListener("pn:store", sync);
    return () => window.removeEventListener("pn:store", sync);
  }, [limit]);

  if (!items.length) return null;

  return (
    <section className="mb-4">
      <h2 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
        <HistoryIcon width={14} height={14} /> {t("feed.recentPapers")}
      </h2>
      <div
        ref={rowRef}
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((entry) => (
          <Link
            key={entry.id}
            href={`/s/${entry.id}`}
            title={entry.name}
            className="flex shrink-0 items-center gap-2 rounded-xl border border-border bg-surface px-2.5 py-1.5 transition-colors hover:bg-surface-2"
          >
            <SourceAvatar name={entry.name} site={entry.site} size={20} />
            <span className="max-w-[9rem] truncate text-[13px] font-medium">{entry.short}</span>
            <span className="text-[11px] text-muted">{timeAgo(entry.at)}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
