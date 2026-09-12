"use client";

import type { SourceLang, TargetLang } from "./types";
import { detectUiLang, type UiLang } from "./i18n";
import { DEFAULT_SOURCE_IDS } from "./sources";

export type ThemeName = "paper" | "sepia" | "modern" | "forest" | "nordic" | "slate" | "ink";
export type FontName = "charter" | "georgia" | "palatino" | "inter" | "verdana";

export type AccentColorName =
  | "default"
  | "emerald"
  | "ocean"
  | "violet"
  | "crimson"
  | "amber"
  | "rose"
  | "teal";

export interface AccentColorDef {
  id: AccentColorName;
  label: string;
  preview: string;
  light: {
    accent: string;
    accentFg: string;
    highlight: string;
  };
  dark: {
    accent: string;
    accentFg: string;
    highlight: string;
  };
}

export const ACCENT_COLORS: AccentColorDef[] = [
  {
    id: "default",
    label: "Theme default",
    preview: "#c2410c",
    light: { accent: "#9c5227", accentFg: "#ffffff", highlight: "rgba(156, 82, 39, 0.12)" },
    dark: { accent: "#e3a06a", accentFg: "#20232a", highlight: "rgba(227, 160, 106, 0.15)" },
  },
  {
    id: "emerald",
    label: "Emerald",
    preview: "#16a34a",
    light: { accent: "#15803d", accentFg: "#ffffff", highlight: "rgba(22, 163, 74, 0.12)" },
    dark: { accent: "#4ade80", accentFg: "#0f1f14", highlight: "rgba(74, 222, 128, 0.15)" },
  },
  {
    id: "ocean",
    label: "Ocean",
    preview: "#2563eb",
    light: { accent: "#1d4ed8", accentFg: "#ffffff", highlight: "rgba(37, 99, 235, 0.12)" },
    dark: { accent: "#60a5fa", accentFg: "#0f172a", highlight: "rgba(96, 165, 250, 0.15)" },
  },
  {
    id: "violet",
    label: "Violet",
    preview: "#9333ea",
    light: { accent: "#7e22ce", accentFg: "#ffffff", highlight: "rgba(147, 51, 234, 0.12)" },
    dark: { accent: "#c084fc", accentFg: "#1e1035", highlight: "rgba(192, 132, 252, 0.15)" },
  },
  {
    id: "crimson",
    label: "Crimson",
    preview: "#e11d48",
    light: { accent: "#be123c", accentFg: "#ffffff", highlight: "rgba(225, 29, 72, 0.12)" },
    dark: { accent: "#fb7185", accentFg: "#250a12", highlight: "rgba(251, 113, 133, 0.15)" },
  },
  {
    id: "amber",
    label: "Amber",
    preview: "#d97706",
    light: { accent: "#b45309", accentFg: "#ffffff", highlight: "rgba(217, 119, 6, 0.14)" },
    dark: { accent: "#fbbf24", accentFg: "#261a05", highlight: "rgba(251, 191, 36, 0.16)" },
  },
  {
    id: "rose",
    label: "Rose",
    preview: "#db2777",
    light: { accent: "#be185d", accentFg: "#ffffff", highlight: "rgba(219, 39, 119, 0.12)" },
    dark: { accent: "#f472b6", accentFg: "#2b0a1a", highlight: "rgba(244, 114, 182, 0.15)" },
  },
  {
    id: "teal",
    label: "Teal",
    preview: "#0d9488",
    light: { accent: "#0f766e", accentFg: "#ffffff", highlight: "rgba(13, 148, 136, 0.12)" },
    dark: { accent: "#2dd4bf", accentFg: "#04201c", highlight: "rgba(45, 212, 191, 0.15)" },
  },
];

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
  /** Vibrant accent / main brand color */
  accentColor: AccentColorName;
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
  /** The faint paper grain over the whole page. */
  texture: boolean;
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
  accentColor: "default",
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
  texture: true,
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
  { id: "forest", label: "Forest", hint: "Sage & moss paper, calm and natural" },
  { id: "nordic", label: "Nordic", hint: "Crisp cool snow, clean and minimal" },
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
  const validAccents = new Set<AccentColorName>([
    "default",
    "emerald",
    "ocean",
    "violet",
    "crimson",
    "amber",
    "rose",
    "teal",
  ]);
  const accentColor: AccentColorName = validAccents.has(s.accentColor) ? s.accentColor : "default";

  return {
    ...s,
    accentColor,
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
  root.dataset.texture = s.texture === false ? "off" : "on";
  root.dataset.accent = s.accentColor || "default";

  const isDark = resolved === "slate" || resolved === "ink";
  if (s.accentColor && s.accentColor !== "default") {
    const custom = ACCENT_COLORS.find((c) => c.id === s.accentColor);
    if (custom) {
      const p = isDark ? custom.dark : custom.light;
      root.style.setProperty("--accent", p.accent);
      root.style.setProperty("--accent-fg", p.accentFg);
      root.style.setProperty("--highlight", p.highlight);
      root.style.setProperty("--color-accent", p.accent);
      root.style.setProperty("--color-accent-fg", p.accentFg);
    }
  } else {
    root.style.removeProperty("--accent");
    root.style.removeProperty("--accent-fg");
    root.style.removeProperty("--highlight");
    root.style.removeProperty("--color-accent");
    root.style.removeProperty("--color-accent-fg");
  }

  root.style.setProperty("--reading-size", `${s.fontSize}px`);
  root.style.setProperty("--reading-leading", String(s.lineHeight));
  root.style.setProperty("--reading-measure", `${s.measure}ch`);
  root.style.setProperty("--reading-tracking", `${s.tracking}em`);
  root.style.setProperty("--ui-zoom", String(s.zoom ?? 1));
  root.style.colorScheme =
    resolved === "paper" ||
    resolved === "sepia" ||
    resolved === "modern" ||
    resolved === "forest" ||
    resolved === "nordic"
      ? "light"
      : "dark";
}
