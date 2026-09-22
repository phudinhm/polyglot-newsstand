"use client";

/**
 * Articles a reader removed from the shelf on sight - usually because a
 * paywall or "didn't load last time" badge told them not to bother. Unlike
 * the source-level block in blocked.ts, this is a judgement about one link,
 * not the whole publisher: a reader can still see other pieces from the same
 * paper. Kept on the device, the same as saved articles and blocked sources.
 */

const KEY = "pn:dismissed:v1";
const MAX = 2000;

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function write(urls: string[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(urls));
  } catch {
    // A full or locked localStorage is not worth failing a page render over.
  }
}

export function dismissedUrls(): Set<string> {
  return new Set(read());
}

/** Remove one article from the shelf, until the reader says otherwise. */
export function dismissArticle(url: string): void {
  const list = read();
  if (list.includes(url)) return;
  write([url, ...list].slice(0, MAX));
}

/** Bring a removed article back. */
export function undismissArticle(url: string): void {
  const list = read();
  if (!list.includes(url)) return;
  write(list.filter((u) => u !== url));
}

/** Bring everything back. */
export function clearAllDismissed(): void {
  write([]);
}
