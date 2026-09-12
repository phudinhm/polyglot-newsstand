import { NextResponse } from "next/server";
import { TtlCache } from "@/lib/cache";
import { assertSafeUrl } from "@/lib/fetcher";
import { loadFeedWithRecovery } from "@/lib/discover";
import { DEFAULT_SOURCE_IDS, SOURCE_BY_ID } from "@/lib/sources";
import type { FeedItem, FeedResponse, Source } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A cold cache means every source runs its full recovery chain - up to four
// sequential attempts, each with its own 9-12s timeout - before it counts as
// failed. Without this, the platform's shorter default cut the request off
// mid-flight, silently dropping every source that had not answered yet and
// leaving only whichever handful happened to be fastest.
export const maxDuration = 60;

// News moves, but not every second. Five minutes keeps the shelf fresh while
// staying a polite guest on the publishers' servers.
const FEED_TTL_MS = 5 * 60 * 1000;
const feedCache = new TtlCache<FeedItem[]>(FEED_TTL_MS, 300);

const MAX_SOURCES = 48;
const MAX_CUSTOM = 12;
// A handful of sources - Google News chief among them - answer many of this
// catalog's entries, so firing every fetch at once risks reading as a burst
// against that one host. Batching keeps that risk down without meaningfully
// slowing the request: the maxDuration above still leaves room to spare.
const CONCURRENCY = 8;

/**
 * A publisher that stops answering is the single most common way this app
 * disappoints, so a failed feed gets three more chances before it counts as
 * gone. See src/lib/discover.ts for why each step exists.
 */
async function loadSource(source: Source): Promise<FeedItem[]> {
  const cached = feedCache.get(source.feed);
  if (cached) return cached;

  const { items } = await loadFeedWithRecovery(source);
  feedCache.set(source.feed, items);
  return items;
}

/** Reader-supplied sources are untrusted input, so validate before fetching. */
function sanitizeCustom(raw: unknown): Source[] {
  if (!Array.isArray(raw)) return [];
  const out: Source[] = [];
  for (const entry of raw.slice(0, MAX_CUSTOM)) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    if (typeof e.feed !== "string" || typeof e.id !== "string") continue;
    try {
      assertSafeUrl(e.feed);
    } catch {
      continue;
    }
    out.push({
      id: e.id,
      name: typeof e.name === "string" ? e.name.slice(0, 80) : "Custom source",
      short: typeof e.name === "string" ? e.name.slice(0, 40) : "Custom",
      lang: e.lang === "de" ? "de" : e.lang === "vi" ? "vi" : "en",
      category: typeof e.category === "string" ? (e.category as Source["category"]) : "world",
      level: e.level === "easy" || e.level === "hard" ? e.level : "medium",
      feed: e.feed,
      site: new URL(e.feed).origin,
    });
  }
  return out;
}

async function build(ids: string[], custom: Source[]): Promise<FeedResponse> {
  const sources = [
    ...ids
      .map((id) => SOURCE_BY_ID.get(id))
      .filter((s): s is Source => Boolean(s)),
    ...custom,
  ].slice(0, MAX_SOURCES + MAX_CUSTOM);

  if (!sources.length) {
    return { items: [], failed: [], fetchedAt: new Date().toISOString() };
  }

  const settled: PromiseSettledResult<FeedItem[]>[] = [];
  for (let i = 0; i < sources.length; i += CONCURRENCY) {
    settled.push(...(await Promise.allSettled(sources.slice(i, i + CONCURRENCY).map(loadSource))));
  }

  const items: FeedItem[] = [];
  const failed: FeedResponse["failed"] = [];
  settled.forEach((result, i) => {
    const source = sources[i];
    if (result.status === "fulfilled") {
      items.push(...result.value.slice(0, 50));
    } else {
      failed.push({
        sourceId: source.id,
        name: source.short ?? source.name,
        reason: result.reason instanceof Error ? result.reason.message : "Unavailable",
      });
    }
  });

  // The same story syndicated twice should appear once.
  const seen = new Set<string>();
  const deduped = items.filter((item) => {
    const key = item.link.replace(/[?#].*$/, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  deduped.sort((a, b) => {
    const ta = a.publishedAt ? Date.parse(a.publishedAt) : 0;
    const tb = b.publishedAt ? Date.parse(b.publishedAt) : 0;
    return tb - ta;
  });

  return {
    items: deduped.slice(0, 800),
    failed,
    fetchedAt: new Date().toISOString(),
  };
}

export async function GET(req: Request) {
  const requested = new URL(req.url).searchParams.get("sources");
  const ids = requested
    ? requested.split(",").map((s) => s.trim()).filter(Boolean)
    : DEFAULT_SOURCE_IDS;
  const body = await build(ids.slice(0, MAX_SOURCES), []);
  return NextResponse.json(body, {
    headers: { "cache-control": "public, s-maxage=300, stale-while-revalidate=600" },
  });
}

/** POST carries the reader's own sources, which are too long for a query string. */
export async function POST(req: Request) {
  let payload: { sources?: unknown; custom?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const ids = Array.isArray(payload.sources)
    ? payload.sources.filter((s): s is string => typeof s === "string").slice(0, MAX_SOURCES)
    : DEFAULT_SOURCE_IDS;
  return NextResponse.json(await build(ids, sanitizeCustom(payload.custom)));
}
