import { XMLParser } from "fast-xml-parser";
import type { FeedItem, Source } from "./types";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  trimValues: true,
  // Some feeds wrap HTML in CDATA; keep it as text and strip tags ourselves.
  processEntities: true,
  htmlEntities: true,
});

type Loose = Record<string, unknown>;

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/** Feeds mix plain strings, CDATA objects and attribute maps in the same field. */
function text(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return text(value[0]);
  if (typeof value === "object") {
    const obj = value as Loose;
    if ("#text" in obj) return text(obj["#text"]);
    if ("@href" in obj) return text(obj["@href"]);
  }
  return "";
}

export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function firstImage(entry: Loose, html: string): string | undefined {
  const mediaContent = asArray(entry["media:content"] as Loose | Loose[]);
  for (const m of mediaContent) {
    const url = text(m?.["@url"]);
    if (url) return url;
  }
  const thumb = asArray(entry["media:thumbnail"] as Loose | Loose[]);
  for (const m of thumb) {
    const url = text(m?.["@url"]);
    if (url) return url;
  }
  const enclosures = asArray(entry.enclosure as Loose | Loose[]);
  for (const e of enclosures) {
    const type = text(e?.["@type"]);
    const url = text(e?.["@url"]);
    if (url && (!type || type.startsWith("image/"))) return url;
  }
  const inline = /<img[^>]+src=["']([^"']+)["']/i.exec(html);
  return inline?.[1];
}

function entryLink(entry: Loose): string {
  const raw = entry.link;
  if (typeof raw === "string") return raw;
  const links = asArray(raw as Loose | Loose[]);
  // Atom: prefer rel="alternate", fall back to the first href.
  const alternate = links.find((l) => text(l?.["@rel"]) === "alternate" || !l?.["@rel"]);
  const chosen = alternate ?? links[0];
  const href = text(chosen?.["@href"]) || text(chosen);
  if (href) return href;
  return text(entry.guid) || text(entry.id);
}

function entryDate(entry: Loose): string | undefined {
  const raw =
    text(entry.pubDate) ||
    text(entry.published) ||
    text(entry.updated) ||
    text(entry["dc:date"]) ||
    text(entry["dcterms:created"]);
  if (!raw) return undefined;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

/**
 * Parse RSS 2.0, Atom and RDF into one shape. Every real-world feed bends the
 * spec somewhere, so this reads defensively rather than strictly.
 */
export function parseFeed(xml: string, source: Source, limit = 40): FeedItem[] {
  const doc = parser.parse(xml) as Loose;

  const channel = (doc.rss as Loose | undefined)?.channel as Loose | undefined;
  const atom = doc.feed as Loose | undefined;
  const rdf = (doc["rdf:RDF"] ?? doc.RDF) as Loose | undefined;

  const rawEntries: Loose[] = channel
    ? asArray(channel.item as Loose | Loose[])
    : atom
      ? asArray(atom.entry as Loose | Loose[])
      : rdf
        ? asArray(rdf.item as Loose | Loose[])
        : [];

  const items: FeedItem[] = [];
  for (const entry of rawEntries.slice(0, limit)) {
    const title = stripHtml(text(entry.title));
    const link = entryLink(entry).trim();
    if (!title || !link) continue;

    const rawSummary =
      text(entry["content:encoded"]) ||
      text(entry.description) ||
      text(entry.summary) ||
      text(entry.content);
    const summary = stripHtml(rawSummary).slice(0, 400);

    items.push({
      id: `${source.id}:${text(entry.guid) || link}`,
      title,
      link,
      summary,
      image: firstImage(entry, rawSummary),
      publishedAt: entryDate(entry),
      sourceId: source.id,
      sourceName: source.short ?? source.name,
      lang: source.lang,
      category: source.category,
      level: source.level,
      paywall: source.paywall,
    });
  }
  return items;
}
