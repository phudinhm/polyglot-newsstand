"use client";

import type { TargetLang } from "./types";
import { DEFAULT_SOURCE_IDS } from "./sources";

export type ThemeName = "paper" | "sepia" | "slate" | "ink";
export type FontName = "serif" | "sans";

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
  /** "lines" gives every sentence its own row; "flow" keeps normal paragraphs. */
  layout: "lines" | "flow";
  /** Show every translation at once instead of tapping line by line. */
  bilingual: boolean;
  /** Tap a word for an instant lookup. */
  wordLookup: boolean;
  /** The faint paper grain over the whole page. */
  texture: boolean;
  sources: string[];
}

export const DEFAULT_SETTINGS: Settings = {
  theme: "sepia",
  font: "serif",
  fontSize: 20,
  lineHeight: 1.8,
  measure: 68,
  tracking: 0,
  target: "en",
  layout: "lines",
  bilingual: false,
  wordLookup: true,
  texture: true,
  sources: DEFAULT_SOURCE_IDS,
};

export const SETTINGS_KEY = "pn:settings:v1";

export const THEMES: { id: Settings["theme"]; label: string; hint: string }[] = [
  { id: "paper", label: "Paper", hint: "Bright white, high contrast" },
  { id: "sepia", label: "Sepia", hint: "Warm paper tone, easy on long reads" },
  { id: "slate", label: "Slate", hint: "Soft dark, low glare" },
  { id: "ink", label: "Ink", hint: "Near black, best at night" },
  { id: "system", label: "System", hint: "Follow your device" },
];

export function loadSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
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
  return {
    ...s,
    fontSize: clamp(s.fontSize, 15, 28, DEFAULT_SETTINGS.fontSize),
    lineHeight: clamp(s.lineHeight, 1.3, 2.4, DEFAULT_SETTINGS.lineHeight),
    measure: clamp(s.measure, 42, 92, DEFAULT_SETTINGS.measure),
    tracking: clamp(s.tracking, 0, 0.06, DEFAULT_SETTINGS.tracking),
    sources: Array.isArray(s.sources) && s.sources.length ? s.sources : DEFAULT_SOURCE_IDS,
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
  root.dataset.texture = s.texture === false ? "off" : "on";
  root.style.setProperty("--reading-size", `${s.fontSize}px`);
  root.style.setProperty("--reading-leading", String(s.lineHeight));
  root.style.setProperty("--reading-measure", `${s.measure}ch`);
  root.style.setProperty("--reading-tracking", `${s.tracking}em`);
  root.style.colorScheme = resolved === "paper" || resolved === "sepia" ? "light" : "dark";
}
