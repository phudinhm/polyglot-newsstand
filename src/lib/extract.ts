import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import type { Article, ArticleBlock, SourceLang } from "./types";
import { countWords, splitSentences } from "./segment";
import { stripHtml } from "./rss";

const BLOCK_SELECTOR = "p, h2, h3, h4, blockquote, li";

/** Boilerplate that survives Readability on German and English news sites. */
const NOISE = [
  /^Diese Seite verwendet Cookies/i,
  /^Mehr zum Thema/i,
  /^Weitere Informationen/i,
  /^Bild:|^Bildrechte:|^Foto:|^Quelle:|^Image caption|^Image source/i,
  /^Anzeige$/i,
  /^Werbung$/i,
  /^Advertisement$/i,
  /^Sign up (to|for)/i,
  /^Follow us on/i,
  /^Teilen$|^Share$|^Drucken$|^Merken$/i,
  /^Stand: /i,
  /^Zur (Startseite|Übersicht)/i,
  /^Alle Themen/i,
  /^Dieser Artikel/i,
  /^Über dieses Thema berichtet/i,
  /^Diesen Beitrag (teilen|speichern)/i,
  /^Sendung:/i,
  /^Lesen Sie (auch|mehr)/i,
  /^Read (more|next)/i,
  /^Related( stories| articles)?:?$/i,
  /^Copyright|^© /i,
  /^Alle Rechte vorbehalten/i,
];

/**
 * Player and navigation labels that publishers ship as visually hidden text
 * for screen readers. Readability keeps them, and because they carry no
 * spacing they arrive glued together, like
 *
 *   BenachrichtigungPfeil nach linksMerklisteAbspielenPause
 *
 * Nothing here is ever part of an article body.
 */
const UI_LABELS = [
  "Benachrichtigung", "Pfeil nach links", "Pfeil nach rechts", "Merkliste",
  "Aufklappen", "Zuklappen", "Abspielen", "Pause", "Wiederholen", "Stummschalten",
  "Lautstärke", "Vollbild", "Untertitel", "Vorheriges", "Nächstes", "Schließen",
  "Menü öffnen", "Suche öffnen", "Zum Inhalt springen", "Video starten",
  "Left arrow", "Right arrow", "Watch list", "Expand", "Collapse", "Play",
  "Repeat", "Mute", "Unmute", "Fullscreen", "Subtitles", "Previous", "Next",
  "Close", "Skip to content", "Share on", "Open menu",
];

const UI_LABEL_RE = new RegExp(
  `(${UI_LABELS.map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
  "gi",
);

/**
 * A run of glued interface labels, detected by shape rather than by wordlist:
 * real prose puts a space after a lowercase letter, never a capital.
 */
function isGluedLabelRun(text: string): boolean {
  const camelJoins = (text.match(/[\p{Ll}\p{M}][\p{Lu}]/gu) ?? []).length;
  if (camelJoins < 3) return false;
  const spaced = text.split(/\s+/).length;
  // More glued joins than spaces means the text is mostly concatenated labels.
  return camelJoins >= spaced - 1;
}

function isNoise(text: string): boolean {
  if (text.length < 3) return true;
  if (NOISE.some((re) => re.test(text))) return true;
  if (isGluedLabelRun(text)) return true;

  // A block that is mostly known interface labels is chrome, not content.
  const labelChars = (text.match(UI_LABEL_RE) ?? []).join("").length;
  if (labelChars > 0 && labelChars / text.length > 0.4) return true;

  // Prose has sentence punctuation. A long block without any is a nav list.
  if (text.length > 60 && !/[.!?…:;,]/.test(text)) return true;

  return false;
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
  // The publisher we chose this source under is a far more reliable signal
  // than the fetched page's own <html lang> - plenty of sites carry a CMS
  // default (often "en") on every page regardless of what the article is
  // actually written in, which misdirected the voice, the translation and
  // the sentence splitting alike.
  const lang = fallbackLang;
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

  // Fallback if Readability fails or scored below threshold:
  if (!blocks.length) {
    const fallbackNodes = Array.from(
      document.querySelectorAll("article p, main p, [itemprop='articleBody'] p, .story-body p, .article-content p, .entry-content p, p"),
    );
    let index = 0;
    for (const node of fallbackNodes) {
      const text = stripHtml(node.textContent ?? "");
      if (!text || text.length < 30 || isNoise(text)) continue;
      const sentences = splitSentences(text, lang);
      if (!sentences.length) continue;
      wordCount += countWords(text);
      blocks.push({
        id: `b${index++}`,
        kind: "paragraph",
        sentences,
      });
      if (blocks.length >= 60) break;
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
