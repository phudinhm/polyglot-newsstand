"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { clearReadingNow, getReadingNow, type ReadingNow } from "@/lib/reading";
import { readerHref } from "@/lib/format";
import { CloseIcon } from "./Icons";

/**
 * A slim bar that follows the reader around the app while an article is open.
 *
 * On a wide screen it sits against the right edge, out of the way of the
 * content column. On a phone it docks just above the tab bar, where a thumb
 * already is.
 */
export function ContinueReading() {
  const pathname = usePathname();
  const [current, setCurrent] = useState<ReadingNow | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const sync = () => setCurrent(getReadingNow());
    sync();
    const onReading = (e: Event) => setCurrent((e as CustomEvent<ReadingNow | null>).detail);
    window.addEventListener("pn:reading", onReading);
    window.addEventListener("focus", sync);
    return () => {
      window.removeEventListener("pn:reading", onReading);
      window.removeEventListener("focus", sync);
    };
  }, [pathname]);

  // Never shadow the article it points at.
  if (!current || dismissed || pathname?.startsWith("/read")) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[4.25rem] z-30 px-3 sm:inset-x-auto sm:right-5 sm:bottom-6 sm:px-0">
      <div className="slide-in-up sm:slide-in-right pointer-events-auto mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-border p-2.5 shadow-[var(--shadow)] glass-strong sm:mx-0 sm:w-80">
        <Link
          href={readerHref({ url: current.url, lang: current.lang, source: current.sourceId })}
          className="flex min-w-0 flex-1 items-center gap-3"
        >
          {/* A ring reads as progress faster than a number does. */}
          <span
            aria-hidden
            className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full"
            style={{
              background: `conic-gradient(var(--accent) ${current.progress * 3.6}deg, color-mix(in srgb, var(--accent) 18%, transparent) 0deg)`,
            }}
          >
            <span className="grid h-[1.9rem] w-[1.9rem] place-items-center rounded-full bg-surface text-[10px] font-semibold tabular-nums">
              {Math.round(current.progress)}
            </span>
          </span>
          <span className="min-w-0">
            <span className="block text-[10px] font-medium uppercase tracking-wider text-accent">
              Continue reading
            </span>
            <span className="block truncate text-[13px] font-medium leading-snug">
              {current.title}
            </span>
            <span className="block truncate text-[11px] text-muted">{current.sourceName}</span>
          </span>
        </Link>
        <button
          type="button"
          onClick={() => {
            clearReadingNow();
            setDismissed(true);
          }}
          className="btn shrink-0 !px-1.5 !py-1.5"
          aria-label="Dismiss continue reading"
        >
          <CloseIcon width={15} height={15} />
        </button>
      </div>
    </div>
  );
}
