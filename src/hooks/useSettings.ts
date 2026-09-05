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
