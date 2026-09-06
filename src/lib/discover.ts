import { fetchText } from "./fetcher";
import { parseFeed, stripHtml } from "./rss";
import type { FeedItem, Source } from "./types";

/**
 * What to do when a publisher's feed stops answering.
 *
 * Feed URLs move constantly and a 403 or 406 is usually about headers rather
 * than intent, so before giving up we try three things in order: ask again
 * more politely, read the feed the publisher advertises on its own home page,
 * and finally read the home page itself. Only the last one is a guess, and it
 * is still a great deal better than an empty shelf.
 */

/** Publishers commonly reject a narrow Accept header with 406. */
export async function refetchPlainly(source: Source): Promise<FeedItem[]> {
  const xml = await fetchText(source.feed, { timeoutMs: 9_000, accept: "*/*" });
  return parseFeed(xml, source);
}

const FEED_LINK_RE =
  /<link[^>]+type=["']application\/(?:rss|atom)\+xml["'][^>]*>/gi;
const HREF_RE = /href=["']([^"']+)["']/i;

/** The feed the publisher itself points at, which is the one that still works. */
export async function discoverFeedUrl(site: string): Promise<string | null> {
  const html = await fetchText(site, {
    timeoutMs: 10_000,
    accept: "text/html,application/xhtml+xml,*/*;q=0.8",
  });
  for (const tag of html.match(FEED_LINK_RE) ?? []) {
    const href = HREF_RE.exec(tag)?.[1];
    if (!href) continue;
    try {
      const url = new URL(href, site).toString();
      // Comment feeds are noise; article feeds are what we want.
      if (/comment/i.test(url)) continue;
      return url;
    } catch {
      // Skip a malformed href.
    }
  }
  return null;
}

const ANCHOR_RE = /<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]{0,400}?)<\/a>/gi;

const NAV_WORDS =
  /^(home|startseite|menu|menü|search|suche|login|anmelden|abo|newsletter|kontakt|impressum|datenschutz|privacy|cookies|sitemap|more|mehr|weiter|alle|all|topics|themen|video|audio|podcast|live|shop|jobs|trang chủ|đăng nhập|tìm kiếm)$/i;

/**
 * Last resort: read the publisher's front page and take the links that look
 * like stories. Headlines are long, navigation is short, and articles live
 * deeper than the root of a site.
 */
export async function discoverFromHomepage(source: Source, limit = 30): Promise<FeedItem[]> {
  const html = await fetchText(source.site, {
    timeoutMs: 12_000,
    accept: "text/html,application/xhtml+xml,*/*;q=0.8",
  });

  const host = new URL(source.site).hostname.replace(/^www\./, "");
  const seen = new Set<string>();
  const items: FeedItem[] = [];

  for (const match of html.matchAll(ANCHOR_RE)) {
    const [, href, inner] = match;
    const title = stripHtml(inner);
    if (title.length < 25 || title.length > 220) continue;
    if (NAV_WORDS.test(title)) continue;

    let url: URL;
    try {
      url = new URL(href, source.site);
    } catch {
      continue;
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") continue;
    if (url.hostname.replace(/^www\./, "") !== host) continue;

    // An article lives below the root, and usually carries a slug or an id.
    const path = url.pathname.replace(/\/$/, "");
    const depth = path.split("/").filter(Boolean).length;
    if (depth < 2 && !/\d{4,}/.test(path)) continue;
    if (/\.(jpg|png|gif|svg|pdf|mp3|mp4)$/i.test(path)) continue;

    const key = url.origin + path;
    if (seen.has(key)) continue;
    seen.add(key);

    items.push({
      id: `${source.id}:${key}`,
      title,
      link: url.toString(),
      summary: "",
      publishedAt: undefined,
      sourceId: source.id,
      sourceName: source.short ?? source.name,
      lang: source.lang,
      category: source.category,
      level: source.level,
    });
    if (items.length >= limit) break;
  }

  return items;
}
