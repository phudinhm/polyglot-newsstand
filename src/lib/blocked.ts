/**
 * Papers that turned us away, remembered on the device.
 *
 * The catalogue's paywall flags are a guess made in advance, and they are
 * wrong often enough to matter: a publisher can start refusing requests
 * without announcing it, and the reader finds out by tapping a headline that
 * opens into an apology. This is the other half of the answer. When an article
 * genuinely will not open, the source is remembered here and the shelf stops
 * offering it, until the reader says otherwise.
 *
 * Kept on the device rather than on the server because it is a fact about this
 * reader's connection and country as much as about the publisher.
 */

import { SOURCE_BY_ID } from "./sources";

const KEY = "pn:blocked-sources:v1";

interface Blocked {
  /** How many times an article from this source refused to open. */
  count: number;
  /** ISO date of the most recent refusal, so a stale entry can be judged. */
  at: string;
}

type Store = Record<string, Blocked>;

function isPaywalledSource(sourceId: string): boolean {
  const source = SOURCE_BY_ID.get(sourceId);
  // Curated sources with no paywall (paywall === undefined) are free open sources.
  // Only sources explicitly marked with soft or hard paywalls can be treated as paywalled.
  if (source && source.paywall !== "hard" && source.paywall !== "soft") {
    return false;
  }
  return true;
}

function read(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

function write(store: Store): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // A full or locked storage is not worth failing a page render over.
  }
}

/** Record that an article from this source would not open. */
export function noteBlocked(sourceId: string): void {
  if (!sourceId) return;
  // Never auto-block verified open public sources (e.g. BR24, Tagesschau, SWR)
  if (!isPaywalledSource(sourceId)) return;

  const store = read();
  const existing = store[sourceId];
  store[sourceId] = { count: (existing?.count ?? 0) + 1, at: new Date().toISOString() };
  write(store);
}

/** Let a source back onto the shelf, and forget what it did. */
export function forgetBlocked(sourceId: string): void {
  const store = read();
  if (!(sourceId in store)) return;
  delete store[sourceId];
  write(store);
}

/**
 * One refusal is enough. A publisher that blocks does it consistently, and
 * making the reader hit the same wall twice to prove it is not a kindness.
 * Automatically cleans up any previously blocked open sources.
 */
export function blockedIds(): Set<string> {
  const store = read();
  const valid = new Set<string>();
  let modified = false;

  for (const id of Object.keys(store)) {
    if (!isPaywalledSource(id)) {
      // Purge false blockages of verified open sources from earlier sessions
      delete store[id];
      modified = true;
    } else {
      valid.add(id);
    }
  }

  if (modified) {
    write(store);
  }

  return valid;
}

export function isBlocked(sourceId: string): boolean {
  if (!isPaywalledSource(sourceId)) return false;
  return sourceId in read();
}

/** Reset all recorded device blockages. */
export function clearAllBlocked(): void {
  write({});
}

