"use client";

import Link from "next/link";
import { memo, useState } from "react";
import type { FeedItem } from "@/lib/types";
import { readerHref, timeAgo } from "@/lib/format";
import { rememberItem } from "@/lib/handoff";
import { SOURCE_BY_ID } from "@/lib/sources";
import { SourceAvatar } from "./SourceAvatar";

/**
 * The source name is its own link, so it has to sit outside the card link
 * rather than nested inside it. Only the Easy badge survives: on every card a
 * difficulty chip was noise, but "this one is written for learners" is the one
 * signal worth interrupting for.
 */
function Meta({ item, linkSource = true }: { item: FeedItem; linkSource?: boolean }) {
  const site = SOURCE_BY_ID.get(item.sourceId)?.site;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-muted">
      <SourceAvatar name={item.sourceName} site={site} size={16} />
      {linkSource ? (
        <Link
          href={`/s/${encodeURIComponent(item.sourceId)}`}
          className="font-semibold uppercase tracking-wide text-accent hover:underline"
        >
          {item.sourceName}
        </Link>
      ) : (
        <span className="font-semibold uppercase tracking-wide text-accent">
          {item.sourceName}
        </span>
      )}
      {item.publishedAt && (
        <>
          <span aria-hidden>·</span>
          <time dateTime={item.publishedAt}>{timeAgo(item.publishedAt)}</time>
        </>
      )}
      {item.level === "easy" && (
        <span className="rounded-full bg-[color-mix(in_srgb,var(--translation)_16%,transparent)] px-1.5 py-0.5 text-[10.5px] font-medium text-translation">
          Easy German
        </span>
      )}
    </div>
  );
}

/** Publisher thumbnails break often, so a failed image collapses silently. */
function Thumb({ src, className }: { src?: string; className: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={`thumb ${className}`}
    />
  );
}

/** The lead story, given the room a front page would give it. */
export function FeaturedCard({ item }: { item: FeedItem }) {
  return (
    <article className="card card-hover overflow-hidden">
      <div className="sm:flex sm:items-stretch">
        <Link
          href={readerHref({ url: item.link, lang: item.lang, source: item.sourceId })}
          className="block sm:order-2 sm:w-[42%] sm:shrink-0"
          tabIndex={-1}
          aria-hidden
        >
          <Thumb src={item.image} className="h-44 w-full !rounded-none sm:h-full sm:min-h-[13rem]" />
        </Link>
        <div className="p-4 sm:order-1 sm:flex sm:flex-1 sm:flex-col sm:justify-center sm:p-6">
          <Meta item={item} />
          <Link
            href={readerHref({ url: item.link, lang: item.lang, source: item.sourceId })}
            onClick={() => rememberItem(item)}
            className="mt-1.5 block"
          >
            <h2 className="text-[1.15rem] font-bold leading-snug tracking-tight sm:text-[1.55rem]">
              {item.title}
            </h2>
            {item.summary && (
              <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">{item.summary}</p>
            )}
          </Link>
        </div>
      </div>
    </article>
  );
}

function ArticleCardImpl({ item, linkSource = true }: { item: FeedItem; linkSource?: boolean }) {
  return (
    <article className="card card-hover overflow-hidden p-3.5 sm:p-4">
      <Meta item={item} linkSource={linkSource} />
      <Link
        href={readerHref({ url: item.link, lang: item.lang, source: item.sourceId })}
        onClick={() => rememberItem(item)}
        className="mt-1.5 flex gap-3.5"
      >
        <div className="min-w-0 flex-1">
          <h2 className="text-[16px] font-semibold leading-snug sm:text-[17px]">{item.title}</h2>
          {item.summary && (
            <p className="mt-1.5 line-clamp-2 text-[13.5px] leading-relaxed text-muted">
              {item.summary}
            </p>
          )}
        </div>
        <Thumb src={item.image} className="h-[4.5rem] w-[4.5rem] shrink-0 sm:h-[5.5rem] sm:w-[7.5rem]" />
      </Link>
    </article>
  );
}

/**
 * The shelf can hold a couple of hundred of these, and the search box types
 * into shared state, so re-rendering every card per keystroke is the one
 * obvious waste worth removing.
 */
export const ArticleCard = memo(ArticleCardImpl);
