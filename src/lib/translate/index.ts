import { TtlCache } from "../cache";
import type { SourceLang, TargetLang } from "../types";
import { deepl, google, libre, mymemory, type Provider } from "./providers";

/**
 * Provider order is quality first, availability last. Whichever is configured
 * and answers first wins; a failure falls through to the next one so a missing
 * key or an exhausted quota degrades instead of breaking the page.
 */
const CHAIN: Provider[] = [deepl, google, libre, mymemory];

// Translations of a given sentence never change, so cache them generously.
const cache = new TtlCache<string>(24 * 60 * 60 * 1000, 4_000);

const keyFor = (text: string, source: string, target: string) => `${source}>${target}:${text}`;

export interface TranslateResult {
  translations: string[];
  provider: string;
  /** How many strings were answered from cache, useful when tuning quota. */
  cached: number;
}

export async function translate(
  texts: string[],
  source: SourceLang,
  target: TargetLang,
): Promise<TranslateResult> {
  const translations: string[] = new Array(texts.length).fill("");
  const pending: { index: number; text: string }[] = [];
  let cached = 0;

  texts.forEach((text, index) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (source === target) {
      translations[index] = trimmed;
      cached++;
      return;
    }
    const hit = cache.get(keyFor(trimmed, source, target));
    if (hit !== undefined) {
      translations[index] = hit;
      cached++;
    } else {
      pending.push({ index, text: trimmed });
    }
  });

  if (!pending.length) {
    return { translations, provider: "cache", cached };
  }

  const errors: string[] = [];
  for (const provider of CHAIN) {
    if (!provider.isConfigured()) continue;
    try {
      const out = await provider.translate(
        pending.map((p) => p.text),
        source,
        target,
      );
      pending.forEach((p, i) => {
        const value = out[i] ?? "";
        translations[p.index] = value;
        if (value) cache.set(keyFor(p.text, source, target), value);
      });
      return { translations, provider: provider.name, cached };
    } catch (err) {
      errors.push(`${provider.name}: ${err instanceof Error ? err.message : "failed"}`);
    }
  }

  throw new Error(
    errors.length
      ? `Every translation provider failed. ${errors.join(" | ")}`
      : "No translation provider is configured.",
  );
}

/** Which providers this deployment could actually use, for the settings panel. */
export function configuredProviders(): string[] {
  return CHAIN.filter((p) => p.isConfigured()).map((p) => p.name);
}
