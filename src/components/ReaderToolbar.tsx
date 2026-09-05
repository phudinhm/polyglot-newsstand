"use client";

import { useSettings } from "@/hooks/useSettings";
import type { ThemeName } from "@/lib/settings";

const THEME_CYCLE: ThemeName[] = ["paper", "sepia", "slate", "ink"];
const THEME_LABEL: Record<ThemeName, string> = {
  paper: "Paper",
  sepia: "Sepia",
  slate: "Slate",
  ink: "Ink",
};

/**
 * The three adjustments a reader actually reaches for mid-article, put where a
 * thumb already is. Everything else stays in the settings drawer.
 */
export function ReaderToolbar() {
  const [settings, update] = useSettings();

  const current: ThemeName = settings.theme === "system" ? "paper" : settings.theme;
  const nextTheme = THEME_CYCLE[(THEME_CYCLE.indexOf(current) + 1) % THEME_CYCLE.length];

  return (
    <div className="fixed inset-x-0 bottom-4 z-30 flex justify-center px-4 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:justify-end">
      <div className="glass-strong flex items-center gap-1 rounded-full border border-border p-1 shadow-[var(--shadow)]">
        <button
          type="button"
          onClick={() => update({ fontSize: settings.fontSize - 1 })}
          disabled={settings.fontSize <= 15}
          className="grid h-9 w-9 place-items-center rounded-full text-[13px] font-semibold leading-none transition-colors hover:bg-surface-2 disabled:opacity-40"
          aria-label="Smaller text"
        >
          A−
        </button>
        <span className="min-w-[2.4rem] text-center text-[11px] tabular-nums text-muted">
          {settings.fontSize}px
        </span>
        <button
          type="button"
          onClick={() => update({ fontSize: settings.fontSize + 1 })}
          disabled={settings.fontSize >= 28}
          className="grid h-9 w-9 place-items-center rounded-full text-[16px] font-semibold leading-none transition-colors hover:bg-surface-2 disabled:opacity-40"
          aria-label="Larger text"
        >
          A+
        </button>
        <span className="mx-0.5 h-5 w-px bg-border" aria-hidden />
        <button
          type="button"
          onClick={() => update({ theme: nextTheme })}
          className="rounded-full px-3 py-2 text-xs font-medium transition-colors hover:bg-surface-2"
          aria-label={`Switch background to ${THEME_LABEL[nextTheme]}`}
        >
          {THEME_LABEL[nextTheme]}
        </button>
      </div>
    </div>
  );
}
