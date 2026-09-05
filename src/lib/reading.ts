"use client";

import type { SourceLang } from "./types";

const KEY = "pn:reading-now:v1";

/**
 * The article currently open, kept so the reader can wander off to the
 * vocabulary list or the source shelf and get back with one tap.
 */
export interface ReadingNow {
  url: string;
  title: string;
  sourceName: string;
  lang: SourceLang;
  sourceId?: string;
  /** 0 to 100, how far down the article they had scrolled. */
  progress: number;
  updatedAt: string;
}

export function getReadingNow(): ReadingNow | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as ReadingNow;
    // A week-old "continue reading" bar is clutter, not a convenience.
    if (Date.now() - Date.parse(value.updatedAt) > 7 * 86_400_000) return null;
    return value;
  } catch {
    return null;
  }
}

export function setReadingNow(value: Omit<ReadingNow, "updatedAt">): void {
  try {
    const payload: ReadingNow = { ...value, updatedAt: new Date().toISOString() };
    window.localStorage.setItem(KEY, JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent("pn:reading", { detail: payload }));
  } catch {
    // Nothing here is worth interrupting a reading session for.
  }
}

export function clearReadingNow(): void {
  try {
    window.localStorage.removeItem(KEY);
    window.dispatchEvent(new CustomEvent("pn:reading", { detail: null }));
  } catch {
    // Ignore.
  }
}
