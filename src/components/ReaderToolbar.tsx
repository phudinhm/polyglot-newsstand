"use client";

import { useEffect, useRef, useState } from "react";
import { useSettings } from "@/hooks/useSettings";
import { useT } from "@/hooks/useT";
import type { ThemeName } from "@/lib/settings";
import { onVoicesReady, regionOf, speak, speechSupported, voicesFor } from "@/lib/tts";
import type { SourceLang } from "@/lib/types";
import { SpeakerIcon } from "./Icons";

const THEME_CYCLE: ThemeName[] = ["paper", "sepia", "modern", "slate", "ink"];
const THEME_LABEL: Record<ThemeName, string> = {
  paper: "Paper",
  sepia: "Sepia",
  modern: "Modern",
  slate: "Slate",
  ink: "Ink",
};

/**
 * The adjustments a reader reaches for mid-article, put where a thumb already
 * is: text size, background, and the voice reading to them. Everything else
 * stays in the settings drawer.
 */
export function ReaderToolbar({
  dimmed = false,
  lang = "de",
}: {
  dimmed?: boolean;
  lang?: SourceLang;
}) {
  const [settings, update] = useSettings();
  const t = useT();
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!voiceOpen || !speechSupported()) return;
    return onVoicesReady(setVoices);
  }, [voiceOpen]);

  useEffect(() => {
    if (!voiceOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setVoiceOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [voiceOpen]);

  const current: ThemeName = settings.theme === "system" ? "paper" : settings.theme;
  const nextTheme = THEME_CYCLE[(THEME_CYCLE.indexOf(current) + 1) % THEME_CYCLE.length];
  // voices state exists only to re-render when the engine warms up.
  void voices;
  const forLang = voicesFor(lang);

  return (
    <div
      className={`fixed inset-x-0 bottom-4 z-30 flex justify-center px-4 transition-opacity duration-300 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:justify-end ${
        dimmed && !voiceOpen ? "opacity-25 hover:opacity-100 focus-within:opacity-100" : "opacity-100"
      }`}
    >
      <div className="relative" ref={panelRef}>
        {voiceOpen && (
          <div className="glass-strong absolute bottom-full right-0 mb-2 w-72 rounded-xl border border-border p-3 shadow-[var(--shadow)]">
            <div className="flex items-baseline justify-between">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                {t("settings.speakingRate")}
              </label>
              <span className="text-[11px] tabular-nums text-muted">
                {settings.speechRate.toFixed(2)}×
              </span>
            </div>
            <div className="mt-1 flex gap-1.5">
              {[0.75, 1, 1.25].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => update({ speechRate: rate })}
                  data-selected={Math.abs(settings.speechRate - rate) < 0.03}
                  className="chip flex-1 !justify-center !py-1"
                >
                  {rate}×
                </button>
              ))}
            </div>
            <input
              type="range"
              min={0.5}
              max={1.4}
              step={0.05}
              value={settings.speechRate}
              onChange={(e) => update({ speechRate: Number(e.target.value) })}
              className="mt-2 w-full accent-[var(--accent)]"
              aria-label={t("settings.speakingRate")}
            />

            <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wider text-muted">
              Voice ({lang})
            </label>
            <select
              value={settings.voices[lang] ?? ""}
              onChange={(e) => update({ voices: { ...settings.voices, [lang]: e.target.value } })}
              className="input mt-1 w-full"
              disabled={!forLang.length}
            >
              <option value="">
                {forLang.length
                  ? `${t("settings.deviceDefault")} (${forLang.length})`
                  : t("settings.noVoice")}
              </option>
              {forLang.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} · {regionOf(v)}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() =>
                speak(
                  lang === "de"
                    ? "Die Strompreise sind gesunken."
                    : lang === "vi"
                      ? "Giá điện đã giảm."
                      : "Electricity prices have fallen.",
                  { lang, rate: settings.speechRate, voiceUri: settings.voices[lang] },
                )
              }
              disabled={!forLang.length}
              className="btn mt-2 w-full justify-center !py-1.5 text-xs"
            >
              <SpeakerIcon width={14} height={14} /> {t("settings.tryVoice")}
            </button>
            <p className="mt-2 text-[11px] leading-relaxed text-muted">
              Voices come from your device. Android and Windows let you install more in the system
              settings, which is the fastest way to a better one.
            </p>
          </div>
        )}

        <div className="glass-strong flex items-center gap-1 rounded-full border border-border p-1 shadow-[var(--shadow)]">
          <button
            type="button"
            onClick={() => update({ fontSize: settings.fontSize - 1 })}
            disabled={settings.fontSize <= 15}
            className="grid h-9 w-9 place-items-center rounded-full text-[13px] font-semibold leading-none transition-colors hover:bg-surface-2 disabled:opacity-40"
            aria-label={t("reader.smaller")}
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
            aria-label={t("reader.larger")}
          >
            A+
          </button>

          {speechSupported() && (
            <>
              <span className="mx-0.5 h-5 w-px bg-border" aria-hidden />
              <button
                type="button"
                onClick={() => setVoiceOpen((v) => !v)}
                aria-expanded={voiceOpen}
                aria-label={t("reader.voice")}
                className={`grid h-9 w-9 place-items-center rounded-full transition-colors hover:bg-surface-2 ${
                  voiceOpen ? "bg-surface-2" : ""
                }`}
              >
                <SpeakerIcon width={16} height={16} />
              </button>
            </>
          )}

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
    </div>
  );
}
