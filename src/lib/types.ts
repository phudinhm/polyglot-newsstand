/** Languages we serve news in. */
export type SourceLang = "de" | "en" | "vi";

/** Languages a reader can translate into. */
export type TargetLang = "en" | "vi";

export type Category =
  | "top"
  | "world"
  | "politics"
  | "business"
  | "finance"
  | "markets"
  | "startups"
  | "careers"
  | "tech"
  | "science"
  | "health"
  | "environment"
  | "energy"
  | "culture"
  | "arts"
  | "media"
  | "education"
  | "law"
  | "society"
  | "lifestyle"
  | "travel"
  | "opinion"
  | "sport"
  | "learner";

/** Rough reading difficulty, used to steer learners to the right shelf. */
export type Level = "easy" | "medium" | "hard";

export interface Source {
  id: string;
  name: string;
  /** Short label for the chip row, e.g. "Tagesschau". */
  short?: string;
  lang: SourceLang;
  category: Category;
  level: Level;
  /** RSS, Atom or RDF feed URL. */
  feed: string;
  /** Publisher home page, shown as attribution. */
  site: string;
  /** True when the feed itself carries the full article body. */
  fullTextFeed?: boolean;
  /** One line on why a learner might pick this. */
  note?: string;
  /**
   * How much of the journalism you can actually read.
   * "soft" means some articles are metered; "hard" means most are locked.
   * Nothing is hidden for it, but the reader deserves to know in advance.
   */
  paywall?: "soft" | "hard";
}

export interface FeedItem {
  id: string;
  title: string;
  link: string;
  summary: string;
  image?: string;
  /** ISO 8601, or undefined when the feed omits a date. */
  publishedAt?: string;
  sourceId: string;
  sourceName: string;
  lang: SourceLang;
  category: Category;
  level: Level;
  /** Carried through so the shelf can filter and flag without a lookup. */
  paywall?: "soft" | "hard";
}

export interface FeedResponse {
  items: FeedItem[];
  /** Sources that failed, so the UI can be honest instead of silently short. */
  failed: { sourceId: string; name: string; reason: string }[];
  fetchedAt: string;
}

export interface ArticleBlock {
  /** Paragraph index, used for keyboard navigation and translation batching. */
  id: string;
  kind: "heading" | "paragraph" | "quote" | "list-item";
  /** The paragraph split into sentences: the unit the reader translates. */
  sentences: string[];
}

export interface Article {
  url: string;
  title: string;
  byline?: string;
  siteName?: string;
  publishedAt?: string;
  lang: SourceLang;
  leadImage?: string;
  blocks: ArticleBlock[];
  wordCount: number;
  readingMinutes: number;
  /** True when we could only recover the feed summary, not the full body. */
  partial: boolean;
}

export interface TranslateRequest {
  texts: string[];
  source: SourceLang;
  target: TargetLang;
}

export interface TranslateResponse {
  translations: string[];
  provider: string;
}

/** Where a word sits on the way from new to owned. */
export type VocabStatus = "learning" | "known";

export interface VocabEntry {
  id: string;
  term: string;
  /** Defaults to "learning"; the reader promotes it once it sticks. */
  status?: VocabStatus;
  translation: string;
  /** The sentence the word was met in, which is what makes it stick. */
  context?: string;
  contextTranslation?: string;
  lang: SourceLang;
  target: TargetLang;
  articleTitle?: string;
  articleUrl?: string;
  createdAt: string;
}

export interface SavedArticle {
  url: string;
  title: string;
  sourceName: string;
  lang: SourceLang;
  savedAt: string;
  image?: string;
}
