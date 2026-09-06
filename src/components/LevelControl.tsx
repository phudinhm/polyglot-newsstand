"use client";

import { useEffect, useState } from "react";
import { splitSentences } from "@/lib/segment";
import type { Article, SourceLang } from "@/lib/types";
import { SparkIcon, SpinnerIcon } from "./Icons";

const LEVELS = ["A2", "B1", "B2"] as const;
type Level = (typeof LEVELS)[number];

/**
 * Read the same article at a lower level.
 *
 * The rewrite keeps every fact, number, name and quote and changes only the
 * language around them. It is a paid model call, so it is offered rather than
 * applied, cached on the server, and hidden entirely when no key is set.
 */
export function LevelControl({
  article,
  lang,
  levelled,
  onLevelled,
}: {
  article: Article;
  lang: SourceLang;
  levelled: Article | null;
  onLevelled: (article: Article | null) => void;
}) {
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState<Level | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<Level | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/simplify")
      .then((r) => r.json())
      .then((json: { available?: boolean }) => {
        if (!cancelled) setAvailable(Boolean(json.available));
      })
      .catch(() => {
        if (!cancelled) setAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // A new article invalidates any rewrite of the last one.
  useEffect(() => {
    setActive(null);
    setError(null);
  }, [article.url]);

  if (!available || article.partial) return null;

  async function level(target: Level) {
    if (busy) return;
    setBusy(target);
    setError(null);
    try {
      const paragraphs = article.blocks
        .filter((b) => b.kind !== "heading")
        .map((b) => b.sentences.join(" "));

      const res = await fetch("/api/simplify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paragraphs, lang, level: target, title: article.title }),
      });
      const json = (await res.json()) as { paragraphs?: string[]; error?: string };
      if (!res.ok || !json.paragraphs) throw new Error(json.error ?? "The rewrite failed.");

      // Rebuild the article shape so every reading feature keeps working:
      // headings stay as they were, paragraphs are re-split into sentences.
      let index = 0;
      const blocks = article.blocks.map((block) => {
        if (block.kind === "heading") return block;
        const rewritten = json.paragraphs?.[index++];
        return rewritten
          ? { ...block, sentences: splitSentences(rewritten, lang) }
          : block;
      });

      setActive(target);
      onLevelled({ ...article, blocks });
    } catch (err) {
      setError(err instanceof Error ? err.message : "The rewrite failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="reading mt-5 rounded-xl border border-border bg-surface-2 px-3.5 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-muted">
          <SparkIcon width={14} height={14} /> Reading level
        </span>

        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => {
              setActive(null);
              onLevelled(null);
            }}
            data-selected={!levelled}
            className="chip !py-1"
          >
            Original
          </button>
          {LEVELS.map((target) => (
            <button
              key={target}
              type="button"
              onClick={() => void level(target)}
              disabled={Boolean(busy)}
              data-selected={active === target && Boolean(levelled)}
              className="chip !py-1 disabled:opacity-50"
            >
              {busy === target ? <SpinnerIcon width={13} height={13} /> : null}
              {target}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-2 text-[12px] leading-relaxed text-muted">
        {error ? (
          <span className="text-accent">{error}</span>
        ) : levelled ? (
          "Rewritten by Claude at a lower level. Facts, numbers, names and quotes are unchanged, but this is no longer the publication's own wording."
        ) : (
          "Rewrite this article in simpler language at A2, B1 or B2, keeping every fact as it is."
        )}
      </p>
    </div>
  );
}
