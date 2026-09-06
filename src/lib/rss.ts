import { XMLParser } from "fast-xml-parser";
import type { FeedItem, Source } from "./types";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  trimValues: true,
  // Some feeds wrap HTML in CDATA; keep it as text and strip tags ourselves.
  processEntities: {
    enabled: true,
    /**
     * The default cap of 1000 total expansions is a defence against the
     * billion-laughs attack, and a real newspaper feed walks straight through
     * it: fifty articles of German prose full of &nbsp; and &amp; reached 2286
     * in one Nachrichtenleicht fetch. The feed was then dropped whole and the
     * reader was told the publisher had not answered. Four sources were
     * failing this way.
     *
     * The count is the wrong lever anyway. What makes that attack dangerous is
     * nesting and the size of what comes out, so those stay tight: a bomb
     * needs depth and megabytes, while a newspaper needs neither.
     */
    maxTotalExpansions: 200_000,
    maxExpandedLength: 5_000_000,
    maxExpansionDepth: 20,
    maxEntitySize: 10_000,
  },
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

/**
 * Named character references worth knowing.
 *
 * The XML parser decodes a handful and leaves the rest, which for a German
 * reading app is not a detail: a headline arriving as "Warnstreik in den
 * Seeh&auml;fen" is wrong on the shelf, wrong when read aloud, and wrong when
 * the word under the reader's finger gets looked up. This covers the Latin-1
 * letters and the typographic marks that news prose actually uses; anything
 * rarer is a numeric reference, handled below.
 */
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  auml: "ä", ouml: "ö", uuml: "ü", Auml: "Ä", Ouml: "Ö", Uuml: "Ü", szlig: "ß",
  agrave: "à", aacute: "á", acirc: "â", atilde: "ã", aring: "å", aelig: "æ",
  Agrave: "À", Aacute: "Á", Acirc: "Â", Atilde: "Ã", Aring: "Å", AElig: "Æ",
  ccedil: "ç", Ccedil: "Ç",
  egrave: "è", eacute: "é", ecirc: "ê", euml: "ë",
  Egrave: "È", Eacute: "É", Ecirc: "Ê", Euml: "Ë",
  igrave: "ì", iacute: "í", icirc: "î", iuml: "ï",
  Igrave: "Ì", Iacute: "Í", Icirc: "Î", Iuml: "Ï",
  ntilde: "ñ", Ntilde: "Ñ",
  ograve: "ò", oacute: "ó", ocirc: "ô", otilde: "õ", oslash: "ø",
  Ograve: "Ò", Oacute: "Ó", Ocirc: "Ô", Otilde: "Õ", Oslash: "Ø",
  ugrave: "ù", uacute: "ú", ucirc: "û", Ugrave: "Ù", Uacute: "Ú", Ucirc: "Û",
  yacute: "ý", yuml: "ÿ", Yacute: "Ý",
  ndash: "\u2013", mdash: "\u2014", hellip: "…", minus: "\u2212", shy: "",
  lsquo: "\u2018", rsquo: "\u2019", sbquo: "\u201a",
  ldquo: "\u201c", rdquo: "\u201d", bdquo: "\u201e",
  laquo: "«", raquo: "»", lsaquo: "\u2039", rsaquo: "\u203a",
  bull: "•", middot: "·", dagger: "†", Dagger: "‡", permil: "‰",
  prime: "\u2032", Prime: "\u2033",
  euro: "€", pound: "£", yen: "¥", cent: "¢",
  copy: "©", reg: "®", trade: "™", sect: "§", para: "¶",
  deg: "°", plusmn: "±", times: "×", divide: "÷", micro: "µ",
  frac12: "½", frac14: "¼", frac34: "¾", sup2: "²", sup3: "³",
  ensp: " ", emsp: " ", thinsp: " ", nbsp_: " ",
};

/**
 * Turn character references back into the characters they stand for. Numeric
 * references are decoded arithmetically, which covers everything the table
 * above does not.
 */
export function decodeEntities(text: string): string {
  if (!text.includes("&")) return text;
  return text
    .replace(/&#x([0-9a-f]{1,6});/gi, (whole, hex: string) => {
      const code = Number.parseInt(hex, 16);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    })
    .replace(/&#(\d{1,7});/g, (whole, digits: string) => {
      const code = Number.parseInt(digits, 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    })
    .replace(/&([A-Za-z][A-Za-z0-9]{1,8});/g, (whole, name: string) =>
      // Case matters: &Auml; and &auml; are different letters.
      NAMED_ENTITIES[name] ?? NAMED_ENTITIES[name.toLowerCase()] ?? whole,
    );
}

export function stripHtml(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
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
