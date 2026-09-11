"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SOURCE_BY_ID } from "@/lib/sources";
import { getCustomSources } from "@/lib/customSources";
import { getRecentSources } from "@/lib/recent";
import { timeAgo } from "@/lib/format";
import type { Source } from "@/lib/types";
import { useT } from "@/hooks/useT";
import { useHorizontalScroll } from "@/hooks/useHorizontalScroll";
import { SourceAvatar } from "./SourceAvatar";
import { HistoryIcon, PlusIcon } from "./Icons";

interface RailEntry {
  id: string;
  name: string;
  short: string;
  site?: string;
  /** On the shelf and has something today: a tap filters the feed in place. */
  filterable: boolean;
  count?: number;
  recentAt?: string;
}

/**
 * Pick the paper, then the story.
 *
 * This used to be two rows - the shelf, and a separate "papers you were just
 * in" - answering the same question twice. One rail does both: whatever was
 * opened most recently leads, a small clock marks it, and the rest of the
 * shelf follows. A paper reached this way that is not on the shelf at all
 * still opens (its own page, not a feed filter, since it has no feed here to
 * filter), which is how something found through search stays reachable
 * without being subscribed to.
 */
export function SourceRail({
  shelf,
  selected,
  onSelect,
  counts,
}: {
  shelf: string[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  counts: Map<string, number>;
}) {
  const t = useT();
  const rowRef = useHorizontalScroll<HTMLDivElement>();
  const [recent, setRecent] = useState<{ sourceId: string; at: string }[]>([]);

  useEffect(() => {
    const sync = () => setRecent(getRecentSources(6));
    sync();
    window.addEventListener("pn:store", sync);
    return () => window.removeEventListener("pn:store", sync);
  }, []);

  const custom = getCustomSources();
  const resolve = (id: string): Source | null => {
    const curated = SOURCE_BY_ID.get(id);
    if (curated) return curated;
    const own = custom.find((c) => c.id === id);
    return own
      ? ({
          id: own.id,
          name: own.name,
          short: own.name,
          lang: own.lang,
          category: own.category,
          level: own.level,
          feed: own.feed,
          site: safeOrigin(own.feed),
        } satisfies Source)
      : null;
  };

  const shelfWithContent = new Set(shelf.filter((id) => (counts.get(id) ?? 0) > 0));

  const entries: RailEntry[] = [];
  const seen = new Set<string>();

  for (const { sourceId, at } of recent) {
    const source = resolve(sourceId);
    if (!source || seen.has(sourceId)) continue;
    seen.add(sourceId);
    entries.push({
      id: source.id,
      name: source.name,
      short: source.short ?? source.name,
      site: source.site,
      filterable: shelfWithContent.has(sourceId),
      count: counts.get(sourceId),
      recentAt: at,
    });
  }

  for (const id of shelf) {
    if (seen.has(id) || !shelfWithContent.has(id)) continue;
    const source = resolve(id);
    if (!source) continue;
    seen.add(id);
    entries.push({
      id: source.id,
      name: source.name,
      short: source.short ?? source.name,
      site: source.site,
      filterable: true,
      count: counts.get(id),
    });
  }

  if (entries.length < 2) return null;

  return (
    <div ref={rowRef} className="no-scrollbar -mx-4 mb-3.5 flex gap-2 overflow-x-auto px-4 pb-0.5">
      <button
        type="button"
        onClick={() => onSelect(null)}
        data-selected={selected === null}
        className="chip !py-1.5"
      >
        {t("feed.allPapers")}
      </button>

      {entries.map((entry) =>
        entry.filterable ? (
          <button
            key={entry.id}
            type="button"
            onClick={() => onSelect(selected === entry.id ? null : entry.id)}
            data-selected={selected === entry.id}
            className="relative chip !gap-2 !py-1.5 !pr-1.5"
            title={
              entry.recentAt
                ? `${entry.name} · opened ${timeAgo(entry.recentAt)}`
                : `${entry.name} · ${entry.count ?? 0} stories`
            }
          >
            {entry.recentAt && <RecentDot />}
            <SourceAvatar name={entry.name} site={entry.site} size={18} />
            <span className="max-w-[9rem] truncate">{entry.short}</span>
            <span className="rounded-full bg-[color-mix(in_srgb,currentColor_14%,transparent)] px-1.5 py-0.5 text-[11px] tabular-nums leading-none">
              {entry.count ?? 0}
            </span>
          </button>
        ) : (
          <Link
            key={entry.id}
            href={`/s/${encodeURIComponent(entry.id)}`}
            className="chip relative !gap-2 !py-1.5"
            title={`${entry.name} · opened ${timeAgo(entry.recentAt ?? "")}`}
          >
            <RecentDot />
            <SourceAvatar name={entry.name} site={entry.site} size={18} />
            <span className="max-w-[9rem] truncate">{entry.short}</span>
          </Link>
        ),
      )}

      <Link href="/sources" className="chip !py-1.5">
        <PlusIcon width={14} height={14} /> {t("feed.morePapers")}
      </Link>
    </div>
  );
}

/** A quiet clock mark, not a badge - recency is context, not a status to shout. */
function RecentDot() {
  return (
    <HistoryIcon
      width={11}
      height={11}
      className="absolute -left-0.5 -top-0.5 rounded-full bg-surface text-muted"
      aria-hidden
    />
  );
}

function safeOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}
