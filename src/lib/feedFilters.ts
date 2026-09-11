"use client";

/**
 * The shelf's filters, remembered across a visit to an article and back.
 *
 * These were plain useState in FeedClient, which reset to the defaults on
 * every remount - and opening an article and returning is exactly that. A
 * reader who picked "English only" lost that choice the moment they came
 * back from a piece, which made the filter feel broken rather than helpful.
 * The module-level value survives client-side navigation; sessionStorage
 * carries it across a reload too, the same split feedCache.ts already uses.
 */
const KEY = "pn:feed-filters:v1";

export interface FeedFilters {
  lang: "all" | "de" | "en" | "vi";
  category: string;
  month: string;
  sort: "newest" | "oldest";
  query: string;
  source: string | null;
}

const DEFAULT_FILTERS: FeedFilters = {
  lang: "all",
  category: "all",
  month: "all",
  sort: "newest",
  query: "",
  source: null,
};

let memory: FeedFilters | null = null;

export function getFeedFilters(): FeedFilters {
  if (memory) return memory;
  if (typeof window === "undefined") return DEFAULT_FILTERS;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    memory = raw ? { ...DEFAULT_FILTERS, ...(JSON.parse(raw) as Partial<FeedFilters>) } : DEFAULT_FILTERS;
  } catch {
    memory = DEFAULT_FILTERS;
  }
  return memory;
}

export function setFeedFilters(filters: FeedFilters): void {
  memory = filters;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(filters));
  } catch {
    // A full sessionStorage costs us the reload case, nothing more.
  }
}
