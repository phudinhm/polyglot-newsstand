"use client";

import { useMemo } from "react";
import { useSettings } from "./useSettings";
import { translator, type StringKey, type UiLang } from "@/lib/i18n";

/** The interface translator for whatever language the reader has chosen. */
export function useT(): (key: StringKey) => string {
  const [settings] = useSettings();
  return useMemo(() => translator(settings.uiLang), [settings.uiLang]);
}

/**
 * The same, plus the language itself, for the places that need to reach a
 * table keyed by language rather than a single string.
 */
export function useLang(): UiLang {
  const [settings] = useSettings();
  return settings.uiLang;
}
