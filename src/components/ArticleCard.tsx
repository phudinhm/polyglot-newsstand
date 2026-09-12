"use client";

import Link from "next/link";
import { memo, useMemo, useState } from "react";
import type { FeedItem } from "@/lib/types";
import { readerHref, timeAgo } from "@/lib/format";
import { rememberItem } from "@/lib/handoff";
import { newWordCount } from "@/lib/frequency";
import { SOURCE_BY_ID } from "@/lib/sources";
import { isSaved, toggleSaved } from "@/lib/store";
import { BookmarkIcon } from "./Icons";
import { SourceAvatar } from "./SourceAvatar";

/**
 * The source name is its own link, so it has to sit outside the card link
 * rather than nested inside it. Only the Easy badge survives: on every card a
 * difficulty chip was noise, but "this one is written for learners" is the one
 * signal worth interrupting for.
 */
function Meta({
  item,
  linkSource = true,
  blocked = false,
  read = false,
}: {
  item: FeedItem;
  linkSource?: boolean;
  /** True when this device has already been turned away by this publisher. */
  blocked?: boolean;
  /** True when this device has already read this piece. */
  read?: boolean;
}) {
  const site = SOURCE_BY_ID.get(item.sourceId)?.site;
  const readTime = useMemo(() => {
    const words = (item.title + " " + (item.summary || "")).trim().split(/\s+/).length;
    return Math.max(1, Math.ceil(words / 45));
  }, [item.title, item.summary]);

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
      <span aria-hidden>·</span>
      <span>{readTime} min read</span>
      {blocked && (
        <span
          className="rounded-full border border-border px-1.5 py-0.5 text-[10.5px] font-medium text-fg"
          title="This publisher turned us away last time you opened something here."
        >
          didn&apos;t load last time
        </span>
      )}
      {!blocked && item.paywall && (
        <span
          className="rounded-full border border-border px-1.5 py-0.5 text-[10.5px] font-medium text-fg"
          title={
            item.paywall === "hard"
              ? "Most articles here are locked; you will usually need the publisher's site."
              : "Some articles here are metered."
          }
        >
          {item.paywall === "hard" ? "paywall" : "metered"}
        </span>
      )}
      {item.level === "easy" && (
        <span className="rounded-full bg-[color-mix(in_srgb,var(--translation)_16%,transparent)] px-1.5 py-0.5 text-[10.5px] font-medium text-translation">
          Easy German
        </span>
      )}
      <NewWordsBadge item={item} />
      {read && (
        <span
          className="rounded-full border border-border px-1.5 py-0.5 text-[10.5px] font-medium text-muted"
          title="You have already read this one."
        >
          read
        </span>
      )}
    </div>
  );
}

/**
 * A quiet nudge toward the point of the app: this headline alone carries a
 * few words worth learning. Only shown past a small threshold, so it reads
 * as a genuine signal rather than decorating every single card.
 */
function NewWordsBadge({ item }: { item: FeedItem }) {
  const count = useMemo(
    () => newWordCount(`${item.title} ${item.summary}`, item.lang),
    [item.title, item.summary, item.lang],
  );
  if (count < 4) return null;
  return (
    <span
      className="rounded-full bg-[color-mix(in_srgb,var(--translation)_10%,transparent)] px-1.5 py-0.5 text-[10.5px] font-medium text-translation"
      title="Roughly how many words here are worth adding to your vocabulary."
    >
      {count} new words
    </span>
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
export function FeaturedCard({
  item,
  blocked = false,
  read = false,
}: {
  item: FeedItem;
  blocked?: boolean;
  read?: boolean;
}) {
  const [saved, setSaved] = useState(() => isSaved(item.link));

  const onToggleSave = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const next = toggleSaved({
      url: item.link,
      title: item.title,
      sourceName: item.sourceName,
      lang: item.lang,
      savedAt: new Date().toISOString(),
      image: item.image,
    });
    setSaved(next);
  };

  return (
    <article className="card card-hover group relative overflow-hidden transition-all duration-200 active:scale-[0.995]">
      <div className="sm:flex sm:items-stretch">
        <Link
          href={readerHref({ url: item.link, lang: item.lang, source: item.sourceId })}
          className="block overflow-hidden sm:order-2 sm:w-[42%] sm:shrink-0"
          tabIndex={-1}
          aria-hidden
        >
          <Thumb src={item.image} className="h-44 w-full !rounded-none object-cover transition-transform duration-300 ease-out group-hover:scale-105 sm:h-full sm:min-h-[13rem]" />
        </Link>
        <div className="p-4 sm:order-1 sm:flex sm:flex-1 sm:flex-col sm:justify-center sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <Meta item={item} blocked={blocked} read={read} />
            <button
              type="button"
              onClick={onToggleSave}
              aria-label={saved ? "Saved" : "Save for later"}
              title={saved ? "Saved" : "Save for later"}
              className={`shrink-0 rounded-full p-1.5 transition-all ${
                saved
                  ? "text-accent bg-accent/10"
                  : "text-muted hover:text-fg hover:bg-surface-2 opacity-80 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
              }`}
            >
              <BookmarkIcon width={16} height={16} fill={saved ? "currentColor" : "none"} />
            </button>
          </div>
          <Link
            href={readerHref({ url: item.link, lang: item.lang, source: item.sourceId })}
            onClick={() => rememberItem(item)}
            className="mt-1.5 block"
          >
            <h2 className="text-[1.15rem] font-bold leading-snug tracking-tight transition-colors group-hover:text-accent sm:text-[1.55rem]">
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

function ArticleCardImpl({
  item,
  linkSource = true,
  blocked = false,
  read = false,
}: {
  item: FeedItem;
  linkSource?: boolean;
  blocked?: boolean;
  read?: boolean;
}) {
  const [saved, setSaved] = useState(() => isSaved(item.link));

  const onToggleSave = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const next = toggleSaved({
      url: item.link,
      title: item.title,
      sourceName: item.sourceName,
      lang: item.lang,
      savedAt: new Date().toISOString(),
      image: item.image,
    });
    setSaved(next);
  };

  return (
    <article className="card card-hover group relative overflow-hidden p-3.5 transition-all duration-200 active:scale-[0.995] sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <Meta item={item} linkSource={linkSource} blocked={blocked} read={read} />
        <button
          type="button"
          onClick={onToggleSave}
          aria-label={saved ? "Saved" : "Save for later"}
          title={saved ? "Saved" : "Save for later"}
          className={`shrink-0 rounded-full p-1 transition-all ${
            saved
              ? "text-accent bg-accent/10"
              : "text-muted hover:text-fg hover:bg-surface-2 opacity-70 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
          }`}
        >
          <BookmarkIcon width={15} height={15} fill={saved ? "currentColor" : "none"} />
        </button>
      </div>
      <Link
        href={readerHref({ url: item.link, lang: item.lang, source: item.sourceId })}
        onClick={() => rememberItem(item)}
        className="mt-1.5 flex gap-3.5"
      >
        <div className="min-w-0 flex-1">
          <h2 className="text-[16px] font-semibold leading-snug transition-colors group-hover:text-accent sm:text-[17px]">{item.title}</h2>
          {item.summary && (
            <p className="mt-1.5 line-clamp-2 text-[13.5px] leading-relaxed text-muted">
              {item.summary}
            </p>
          )}
        </div>
        <div className="overflow-hidden rounded-xl shrink-0">
          <Thumb src={item.image} className="h-[5rem] w-[5rem] object-cover transition-transform duration-300 ease-out group-hover:scale-105 sm:h-[6rem] sm:w-[8.5rem]" />
        </div>
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
