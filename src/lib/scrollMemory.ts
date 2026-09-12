"use client";

/**
 * Scroll Memory Manager.
 *
 * Remembers exact scroll positions for routes (especially the feed, sources,
 * saved, and source pages) so navigating back from an article or detail page
 * returns the reader to the exact spot where they left off, instead of jumping
 * back to the top of the page.
 */

const KEY_PREFIX = "pn:scroll:v1:";
const IS_BACK_KEY = "pn:is-back:v1";
const FEED_VISIBLE_KEY = "pn:feed-visible:v1";
const LAST_ARTICLE_KEY = "pn:last-article:v1";

/** In-memory cache across client-side transitions. */
const memory = new Map<string, number>();

// Listen for browser popstate (back / forward buttons, swipe gestures)
if (typeof window !== "undefined") {
  try {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
  } catch {
    /* ignore */
  }

  window.addEventListener("popstate", () => {
    try {
      sessionStorage.setItem(IS_BACK_KEY, "1");
    } catch {
      /* ignore */
    }
  });
}

/** Normalized pathname + search key. */
export function getRouteKey(path?: string): string {
  if (path) return path;
  if (typeof window === "undefined") return "/";
  return window.location.pathname + window.location.search;
}

/** Save current scroll position for a route. */
export function saveScrollPosition(path?: string, y?: number): void {
  if (typeof window === "undefined") return;
  const key = getRouteKey(path);
  const pos = Math.round(y ?? window.scrollY);
  memory.set(key, pos);
  try {
    sessionStorage.setItem(`${KEY_PREFIX}${key}`, String(pos));
  } catch {
    /* ignore storage quota */
  }
}

/** Read saved scroll position for a route. */
export function getSavedScrollPosition(path?: string): number | null {
  if (typeof window === "undefined") return null;
  const key = getRouteKey(path);
  if (memory.has(key)) {
    return memory.get(key)!;
  }
  try {
    const raw = sessionStorage.getItem(`${KEY_PREFIX}${key}`);
    if (raw !== null) {
      const parsed = parseInt(raw, 10);
      return Number.isNaN(parsed) ? null : parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Mark that a back action was explicitly triggered (e.g. by back button). */
export function markBackAction(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(IS_BACK_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** Check if the current visit was caused by a back navigation. */
export function isBackNavigation(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(IS_BACK_KEY) === "1";
  } catch {
    return false;
  }
}

/** Clear the back action flag once consumed. */
export function clearBackAction(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(IS_BACK_KEY);
  } catch {
    /* ignore */
  }
}

/** Record when an article is clicked so we know where to return. */
export function recordArticleClick(articleUrl: string, visibleCount?: number): void {
  if (typeof window === "undefined") return;
  const path = getRouteKey();
  saveScrollPosition(path, window.scrollY);
  try {
    sessionStorage.setItem(LAST_ARTICLE_KEY, articleUrl);
    if (visibleCount && visibleCount > 0) {
      sessionStorage.setItem(FEED_VISIBLE_KEY, String(visibleCount));
    }
  } catch {
    /* ignore */
  }
}

/** Get saved feed visible count. */
export function getSavedFeedVisible(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(FEED_VISIBLE_KEY);
    return raw ? parseInt(raw, 10) : null;
  } catch {
    return null;
  }
}

/**
 * Restores scroll position for the current route if this is a back navigation,
 * or if force is true. Retries across animation frames until DOM content has rendered.
 */
export function restoreScrollPosition(options?: {
  path?: string;
  force?: boolean;
  maxAttempts?: number;
  onDone?: () => void;
}): void {
  if (typeof window === "undefined") return;
  const path = getRouteKey(options?.path);
  const shouldRestore = options?.force || isBackNavigation();

  if (!shouldRestore) return;

  const targetY = getSavedScrollPosition(path);
  if (targetY === null || targetY <= 10) {
    clearBackAction();
    return;
  }
  const posY = targetY;

  const maxAttempts = options?.maxAttempts ?? 15;
  let attempts = 0;

  function step() {
    attempts++;
    const scrollableHeight =
      Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) -
      window.innerHeight;

    // Scroll if page is tall enough, or if we have tried enough times
    if (scrollableHeight >= posY * 0.8 || attempts >= maxAttempts) {
      window.scrollTo({ top: posY, behavior: "instant" });

      // Secondary check after layout settle (for images/fonts)
      setTimeout(() => {
        if (Math.abs(window.scrollY - posY) > 40) {
          window.scrollTo({ top: posY, behavior: "instant" });
        }
        clearBackAction();
        options?.onDone?.();
      }, 60);
      return;
    }

    requestAnimationFrame(() => {
      setTimeout(step, 30);
    });
  }

  requestAnimationFrame(step);
}
