"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SourceLang, TargetLang } from "@/lib/types";

const STORE_KEY = "pn:translations:v1";
const MAX_PERSISTED = 1_500;
const MAX_PER_REQUEST = 20;

type Cache = Record<string, string>;

function loadCache(): Cache {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORE_KEY) ?? "{}") as Cache;
  } catch {
    return {};
  }
}

function persist(cache: Cache) {
  try {
    const keys = Object.keys(cache);
    // Keep the most recent slice; translations are cheap to re-fetch.
    const trimmed =
      keys.length > MAX_PERSISTED
        ? Object.fromEntries(keys.slice(keys.length - MAX_PERSISTED).map((k) => [k, cache[k]]))
        : cache;
    window.localStorage.setItem(STORE_KEY, JSON.stringify(trimmed));
  } catch {
    // Quota errors are not worth interrupting a reading session for.
  }
}

/**
 * Translation state for one article.
 *
 * Results are keyed by the text itself, so a sentence that appears twice, or
 * that you revisit tomorrow, costs nothing the second time.
 */
export function useTranslator(source: SourceLang, target: TargetLang) {
  const cacheRef = useRef<Cache>({});
  const [, forceRender] = useState(0);
  const pendingRef = useRef<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);

  useEffect(() => {
    cacheRef.current = loadCache();
    forceRender((n) => n + 1);
  }, []);

  const keyFor = useCallback(
    (text: string) => `${source}>${target}|${text}`,
    [source, target],
  );

  const get = useCallback(
    (text: string): string | undefined => cacheRef.current[keyFor(text)],
    [keyFor],
  );

  const isPending = useCallback(
    (text: string): boolean => pendingRef.current.has(keyFor(text)),
    [keyFor],
  );

  const request = useCallback(
    async (texts: string[]): Promise<void> => {
      const wanted = Array.from(new Set(texts.map((t) => t.trim()).filter(Boolean))).filter(
        (t) => cacheRef.current[keyFor(t)] === undefined && !pendingRef.current.has(keyFor(t)),
      );
      if (!wanted.length) return;

      wanted.forEach((t) => pendingRef.current.add(keyFor(t)));
      forceRender((n) => n + 1);

      try {
        for (let i = 0; i < wanted.length; i += MAX_PER_REQUEST) {
          const batch = wanted.slice(i, i + MAX_PER_REQUEST);
          const res = await fetch("/api/translate", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ texts: batch, source, target }),
          });
          if (!res.ok) {
            const body = (await res.json().catch(() => ({}))) as { error?: string };
            throw new Error(body.error ?? `Translation failed (${res.status}).`);
          }
          const json = (await res.json()) as { translations: string[]; provider: string };
          batch.forEach((text, index) => {
            const value = json.translations[index];
            if (value) cacheRef.current[keyFor(text)] = value;
          });
          setProvider(json.provider);
        }
        setError(null);
        persist(cacheRef.current);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Translation failed.");
      } finally {
        wanted.forEach((t) => pendingRef.current.delete(keyFor(t)));
        forceRender((n) => n + 1);
      }
    },
    [keyFor, source, target],
  );

  return { get, isPending, request, error, provider, clearError: () => setError(null) };
}
