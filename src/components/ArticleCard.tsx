"use client";

import Link from "next/link";
import { useState } from "react";
import type { FeedItem } from "@/lib/types";
import { readerHref, timeAgo } from "@/lib/format";
import { LEVEL_LABELS } from "@/lib/sources";

const LEVEL_TONE: Record<string, string> = {
  easy: "bg-[color-mix(in_srgb,var(--translation)_16%,transparent)] text-translation",
  medium: "bg-surface-2 text-muted",
  hard: "bg-surface-2 text-muted",
};

function Meta({ item }: { item: FeedItem }) {
  return (
    <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
      <span className="font-semibold uppercase tracking-wide text-accent">{item.sourceName}</span>
      <span aria-hidden>·</span>
      <span className="uppercase">{item.lang}</span>
      {item.publishedAt && (
        <>
          <span aria-hidden>·</span>
          <time dateTime={item.publishedAt}>{timeAgo(item.publishedAt)}</time>
        </>
      )}
      <span
        className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
          LEVEL_TONE[item.level] ?? "bg-surface-2 text-muted"
        }`}
      >
        {LEVEL_LABELS[item.level]}
      </span>
    </div>
  );
}

/** Publisher thumbnails break often, so a failed image collapses silently. */
function Thumb({
  src,
  className,
  sizes,
}: {
  src?: string;
  className: string;
  sizes?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      sizes={sizes}
      onError={() => setFailed(true)}
      className={`thumb ${className}`}
    />
  );
}

/** The lead story, given the room a front page would give it. */
export function FeaturedCard({ item }: { item: FeedItem }) {
  return (
    <article className="card card-hover overflow-hidden">
      <Link
        href={readerHref({ url: item.link, lang: item.lang, source: item.sourceId })}
        className="block sm:flex sm:items-stretch"
      >
        {/* Stacked on a phone, side by side on a wide screen so the lead story
            keeps its weight without pushing everything else below the fold. */}
        <Thumb
          src={item.image}
          className="h-44 w-full !rounded-none sm:h-auto sm:w-[44%] sm:shrink-0 sm:self-stretch"
        />
        <div className="p-4 sm:flex sm:flex-col sm:justify-center sm:p-6">
          <Meta item={item} />
          <h2 className="text-lg font-bold leading-tight tracking-tight sm:text-[1.6rem]">
            {item.title}
          </h2>
          {item.summary && (
            <p className="mt-2 line-clamp-3 text-[13.5px] leading-relaxed text-muted sm:text-sm">
              {item.summary}
            </p>
          )}
        </div>
      </Link>
    </article>
  );
}

export function ArticleCard({ item }: { item: FeedItem }) {
  return (
    <article className="card card-hover overflow-hidden">
      <Link
        href={readerHref({ url: item.link, lang: item.lang, source: item.sourceId })}
        className="flex gap-3 p-3 sm:gap-4 sm:p-4"
      >
        <div className="min-w-0 flex-1">
          <Meta item={item} />
          <h2 className="text-[15px] font-semibold leading-snug sm:text-base">{item.title}</h2>
          {item.summary && (
            <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-muted">
              {item.summary}
            </p>
          )}
        </div>
        <Thumb
          src={item.image}
          className="h-[4.5rem] w-[4.5rem] shrink-0 border border-border sm:h-24 sm:w-32"
        />
      </Link>
    </article>
  );
}
