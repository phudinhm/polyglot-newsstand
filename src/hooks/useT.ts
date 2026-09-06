"use client";

import { useMemo } from "react";
import { useSettings } from "./useSettings";
import { translator, type StringKey } from "@/lib/i18n";

/** The interface translator for whatever language the reader has chosen. */
export function useT(): (key: StringKey) => string {
  const [settings] = useSettings();
  return useMemo(() => translator(settings.uiLang), [settings.uiLang]);
}
