"use client";

import type { SavedArticle, SourceLang, TargetLang, VocabEntry } from "./types";

const VOCAB_KEY = "pn:vocab:v1";
const SAVED_KEY = "pn:saved:v1";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent("pn:store", { detail: key }));
  } catch {
    // A full or blocked localStorage should never break reading.
  }
}

// ------------------------------------------------------------------ vocabulary

export function getVocab(): VocabEntry[] {
  return read<VocabEntry[]>(VOCAB_KEY, []);
}

export function addVocab(entry: Omit<VocabEntry, "id" | "createdAt">): VocabEntry {
  const list = getVocab();
  const normalized = entry.term.trim().toLowerCase();
  // Meeting the same word twice is normal; keep the first note and move on.
  const existing = list.find(
    (v) => v.term.trim().toLowerCase() === normalized && v.lang === entry.lang,
  );
  if (existing) return existing;

  const created: VocabEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
  write(VOCAB_KEY, [created, ...list].slice(0, 5_000));
  return created;
}

export function removeVocab(id: string): void {
  write(
    VOCAB_KEY,
    getVocab().filter((v) => v.id !== id),
  );
}

export function clearVocab(): void {
  write(VOCAB_KEY, []);
}

export function hasVocab(term: string, lang: SourceLang): boolean {
  const normalized = term.trim().toLowerCase();
  return getVocab().some((v) => v.term.trim().toLowerCase() === normalized && v.lang === lang);
}

/** Anki and Quizlet both import this shape without any configuration. */
export function vocabToCsv(entries: VocabEntry[]): string {
  const escape = (value: string) => `"${(value ?? "").replace(/"/g, '""')}"`;
  const rows = entries.map((v) =>
    [v.term, v.translation, v.context ?? "", v.contextTranslation ?? "", v.lang, v.target, v.articleTitle ?? "", v.articleUrl ?? "", v.createdAt]
      .map(escape)
      .join(","),
  );
  return [
    "term,translation,context,context_translation,language,target,article,url,added_at",
    ...rows,
  ].join("\n");
}

// -------------------------------------------------------------- read it later

export function getSaved(): SavedArticle[] {
  return read<SavedArticle[]>(SAVED_KEY, []);
}

export function isSaved(url: string): boolean {
  return getSaved().some((a) => a.url === url);
}

export function toggleSaved(article: SavedArticle): boolean {
  const list = getSaved();
  const existing = list.find((a) => a.url === article.url);
  if (existing) {
    write(
      SAVED_KEY,
      list.filter((a) => a.url !== article.url),
    );
    return false;
  }
  write(SAVED_KEY, [{ ...article, savedAt: new Date().toISOString() }, ...list].slice(0, 500));
  return true;
}

export type { SavedArticle, TargetLang, VocabEntry };
