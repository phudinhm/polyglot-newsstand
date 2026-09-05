"use client";

import type { Category, Level, Source, SourceLang } from "./types";

const KEY = "pn:custom-sources:v1";
export const MAX_CUSTOM_SOURCES = 12;

/** A source the reader added themselves, stored only in their browser. */
export interface CustomSource {
  id: string;
  name: string;
  feed: string;
  lang: SourceLang;
  category: Category;
  level: Level;
  /** How it was created, so the UI can explain what it is. */
  kind: "rss" | "site" | "topic";
  note?: string;
}

export function getCustomSources(): CustomSource[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as CustomSource[]) : [];
    return Array.isArray(list) ? list.slice(0, MAX_CUSTOM_SOURCES) : [];
  } catch {
    return [];
  }
}

function write(list: CustomSource[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_CUSTOM_SOURCES)));
    window.dispatchEvent(new CustomEvent("pn:store", { detail: KEY }));
  } catch {
    // A blocked localStorage should never break the page.
  }
}

export function addCustomSource(source: Omit<CustomSource, "id">): CustomSource {
  const list = getCustomSources();
  const existing = list.find((s) => s.feed === source.feed);
  if (existing) return existing;
  const created: CustomSource = {
    ...source,
    id: `custom:${Math.random().toString(36).slice(2, 10)}`,
  };
  write([...list, created]);
  return created;
}

export function removeCustomSource(id: string): void {
  write(getCustomSources().filter((s) => s.id !== id));
}

/** Custom sources are Sources everywhere else in the app. */
export function asSource(custom: CustomSource): Source {
  return {
    id: custom.id,
    name: custom.name,
    short: custom.name,
    lang: custom.lang,
    category: custom.category,
    level: custom.level,
    feed: custom.feed,
    site: safeOrigin(custom.feed),
    note: custom.note,
  };
}

function safeOrigin(feed: string): string {
  try {
    return new URL(feed).origin;
  } catch {
    return feed;
  }
}

/**
 * Google News publishes a public RSS endpoint for any search query, which is
 * the practical way to follow a publisher that has retired its own feed.
 * Most consultancies and think tanks fall into that category.
 */
export function googleNewsFeed(options: {
  mode: "site" | "topic";
  value: string;
  lang: SourceLang;
}): string {
  const { mode, value, lang } = options;
  const cleaned = value.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const query = mode === "site" ? `site:${cleaned}` : value.trim();
  const locale =
    lang === "de"
      ? { hl: "de", gl: "DE", ceid: "DE:de" }
      : { hl: "en-US", gl: "US", ceid: "US:en" };
  const params = new URLSearchParams({ q: query, ...locale });
  return `https://news.google.com/rss/search?${params.toString()}`;
}

/**
 * One-click follows for publications whose own RSS is unreliable or absent.
 * Each resolves through Google News, so the headlines are real and the links
 * point at the publisher.
 */
export const SOURCE_PRESETS: {
  label: string;
  domain: string;
  category: Category;
  level: Level;
  note: string;
}[] = [
  { label: "Deloitte Insights", domain: "deloitte.com", category: "business", level: "hard", note: "Audit and consulting research" },
  { label: "PwC", domain: "pwc.com", category: "business", level: "hard", note: "Global assurance and advisory" },
  { label: "KPMG", domain: "kpmg.com", category: "business", level: "hard", note: "Advisory and tax insight" },
  { label: "EY", domain: "ey.com", category: "business", level: "hard", note: "Consulting and transactions" },
  { label: "BCG", domain: "bcg.com", category: "business", level: "hard", note: "Strategy research" },
  { label: "Bain & Company", domain: "bain.com", category: "business", level: "hard", note: "Strategy and private equity" },
  { label: "Statista", domain: "statista.com", category: "business", level: "medium", note: "Data and market figures" },
  { label: "Handelsblatt (DE)", domain: "handelsblatt.com", category: "business", level: "hard", note: "German business daily" },
];
