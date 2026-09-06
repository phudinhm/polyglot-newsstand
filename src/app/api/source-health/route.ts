import { NextResponse } from "next/server";
import { assertSafeUrl } from "@/lib/fetcher";
import { loadFeedWithRecovery, RECOVERY_NOTE } from "@/lib/discover";
import { SOURCE_BY_ID, SOURCES } from "@/lib/sources";
import type { Source } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export interface SourceHealth {
  id: string;
  name: string;
  ok: boolean;
  items: number;
  ms: number;
  reason?: string;
  /** Set when the source only answered after a recovery step. */
  note?: string;
}

const CONCURRENCY = 8;

async function check(source: Source): Promise<SourceHealth> {
  const started = Date.now();
  const name = source.short ?? source.name;
  try {
    // The same chain the newsstand itself runs. Checking only the first step
    // reported sources as dead that the app opens every day through the
    // second, which made the whole report untrustworthy.
    const { items, via } = await loadFeedWithRecovery(source);
    return {
      id: source.id,
      name,
      ok: true,
      items: items.length,
      ms: Date.now() - started,
      note: RECOVERY_NOTE[via],
    };
  } catch (err) {
    return {
      id: source.id,
      name,
      ok: false,
      items: 0,
      ms: Date.now() - started,
      reason: err instanceof Error ? err.message : "Unavailable",
    };
  }
}

/**
 * Tells the reader which of their sources are actually alive.
 *
 * A publisher retiring a feed looks exactly like a thin newsstand, so this
 * turns "where did The Guardian go" into a specific, fixable answer.
 */
export async function POST(req: Request) {
  let payload: { sources?: unknown; custom?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const ids = Array.isArray(payload.sources)
    ? payload.sources.filter((s): s is string => typeof s === "string")
    : [];

  const curated = ids
    .map((id) => SOURCE_BY_ID.get(id))
    .filter((s): s is Source => Boolean(s));

  const custom: Source[] = Array.isArray(payload.custom)
    ? payload.custom
        .filter((c): c is { id: string; name: string; feed: string; lang: string } =>
          Boolean(c && typeof c === "object" && typeof (c as { feed?: unknown }).feed === "string"),
        )
        .filter((c) => {
          try {
            assertSafeUrl(c.feed);
            return true;
          } catch {
            return false;
          }
        })
        .map((c) => ({
          id: c.id,
          name: c.name,
          lang: c.lang === "de" ? "de" : c.lang === "vi" ? "vi" : "en",
          category: "world",
          level: "medium",
          feed: c.feed,
          site: new URL(c.feed).origin,
        }))
    : [];

  const all = [...curated, ...custom].slice(0, SOURCES.length + 12);
  const results: SourceHealth[] = [];
  for (let i = 0; i < all.length; i += CONCURRENCY) {
    results.push(...(await Promise.all(all.slice(i, i + CONCURRENCY).map(check))));
  }

  return NextResponse.json({
    results,
    healthy: results.filter((r) => r.ok).length,
    checkedAt: new Date().toISOString(),
  });
}
