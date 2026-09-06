"use client";

import type { SourceLang } from "./types";

const KEY = "pn:recent:v1";
const MAX = 40;

export interface RecentArticle {
  url: string;
  title: string;
  sourceName: string;
  sourceId?: string;
  lang: SourceLang;
  readAt: string;
  /** How far they got, so the list can show what is unfinished. */
  progress: number;
}

export function getRecent(): RecentArticle[] {
  if (typeof window === "undefined") return [];
  try {
    const list = JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as RecentArticle[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** Opening the same piece twice should move it up the list, not duplicate it. */
export function noteRead(entry: Omit<RecentArticle, "readAt">): void {
  try {
    const list = getRecent().filter((a) => a.url !== entry.url);
    list.unshift({ ...entry, readAt: new Date().toISOString() });
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
    window.dispatchEvent(new CustomEvent("pn:store", { detail: KEY }));
  } catch {
    // Nothing here is worth interrupting a reading session for.
  }
}

export function clearRecent(): void {
  try {
    window.localStorage.removeItem(KEY);
    window.dispatchEvent(new CustomEvent("pn:store", { detail: KEY }));
  } catch {
    // Ignore.
  }
}
