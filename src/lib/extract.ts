import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import type { Article, ArticleBlock, SourceLang } from "./types";
import { countWords, splitSentences } from "./segment";
import { stripHtml } from "./rss";

const BLOCK_SELECTOR = "p, h2, h3, h4, blockquote, li";

/** Boilerplate that survives Readability on German news sites. */
const NOISE = [
  /^Diese Seite verwendet Cookies/i,
  /^Mehr zum Thema/i,
  /^Weitere Informationen/i,
  /^Bild:|^Foto:|^Quelle:|^Image caption|^Image source/i,
  /^Anzeige$/i,
  /^Werbung$/i,
  /^Advertisement$/i,
  /^Sign up (to|for)/i,
  /^Follow us on/i,
  /^Teilen$|^Share$|^Drucken$/i,
  /^Stand: /i,
];

function isNoise(text: string): boolean {
  if (text.length < 3) return true;
  return NOISE.some((re) => re.test(text));
}

function tagToKind(tag: string): ArticleBlock["kind"] {
  switch (tag) {
    case "H2":
    case "H3":
    case "H4":
      return "heading";
    case "BLOCKQUOTE":
      return "quote";
    case "LI":
      return "list-item";
    default:
      return "paragraph";
  }
}

function detectLang(html: string, fallback: SourceLang): SourceLang {
  const match = /<html[^>]+lang=["']?([a-zA-Z-]{2,5})/i.exec(html);
  const lang = match?.[1]?.slice(0, 2).toLowerCase();
  if (lang === "de") return "de";
  if (lang === "en") return "en";
  return fallback;
}

function leadImage(html: string, base: string): string | undefined {
  const og = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i.exec(html);
  const raw = og?.[1];
  if (!raw) return undefined;
  try {
    return new URL(raw, base).toString();
  } catch {
    return undefined;
  }
}

/**
 * Turn a news page into ordered blocks of sentences.
 *
 * Readability gives us the article body without the navigation, cookie walls
 * and "read more" rails; we then re-walk that clean DOM so we keep paragraph
 * boundaries instead of flattening everything into one string.
 */
export function extractArticle(
  html: string,
  url: string,
  fallbackLang: SourceLang,
): Article {
  const lang = detectLang(html, fallbackLang);
  const { document } = parseHTML(html);
  const reader = new Readability(document as unknown as Document, {
    charThreshold: 200,
    keepClasses: false,
  });
  const parsed = reader.parse();

  const blocks: ArticleBlock[] = [];
  let wordCount = 0;

  if (parsed?.content) {
    const { document: contentDoc } = parseHTML(`<body>${parsed.content}</body>`);
    const nodes = Array.from(contentDoc.querySelectorAll(BLOCK_SELECTOR));
    let index = 0;
    for (const node of nodes) {
      // Skip a paragraph that only wraps another block we already captured.
      if (node.querySelector?.(BLOCK_SELECTOR)) continue;
      const text = stripHtml(node.textContent ?? "");
      if (!text || isNoise(text)) continue;
      const sentences = splitSentences(text, lang);
      if (!sentences.length) continue;
      wordCount += countWords(text);
      blocks.push({
        id: `b${index++}`,
        kind: tagToKind(node.tagName?.toUpperCase?.() ?? "P"),
        sentences,
      });
    }
  }

  const title = stripHtml(parsed?.title ?? "") || stripHtml(/<title>([^<]*)<\/title>/i.exec(html)?.[1] ?? "");

  return {
    url,
    title: title || "Untitled",
    byline: parsed?.byline ? stripHtml(parsed.byline) : undefined,
    siteName: parsed?.siteName ? stripHtml(parsed.siteName) : undefined,
    publishedAt: parsed?.publishedTime ?? undefined,
    lang,
    leadImage: leadImage(html, url),
    blocks,
    wordCount,
    // 200 wpm is a fair native pace; a learner will happily take twice that.
    readingMinutes: Math.max(1, Math.round(wordCount / 200)),
    partial: blocks.length < 2,
  };
}

/** Last resort when a publisher blocks us: read the feed summary instead. */
export function articleFromSummary(
  url: string,
  title: string,
  summary: string,
  lang: SourceLang,
): Article {
  const sentences = splitSentences(summary, lang);
  return {
    url,
    title,
    lang,
    blocks: sentences.length ? [{ id: "b0", kind: "paragraph", sentences }] : [],
    wordCount: countWords(summary),
    readingMinutes: 1,
    partial: true,
  };
}
