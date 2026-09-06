import { SOURCES, SOURCE_BY_ID } from "./sources";
import type { Category, Source, SourceLang } from "./types";

export interface Suggestion {
  source: Source;
  /** Shown to the reader, so a recommendation never looks arbitrary. */
  why: string;
}

/**
 * What to read next.
 *
 * The shelf a reader has built already says what they care about, so the
 * suggestions lean into it, then deliberately correct two imbalances: a
 * learner with nothing easy to read, and a shelf that has drifted into one
 * language when the whole point is reading both.
 */
export function suggestSources(shelf: string[], limit = 6): Suggestion[] {
  const onShelf = new Set(shelf);
  const current = shelf
    .map((id) => SOURCE_BY_ID.get(id))
    .filter((s): s is Source => Boolean(s));

  const byCategory = new Map<Category, number>();
  const byLang = new Map<SourceLang, number>();
  for (const source of current) {
    byCategory.set(source.category, (byCategory.get(source.category) ?? 0) + 1);
    byLang.set(source.lang, (byLang.get(source.lang) ?? 0) + 1);
  }

  const topCategories = [...byCategory.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([category]) => category);

  // Reading two languages is the point, so a shelf that has drifted into one
  // gets nudged back. Vietnamese only counts once the reader has added some.
  const counts: [SourceLang, number][] = [
    ["de", byLang.get("de") ?? 0],
    ["en", byLang.get("en") ?? 0],
  ];
  const [thinnest, thinnestCount] = counts.sort((a, b) => a[1] - b[1])[0];
  const fattest = counts[counts.length - 1][1];
  const thinLanguage: SourceLang | null =
    thinnestCount === 0 || thinnestCount * 3 < fattest ? thinnest : null;
  const hasEasy = current.some((s) => s.level === "easy");

  const scored = SOURCES.filter((s) => !onShelf.has(s.id)).map((source) => {
    let score = 0;
    const reasons: string[] = [];

    if (!hasEasy && source.level === "easy") {
      score += 6;
      reasons.push("nothing on your shelf is written for learners yet");
    }
    if (thinLanguage && source.lang === thinLanguage) {
      score += 4;
      reasons.push(
        thinLanguage === "de"
          ? "your shelf is light on German"
          : "your shelf is light on English",
      );
    }
    if (topCategories.includes(source.category)) {
      score += 3;
      reasons.push(`you already read ${labelFor(source.category)}`);
    }
    // A publication with a note is one worth explaining, so worth suggesting.
    if (source.note) score += 1;
    // Nudge towards the middle of the difficulty range for everyday reading.
    if (source.level === "medium") score += 1;

    return {
      source,
      score,
      why: reasons[0] ? capitalise(reasons[0]) : (source.note ?? "Worth a look"),
    };
  });

  return scored
    .sort((a, b) => b.score - a.score || a.source.name.localeCompare(b.source.name))
    .slice(0, limit)
    .map(({ source, why }) => ({ source, why }));
}

function labelFor(category: Category): string {
  const labels: Record<Category, string> = {
    top: "front-page news",
    world: "world news",
    politics: "politics",
    business: "business",
    finance: "finance",
    markets: "markets",
    startups: "startups",
    careers: "work and careers",
    tech: "technology",
    science: "science",
    health: "health",
    environment: "climate",
    energy: "energy",
    culture: "culture",
    arts: "film, books and music",
    media: "media",
    education: "education",
    law: "law",
    society: "society",
    lifestyle: "everyday life",
    travel: "travel",
    opinion: "opinion",
    sport: "sport",
    learner: "learner material",
  };
  return labels[category];
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
