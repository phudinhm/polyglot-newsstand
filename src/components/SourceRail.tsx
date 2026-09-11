"use client";

import Link from "next/link";
import { SOURCE_BY_ID } from "@/lib/sources";
import { getCustomSources } from "@/lib/customSources";
import type { Source } from "@/lib/types";
import { useT } from "@/hooks/useT";
import { useHorizontalScroll } from "@/hooks/useHorizontalScroll";
import { SourceAvatar } from "./SourceAvatar";
import { PlusIcon } from "./Icons";

/**
 * Pick the paper, then the story.
 *
 * The shelf is already a deliberate choice, so putting it along the top of the
 * newsstand turns "which of my papers do I feel like today" into one tap,
 * without leaving the page.
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
  const custom = getCustomSources();
  const sources: Source[] = shelf
    .map((id) => {
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
    })
    .filter((s): s is Source => Boolean(s))
    // A paper with nothing new today should not take up a slot.
    .filter((s) => (counts.get(s.id) ?? 0) > 0);

  if (sources.length < 2) return null;

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

      {sources.map((source) => (
        <button
          key={source.id}
          type="button"
          onClick={() => onSelect(selected === source.id ? null : source.id)}
          data-selected={selected === source.id}
          className="chip !gap-2 !py-1.5 !pr-1.5"
          title={`${source.name} · ${counts.get(source.id) ?? 0} stories`}
        >
          <SourceAvatar name={source.name} site={source.site} size={18} />
          <span className="max-w-[9rem] truncate">{source.short ?? source.name}</span>
          <span className="rounded-full bg-[color-mix(in_srgb,currentColor_14%,transparent)] px-1.5 py-0.5 text-[11px] tabular-nums leading-none">
            {counts.get(source.id) ?? 0}
          </span>
        </button>
      ))}

      <Link href="/sources" className="chip !py-1.5">
        <PlusIcon width={14} height={14} /> {t("feed.morePapers")}
      </Link>
    </div>
  );
}

function safeOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}
