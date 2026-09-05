"use client";

import Link from "next/link";
import type { FeedItem } from "@/lib/types";
import { readerHref, timeAgo } from "@/lib/format";
import { LEVEL_LABELS } from "@/lib/sources";

const LEVEL_TONE: Record<string, string> = {
  easy: "bg-[color-mix(in_srgb,var(--translation)_18%,transparent)] text-translation",
  medium: "bg-surface-2 text-muted",
  hard: "bg-surface-2 text-muted",
};

export function ArticleCard({ item }: { item: FeedItem }) {
  return (
    <article className="card group overflow-hidden transition-shadow hover:shadow-[var(--shadow)]">
      <Link
        href={readerHref({ url: item.link, lang: item.lang, source: item.sourceId })}
        className="flex gap-4 p-4"
      >
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
            <span className="font-medium uppercase tracking-wide text-accent">
              {item.sourceName}
            </span>
            <span aria-hidden>·</span>
            <span className="uppercase">{item.lang}</span>
            {item.publishedAt && (
              <>
                <span aria-hidden>·</span>
                <time dateTime={item.publishedAt}>{timeAgo(item.publishedAt)}</time>
              </>
            )}
            <span
              className={`ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                LEVEL_TONE[item.level] ?? "bg-surface-2 text-muted"
              }`}
            >
              {LEVEL_LABELS[item.level]}
            </span>
          </div>

          <h2 className="text-[15px] font-semibold leading-snug text-fg group-hover:text-accent sm:text-base">
            {item.title}
          </h2>

          {item.summary && (
            <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-muted">
              {item.summary}
            </p>
          )}
        </div>

        {item.image && (
          // A plain img keeps every publisher's CDN working without a domain
          // allowlist, and these thumbnails are small by definition.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.image}
            alt=""
            loading="lazy"
            className="hidden h-20 w-28 shrink-0 rounded-lg border border-border object-cover sm:block"
          />
        )}
      </Link>
    </article>
  );
}
