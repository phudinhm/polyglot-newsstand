"use client";

import Link from "next/link";
import { memo, useMemo, useRef, useState } from "react";
import type { FeedItem } from "@/lib/types";
import { readerHref, timeAgo } from "@/lib/format";
import { rememberItem } from "@/lib/handoff";
import { newWordCount } from "@/lib/frequency";
import { SOURCE_BY_ID } from "@/lib/sources";
import { isSaved, toggleSaved } from "@/lib/store";
import { recordArticleClick } from "@/lib/scrollMemory";
import { BookmarkIcon, CloseIcon } from "./Icons";
import { SourceAvatar } from "./SourceAvatar";

/**
 * The source name is its own link, so it has to sit outside the card link
 * rather than nested inside it. Only the Easy badge survives: on every card a
 * difficulty chip was noise, but "this one is written for learners" is the one
 * signal worth interrupting for.
 */
const EASY_LABELS: Record<FeedItem["lang"], string> = {
  de: "Easy German",
  en: "Easy English",
  vi: "Dễ đọc",
};

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
      <span className="rounded bg-surface-2 px-1.2 py-0.2 text-[9.5px] font-semibold uppercase tracking-wider text-muted">
        {item.lang}
      </span>
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
          {EASY_LABELS[item.lang] ?? "Easy"}
        </span>
      )}
      <NewWordsBadge item={item} />
      {read && (
        <span
          className="rounded-full border border-border px-1.5 py-0.5 text-[10.5px] font-medium text-muted"
          title="You have already read this one."
        >
          ✓ read
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

/**
 * The bookmark toggle, shared between the featured and compact cards. Saving
 * gets a small spring-pop and particle burst (transitions-dev "Like button",
 * adapted to a bookmark icon); un-saving just reverses the fill without the
 * celebration, since a toggle firing twice is a correction, not two likes.
 */
function BookmarkButton({
  saved,
  onToggle,
  featured = false,
}: {
  saved: boolean;
  onToggle: (e: React.MouseEvent) => void;
  featured?: boolean;
}) {
  const [bursting, setBursting] = useState(false);
  const particlesRef = useRef<HTMLSpanElement>(null);

  const handleClick = (e: React.MouseEvent) => {
    const wasSaved = saved;
    onToggle(e);
    if (wasSaved) return;
    const dots = particlesRef.current?.querySelectorAll<HTMLElement>("i");
    dots?.forEach((dot, i) => {
      const angle = (i / dots.length) * Math.PI * 2;
      const dist = 16 + Math.random() * 6;
      dot.style.setProperty("--px", `${Math.cos(angle) * dist}px`);
      dot.style.setProperty("--py", `${Math.sin(angle) * dist}px`);
      dot.style.setProperty("--pdelay", `${i * 15}ms`);
    });
    setBursting(true);
    window.setTimeout(() => setBursting(false), 700);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={saved ? "Saved" : "Save for later"}
      title={saved ? "Saved" : "Save for later"}
      data-liked={saved}
      className={`t-like relative grid h-11 w-11 shrink-0 place-items-center rounded-full transition-all sm:h-auto sm:w-auto ${
        featured ? "sm:p-1.5" : "-my-2 sm:my-0 sm:p-1"
      } ${bursting ? "is-bursting" : ""} ${
        saved
          ? "text-accent bg-accent/10"
          : `text-muted hover:text-fg hover:bg-surface-2 ${featured ? "opacity-80" : "opacity-70"} sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100`
      }`}
    >
      <span className="t-like-icon">
        <BookmarkIcon
          width={featured ? 16 : 15}
          height={featured ? 16 : 15}
          fill={saved ? "currentColor" : "none"}
        />
      </span>
      <span className="t-like-particles" ref={particlesRef} aria-hidden>
        {Array.from({ length: 8 }).map((_, i) => (
          <i key={i} />
        ))}
      </span>
    </button>
  );
}

/**
 * Take a headline off the shelf without opening it - the point when its
 * badge already says "paywall" or "didn't load last time" and there is
 * nothing to be gained by tapping through to find out again.
 */
function RemoveButton({ onRemove, featured = false }: { onRemove: (e: React.MouseEvent) => void; featured?: boolean }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      aria-label="Remove this article"
      title="Remove this article - handy once you've seen it's paywalled or blocked"
      className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-fg sm:h-auto sm:w-auto ${
        featured ? "sm:p-1.5" : "-my-2 sm:my-0 sm:p-1"
      } opacity-70 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100`}
    >
      <CloseIcon width={featured ? 16 : 15} height={featured ? 16 : 15} />
    </button>
  );
}

/** Publisher thumbnails break often, so a failed image collapses silently. */
function Thumb({
  src,
  className,
  wrapperClassName,
}: {
  src?: string;
  className: string;
  wrapperClassName?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;
  const img = (
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
  return wrapperClassName ? <div className={wrapperClassName}>{img}</div> : img;
}

/** The lead story, given the room a front page would give it. */
export function FeaturedCard({
  item,
  blocked = false,
  read = false,
  onRemove,
}: {
  item: FeedItem;
  blocked?: boolean;
  read?: boolean;
  onRemove?: (item: FeedItem) => void;
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
          onClick={() => {
            rememberItem(item);
            recordArticleClick(item.link);
          }}
          className="block overflow-hidden sm:order-2 sm:w-[42%] sm:shrink-0"
          tabIndex={-1}
          aria-hidden
        >
          <Thumb src={item.image} className="h-44 w-full !rounded-none object-cover transition-transform duration-300 ease-out group-hover:scale-105 sm:h-full sm:min-h-[13rem]" />
        </Link>
        <div className="p-4 sm:order-1 sm:flex sm:flex-1 sm:flex-col sm:justify-center sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <Meta item={item} blocked={blocked} read={read} />
            <div className="flex shrink-0 items-center">
              <BookmarkButton saved={saved} onToggle={onToggleSave} featured />
              {onRemove && (
                <RemoveButton
                  featured
                  onRemove={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onRemove(item);
                  }}
                />
              )}
            </div>
          </div>
          <Link
            href={readerHref({ url: item.link, lang: item.lang, source: item.sourceId })}
            onClick={() => {
              rememberItem(item);
              recordArticleClick(item.link);
            }}
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
  onRemove,
}: {
  item: FeedItem;
  linkSource?: boolean;
  blocked?: boolean;
  read?: boolean;
  onRemove?: (item: FeedItem) => void;
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
    <article
      className={`card card-hover group relative overflow-hidden p-3.5 transition-all duration-200 active:scale-[0.995] sm:p-4 ${
        read ? "opacity-80 hover:opacity-100" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <Meta item={item} linkSource={linkSource} blocked={blocked} read={read} />
        <div className="flex shrink-0 items-center">
          <BookmarkButton saved={saved} onToggle={onToggleSave} />
          {onRemove && (
            <RemoveButton
              onRemove={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onRemove(item);
              }}
            />
          )}
        </div>
      </div>
      <Link
        href={readerHref({ url: item.link, lang: item.lang, source: item.sourceId })}
        onClick={() => {
          rememberItem(item);
          recordArticleClick(item.link);
        }}
        className="mt-1.5 flex gap-3.5"
      >
        <div className="min-w-0 flex-1">
          <h2 className="text-[16px] font-semibold leading-snug transition-colors group-hover:text-accent sm:text-[17px]">
            {item.title}
          </h2>
          {item.summary && (
            <p className="mt-1.5 line-clamp-2 text-[13.5px] leading-relaxed text-muted">
              {item.summary}
            </p>
          )}
        </div>
        <Thumb
          src={item.image}
          wrapperClassName="overflow-hidden rounded-xl shrink-0"
          className="h-[5rem] w-[5rem] object-cover transition-transform duration-300 ease-out group-hover:scale-105 sm:h-[6rem] sm:w-[8.5rem]"
        />
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
