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

/* --------------------------------------------------------- papers, not pieces */

const SOURCE_KEY = "pn:recent-sources:v1";
const SOURCE_MAX = 12;

export interface RecentSource {
  sourceId: string;
  at: string;
}

/** Opening a paper's own page counts as visiting it, even if nothing is read. */
export function noteSourceVisit(sourceId: string): void {
  if (!sourceId) return;
  try {
    const list = readSources().filter((s) => s.sourceId !== sourceId);
    list.unshift({ sourceId, at: new Date().toISOString() });
    window.localStorage.setItem(SOURCE_KEY, JSON.stringify(list.slice(0, SOURCE_MAX)));
    window.dispatchEvent(new CustomEvent("pn:store", { detail: SOURCE_KEY }));
  } catch {
    // Not worth interrupting anything for.
  }
}

function readSources(): RecentSource[] {
  if (typeof window === "undefined") return [];
  try {
    const list = JSON.parse(window.localStorage.getItem(SOURCE_KEY) ?? "[]") as RecentSource[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/**
 * The papers most recently opened, whether by visiting the paper itself or by
 * reading something from it. Reading an article is the commoner way to arrive
 * at a paper, so leaving it out would make this list wrong on the first day.
 */
export function getRecentSources(limit = 8): RecentSource[] {
  const newest = new Map<string, string>();
  for (const visit of readSources()) {
    const seen = newest.get(visit.sourceId);
    if (!seen || visit.at > seen) newest.set(visit.sourceId, visit.at);
  }
  for (const article of getRecent()) {
    if (!article.sourceId) continue;
    const seen = newest.get(article.sourceId);
    if (!seen || article.readAt > seen) newest.set(article.sourceId, article.readAt);
  }
  return [...newest]
    .map(([sourceId, at]) => ({ sourceId, at }))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit);
}

export function clearRecentSources(): void {
  try {
    window.localStorage.removeItem(SOURCE_KEY);
    window.dispatchEvent(new CustomEvent("pn:store", { detail: SOURCE_KEY }));
  } catch {
    // Ignore.
  }
}
