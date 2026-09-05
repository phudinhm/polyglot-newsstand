import { NextResponse } from "next/server";
import { TtlCache } from "@/lib/cache";
import { fetchText } from "@/lib/fetcher";
import { parseFeed } from "@/lib/rss";
import { DEFAULT_SOURCE_IDS, SOURCE_BY_ID } from "@/lib/sources";
import type { FeedItem, FeedResponse, Source } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// News moves, but not every second. Five minutes keeps the shelf fresh while
// staying a polite guest on the publishers' servers.
const FEED_TTL_MS = 5 * 60 * 1000;
const feedCache = new TtlCache<FeedItem[]>(FEED_TTL_MS, 200);

async function loadSource(source: Source): Promise<FeedItem[]> {
  const cached = feedCache.get(source.id);
  if (cached) return cached;
  const xml = await fetchText(source.feed, {
    timeoutMs: 9_000,
    accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
  });
  const items = parseFeed(xml, source);
  feedCache.set(source.id, items);
  return items;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const requested = url.searchParams.get("sources");
  const ids = requested
    ? requested.split(",").map((s) => s.trim()).filter(Boolean)
    : DEFAULT_SOURCE_IDS;

  const sources = ids
    .map((id) => SOURCE_BY_ID.get(id))
    .filter((s): s is Source => Boolean(s))
    // A generous ceiling: enough for a rich shelf, not enough to hammer anyone.
    .slice(0, 24);

  if (!sources.length) {
    return NextResponse.json(
      { items: [], failed: [], fetchedAt: new Date().toISOString() } satisfies FeedResponse,
      { status: 200 },
    );
  }

  const settled = await Promise.allSettled(sources.map(loadSource));

  const items: FeedItem[] = [];
  const failed: FeedResponse["failed"] = [];
  settled.forEach((result, i) => {
    const source = sources[i];
    if (result.status === "fulfilled") {
      items.push(...result.value);
    } else {
      failed.push({
        sourceId: source.id,
        name: source.short ?? source.name,
        reason: result.reason instanceof Error ? result.reason.message : "Unavailable",
      });
    }
  });

  // Same story syndicated twice should appear once.
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

  const body: FeedResponse = {
    items: deduped.slice(0, 200),
    failed,
    fetchedAt: new Date().toISOString(),
  };

  return NextResponse.json(body, {
    headers: { "cache-control": "public, s-maxage=300, stale-while-revalidate=600" },
  });
}
