"use client";

import type { FeedItem } from "./types";

const KEY = "pn:handoff:v1";
const MAX = 30;

/**
 * What the newsstand already knew about a story, carried into the reader.
 *
 * When a publisher blocks our request there is nothing to extract, but the
 * feed summary is already in hand. Passing it through the session means a
 * paywalled article still opens as something you can read and translate,
 * instead of a dead end.
 */
export function rememberItem(item: FeedItem): void {
  try {
    const store = read();
    store[item.link] = { title: item.title, summary: item.summary, sourceName: item.sourceName };
    const keys = Object.keys(store);
    if (keys.length > MAX) delete store[keys[0]];
    sessionStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // Session storage is a convenience, never a requirement.
  }
}

export function recallItem(
  url: string,
): { title: string; summary: string; sourceName: string } | undefined {
  return read()[url];
}

function read(): Record<string, { title: string; summary: string; sourceName: string }> {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
}
