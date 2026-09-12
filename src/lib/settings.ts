"use client";

import type { SourceLang, TargetLang } from "./types";
import { detectUiLang, type UiLang } from "./i18n";
import { DEFAULT_SOURCE_IDS } from "./sources";

export type ThemeName = "paper" | "sepia" | "modern" | "slate" | "ink";
export type FontName = "charter" | "georgia" | "palatino" | "inter" | "verdana";

/**
 * Five faces, all already on the device, so nothing is downloaded and nothing
 * shifts while a page loads. Each is here for a different kind of long read.
 */
export const FONTS: { id: FontName; label: string; hint: string }[] = [
  { id: "charter", label: "Charter", hint: "Newspaper serif, the default" },
  { id: "georgia", label: "Georgia", hint: "Made for screens, generous x-height" },
  { id: "palatino", label: "Palatino", hint: "Bookish and calm for very long reads" },
  { id: "inter", label: "Inter", hint: "Clean sans, best at small sizes" },
  { id: "verdana", label: "Verdana", hint: "Wide and open, easiest on tired eyes" },
];

export interface Settings {
  /** "system" follows the OS and flips between paper and ink. */
  theme: ThemeName | "system";
  font: FontName;
  /** Body text size in px. */
  fontSize: number;
  lineHeight: number;
  /** Line length in ch, the single biggest lever on reading comfort. */
  measure: number;
  /** Extra letter spacing in em, which helps a lot of readers. */
  tracking: number;
  target: TargetLang;
  /** The language of the interface itself, independent of what you read. */
  uiLang: UiLang;
  /** Whole-page zoom, separate from the reading text size. */
  zoom: number;
  /** Speaking rate for read-aloud, where 1 is the device's normal pace. */
  speechRate: number;
  /** Chosen voice per language, by voiceURI. Empty means "let the device pick". */
  voices: Partial<Record<SourceLang | TargetLang, string>>;
  /** "lines" gives every sentence its own row; "flow" keeps normal paragraphs. */
  layout: "lines" | "flow";
  /** Show every translation at once instead of tapping line by line. */
  bilingual: boolean;
  /** Tap a word for an instant lookup. */
  wordLookup: boolean;
  /** Colour words by whether you already know them. */
  heatmap: boolean;
  /** Keep papers that lock most articles off the shelf until asked for. */
  hidePaywalled: boolean;
  /** Keep articles already read off the shelf too. */
  hideRead: boolean;
  sources: string[];
  /**
   * A source on the shelf the reader specifically wants: pinned first on the
   * home rail, and sent first when the feed is built, so it is never one of
   * the ones dropped once the shelf holds more than fits in a single fetch.
   */
  favorites: string[];
}

export const DEFAULT_SETTINGS: Settings = {
  theme: "sepia",
  font: "charter",
  fontSize: 20,
  lineHeight: 1.8,
  measure: 68,
  tracking: 0,
  target: "en",
  uiLang: "en",
  zoom: 1,
  speechRate: 0.9,
  voices: {},
  layout: "lines",
  bilingual: false,
  wordLookup: true,
  heatmap: true,
  hidePaywalled: true,
  hideRead: false,
  sources: DEFAULT_SOURCE_IDS,
  favorites: [],
};

export const SETTINGS_KEY = "pn:settings:v1";

export const THEMES: { id: Settings["theme"]; label: string; hint: string }[] = [
  { id: "paper", label: "Paper", hint: "Bright white, high contrast" },
  { id: "sepia", label: "Sepia", hint: "Warm paper tone, easy on long reads" },
  { id: "modern", label: "Modern", hint: "Modern parchment, crisp and warm" },
  { id: "slate", label: "Slate", hint: "Soft dark, low glare" },
  { id: "ink", label: "Ink", hint: "Near black, best at night" },
  { id: "system", label: "System", hint: "Follow your device" },
];

export function loadSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    // First visit: start in the reader's own language rather than English.
    if (!raw) return { ...DEFAULT_SETTINGS, uiLang: detectUiLang() };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return sanitize({ ...DEFAULT_SETTINGS, ...parsed });
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

export function sanitize(s: Settings): Settings {
  const sources = Array.isArray(s.sources) && s.sources.length ? s.sources : DEFAULT_SOURCE_IDS;
  const sourceSet = new Set(sources);
  return {
    ...s,
    fontSize: clamp(s.fontSize, 15, 28, DEFAULT_SETTINGS.fontSize),
    lineHeight: clamp(s.lineHeight, 1.3, 2.4, DEFAULT_SETTINGS.lineHeight),
    measure: clamp(s.measure, 42, 92, DEFAULT_SETTINGS.measure),
    zoom: clamp(s.zoom, 0.8, 1.5, DEFAULT_SETTINGS.zoom),
    speechRate: clamp(s.speechRate, 0.5, 1.5, DEFAULT_SETTINGS.speechRate),
    voices: s.voices && typeof s.voices === "object" ? s.voices : {},
    tracking: clamp(s.tracking, 0, 0.06, DEFAULT_SETTINGS.tracking),
    sources,
    // Favoriting a source you have since removed from the shelf would leave
    // it silently pinned again the moment it was re-added for any reason.
    favorites: Array.isArray(s.favorites) ? s.favorites.filter((id) => sourceSet.has(id)) : [],
  };
}

/** Push settings onto the document so CSS can do the rest. */
export function applySettings(s: Settings): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const resolved =
    s.theme === "system"
      ? window.matchMedia?.("(prefers-color-scheme: dark)").matches
        ? "ink"
        : "paper"
      : s.theme;
  root.dataset.theme = resolved;
  root.dataset.font = s.font;
  root.style.setProperty("--reading-size", `${s.fontSize}px`);
  root.style.setProperty("--reading-leading", String(s.lineHeight));
  root.style.setProperty("--reading-measure", `${s.measure}ch`);
  root.style.setProperty("--reading-tracking", `${s.tracking}em`);
  root.style.setProperty("--ui-zoom", String(s.zoom ?? 1));
  root.style.colorScheme = resolved === "paper" || resolved === "sepia" || resolved === "modern" ? "light" : "dark";
}
