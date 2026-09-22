"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  applySettings,
  loadSettings,
  sanitize,
  type Settings,
} from "@/lib/settings";

const listeners = new Set<(s: Settings) => void>();
let current: Settings | null = null;

function broadcast(next: Settings) {
  current = next;
  applySettings(next);
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  } catch {
    // Private-mode browsers can refuse writes; the session still works.
  }
  listeners.forEach((fn) => fn(next));
}

// A reader who leaves a tab open across the "auto" theme's own boundary (say,
// reading through noon) should see it flip without touching a setting or
// reloading. applySettings only ever runs on mount or on a real settings
// change, so nothing else re-checks the clock - this does, on a shared
// interval rather than one per component that calls useSettings below.
// Re-applying is a DOM-only op (see applySettings), so this never needs to
// touch React state or the listener set.
if (typeof window !== "undefined") {
  setInterval(() => {
    if (current?.theme === "auto") applySettings(current);
  }, 5 * 60 * 1000);
}

/**
 * One shared settings object across the app. Server render always sees the
 * defaults, then the first client effect swaps in what is stored, which keeps
 * hydration honest while the inline theme script prevents a flash.
 */
export function useSettings(): [Settings, (patch: Partial<Settings>) => void, boolean] {
  const [settings, setSettings] = useState<Settings>(current ?? DEFAULT_SETTINGS);
  const [ready, setReady] = useState(current !== null);

  useEffect(() => {
    if (current === null) {
      current = loadSettings();
      applySettings(current);
    }
    setSettings(current);
    setReady(true);
    listeners.add(setSettings);
    return () => {
      listeners.delete(setSettings);
    };
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    const base = current ?? loadSettings();
    broadcast(sanitize({ ...base, ...patch }));
  }, []);

  return [settings, update, ready];
}
