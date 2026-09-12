"use client";

import { useEffect, useState } from "react";
import { useSettings } from "@/hooks/useSettings";
import { ACCENT_COLORS, FONTS, THEMES } from "@/lib/settings";
import { UI_LANGUAGES } from "@/lib/i18n";
import { useT } from "@/hooks/useT";
import { isAIVoice, onVoicesReady, regionOf, speak, speechSupported, voicesFor } from "@/lib/tts";
import type { SourceLang, TargetLang } from "@/lib/types";
import { CloseIcon, SpeakerIcon } from "./Icons";

interface Props {
  open: boolean;
  onClose: () => void;
}

const SAMPLE_DE = "Die Bundesregierung hat am Montag neue Maßnahmen vorgestellt.";
const SAMPLE_TRANSLATION: Record<TargetLang, string> = {
  en: "The federal government presented new measures on Monday.",
  de: "Die Bundesregierung hat am Montag neue Maßnahmen vorgestellt.",
  vi: "Chính phủ liên bang đã công bố các biện pháp mới vào thứ Hai.",
};

export function SettingsDrawer({ open, onClose }: Props) {
  const [settings, update] = useSettings();
  const t = useT();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (!open || !speechSupported()) return;
    return onVoicesReady(setVoices);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const voiceLangs: (SourceLang | TargetLang)[] = ["de", "en", "vi"];

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={t("settings.title")}>
      <div className="absolute inset-0 bg-black/35 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-2xl border-t border-border bg-surface pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-2xl sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[27rem] sm:max-h-none sm:rounded-none sm:rounded-l-2xl sm:border-l sm:border-t-0">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface px-5 py-4">
          <h2 className="text-base font-semibold">{t("settings.title")}</h2>
          <button type="button" onClick={onClose} className="btn px-2 py-1.5" aria-label={t("settings.close")}>
            <CloseIcon />
          </button>
        </div>

        <div className="space-y-7 px-5 py-5">
          {/* A live sample so every control shows its effect immediately. */}
          <div className="card overflow-hidden">
            <div className="reading !max-w-none px-4 py-3" lang="de">
              <p>{SAMPLE_DE}</p>
              <p className="translation mt-1">{SAMPLE_TRANSLATION[settings.target]}</p>
            </div>
          </div>

          <Section title={t("settings.interface")}>
            <div className="flex gap-1.5">
              {UI_LANGUAGES.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => update({ uiLang: option.id })}
                  data-selected={settings.uiLang === option.id}
                  className="chip flex-1 !justify-center !py-2"
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">
              Changes the buttons and labels only. What you read, and what it is translated into,
              stay where you set them.
            </p>
          </Section>

          <Section title={t("settings.background")}>
            <div className="grid grid-cols-2 gap-2">
              {THEMES.map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => update({ theme: theme.id })}
                  data-selected={settings.theme === theme.id}
                  className="chip !h-auto !justify-start !whitespace-normal !rounded-xl !px-3 !py-2.5 text-left"
                >
                  <span className="flex flex-col items-start gap-0.5">
                    <span className="text-sm font-medium">{theme.label}</span>
                    <span className="text-[11px] opacity-75">{theme.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          </Section>

          <Section title={t("settings.accentColor")}>
            <div className="grid grid-cols-4 gap-2">
              {ACCENT_COLORS.map((c) => {
                const isSelected = (settings.accentColor || "default") === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => update({ accentColor: c.id })}
                    data-selected={isSelected}
                    className={`chip !h-auto !flex-col !items-center !gap-1.5 !rounded-xl !p-2.5 text-center transition-all hover:scale-105 active:scale-95 ${
                      isSelected ? "!border-accent ring-2 ring-accent/20" : ""
                    }`}
                    title={c.label}
                  >
                    <span
                      className="relative h-6 w-6 rounded-full shadow-sm border border-black/15 flex items-center justify-center transition-transform"
                      style={{ backgroundColor: c.preview }}
                    >
                      {isSelected && (
                        <span className="h-2 w-2 rounded-full bg-white shadow-sm ring-1 ring-black/20" />
                      )}
                    </span>
                    <span className="text-[11px] font-medium leading-tight line-clamp-1">{c.label}</span>
                  </button>
                );
              })}
            </div>
          </Section>

          <Section title={t("settings.typeface")}>
            <div className="space-y-1.5">
              {FONTS.map((font) => (
                <button
                  key={font.id}
                  type="button"
                  onClick={() => update({ font: font.id })}
                  data-selected={settings.font === font.id}
                  className="chip !h-auto w-full !justify-between !whitespace-normal !rounded-xl !px-3 !py-2.5 text-left"
                >
                  <span className="flex flex-col items-start gap-0.5">
                    <span
                      className="text-[15px] font-medium"
                      style={{ fontFamily: `var(--font-${font.id})` }}
                    >
                      {font.label}
                    </span>
                    <span className="text-[11px] opacity-75">{font.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          </Section>

          <Slider
            label={t("settings.textSize")}
            value={settings.fontSize}
            min={15}
            max={28}
            step={1}
            display={`${settings.fontSize}px`}
            onChange={(fontSize) => update({ fontSize })}
          />
          <Slider
            label={t("settings.lineSpacing")}
            value={settings.lineHeight}
            min={1.3}
            max={2.4}
            step={0.05}
            display={settings.lineHeight.toFixed(2)}
            onChange={(lineHeight) => update({ lineHeight })}
          />
          <Slider
            label={t("settings.lineWidth")}
            value={settings.measure}
            min={42}
            max={92}
            step={2}
            display={`${settings.measure} characters`}
            onChange={(measure) => update({ measure })}
          />
          <Slider
            label={t("settings.letterSpacing")}
            value={settings.tracking}
            min={0}
            max={0.06}
            step={0.005}
            display={settings.tracking === 0 ? "Normal" : `+${settings.tracking.toFixed(3)}em`}
            onChange={(tracking) => update({ tracking })}
          />

          <Section title={t("settings.zoom")}>
            <div className="flex gap-1.5">
              {[0.9, 1, 1.1, 1.25].map((z) => (
                <button
                  key={z}
                  type="button"
                  onClick={() => update({ zoom: z })}
                  data-selected={Math.abs(settings.zoom - z) < 0.01}
                  className="chip flex-1 !justify-center !py-2"
                >
                  {Math.round(z * 100)}%
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">
              Scales the whole interface, not only the article. Useful when the buttons feel small
              rather than the text.
            </p>
          </Section>

          <Section title={t("settings.translateInto")}>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => update({ target: "en" })}
                data-selected={settings.target === "en"}
                className="chip flex-1 !justify-center !py-2"
              >
                English
              </button>
              <button
                type="button"
                onClick={() => update({ target: "de" })}
                data-selected={settings.target === "de"}
                className="chip flex-1 !justify-center !py-2"
              >
                Deutsch
              </button>
              <button
                type="button"
                onClick={() => update({ target: "vi" })}
                data-selected={settings.target === "vi"}
                className="chip flex-1 !justify-center !py-2"
              >
                Tiếng Việt
              </button>
            </div>
          </Section>

          <Section title={t("settings.readAloud")}>
            {speechSupported() ? (
              <>
                <Slider
                  label={t("settings.speakingRate")}
                  value={settings.speechRate}
                  min={0.5}
                  max={1.4}
                  step={0.05}
                  display={`${settings.speechRate.toFixed(2)}×`}
                  onChange={(speechRate) => update({ speechRate })}
                />
                <p className="mt-1 text-[12px] leading-relaxed text-muted">
                  {t("settings.voicesFrom")}
                </p>
                <div className="mt-2 space-y-2">
                  {voiceLangs.map((lang) => {
                    void voices;
                    const available = voicesFor(lang);
                    return (
                      <div key={lang} className="flex items-center gap-2">
                        <span className="w-10 shrink-0 text-[12px] uppercase text-muted">{lang}</span>
                        <select
                          value={settings.voices[lang] ?? ""}
                          onChange={(e) =>
                            update({ voices: { ...settings.voices, [lang]: e.target.value } })
                          }
                          className="input min-w-0 flex-1"
                          disabled={!available.length}
                        >
                          <option value="">
                            {available.length
                              ? `${t("settings.deviceDefault")} (${available.length})`
                              : t("settings.noVoice")}
                          </option>
                          {available.map((v) => (
                            <option key={v.voiceURI} value={v.voiceURI}>
                              {v.name} {isAIVoice(v) ? " [AI Voice]" : ""} · {regionOf(v)}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="btn !px-2"
                          disabled={!available.length}
                          onClick={() =>
                            speak(
                              lang === "de"
                                ? SAMPLE_DE
                                : lang === "vi"
                                  ? SAMPLE_TRANSLATION.vi
                                  : SAMPLE_TRANSLATION.en,
                              {
                                lang,
                                rate: settings.speechRate,
                                voiceUri: settings.voices[lang],
                              },
                            )
                          }
                          aria-label={`Try the ${lang} voice`}
                        >
                          <SpeakerIcon width={15} height={15} />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-muted">
                  Voices come from your device, so the choice differs between phone and laptop. On
                  Android and Windows you can install more in the system settings.
                </p>
              </>
            ) : (
              <p className="text-xs text-muted">
                This browser has no speech engine, so read-aloud is unavailable here.
              </p>
            )}
          </Section>

          <Section title={t("settings.layout")}>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => update({ layout: "lines" })}
                data-selected={settings.layout === "lines"}
                className="chip flex-1 !justify-center !py-2"
              >
                {t("settings.lineByLine")}
              </button>
              <button
                type="button"
                onClick={() => update({ layout: "flow" })}
                data-selected={settings.layout === "flow"}
                className="chip flex-1 !justify-center !py-2"
              >
                {t("settings.flowing")}
              </button>
            </div>
          </Section>

          <Section title={t("settings.whileReading")}>
            <Toggle
              label="Show all translations"
              hint="Bilingual mode: every sentence carries its translation from the start."
              checked={settings.bilingual}
              onChange={(bilingual) => update({ bilingual })}
            />
            <Toggle
              label="Vocabulary heatmap"
              hint="Underlines words you are learning in amber and words you have marked known in green, and dots the ones that are new to you."
              checked={settings.heatmap}
              onChange={(heatmap) => update({ heatmap })}
            />
            <Toggle
              label="Tap a word to look it up"
              hint="Opens a small card with the meaning and a one-tap save to your vocabulary."
              checked={settings.wordLookup}
              onChange={(wordLookup) => update({ wordLookup })}
            />
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">{title}</h3>
      {children}
    </section>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
}) {
  return (
    <section className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</label>
        <span className="text-xs tabular-nums text-muted">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--accent)]"
        aria-label={label}
      />
    </section>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 transition-colors hover:bg-surface-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted">{hint}</span>
      </span>
    </label>
  );
}
