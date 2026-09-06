"use client";

import type { FeedResponse } from "./types";

/**
 * The shelf, remembered.
 *
 * Coming back from an article should be instant. The module-level map survives
 * client-side navigation, and sessionStorage carries it across a reload, so
 * the feed is painted from what we already have and only refreshed when it is
 * genuinely old. A page that flashes a spinner on every back gesture feels
 * broken even when it is fast.
 */
const KEY = "pn:feed-cache:v1";
/** Older than this and the shelf is refreshed in the background. */
const STALE_MS = 5 * 60 * 1000;

interface Entry {
  response: FeedResponse;
  storedAt: number;
}

const memory = new Map<string, Entry>();

function readSession(key: string): Entry | undefined {
  try {
    const raw = sessionStorage.getItem(`${KEY}:${key}`);
    return raw ? (JSON.parse(raw) as Entry) : undefined;
  } catch {
    return undefined;
  }
}

export function getCachedFeed(key: string): { response: FeedResponse; stale: boolean } | null {
  const entry = memory.get(key) ?? readSession(key);
  if (!entry) return null;
  memory.set(key, entry);
  return { response: entry.response, stale: Date.now() - entry.storedAt > STALE_MS };
}

export function setCachedFeed(key: string, response: FeedResponse): void {
  const entry: Entry = { response, storedAt: Date.now() };
  memory.set(key, entry);
  try {
    // Only the first page of stories is worth persisting; the rest is noise
    // in a storage bucket that is measured in a few megabytes.
    sessionStorage.setItem(
      `${KEY}:${key}`,
      JSON.stringify({ ...entry, response: { ...response, items: response.items.slice(0, 80) } }),
    );
  } catch {
    // A full sessionStorage costs us the reload case, nothing more.
  }
}

/** The article body cache, same idea, keyed by URL. */
const articles = new Map<string, unknown>();

export function getCachedArticle<T>(url: string): T | undefined {
  return articles.get(url) as T | undefined;
}

export function setCachedArticle<T>(url: string, article: T): void {
  if (articles.size > 30) articles.delete(articles.keys().next().value as string);
  articles.set(url, article);
}
