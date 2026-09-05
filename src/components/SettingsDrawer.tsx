"use client";

import { useEffect } from "react";
import { useSettings } from "@/hooks/useSettings";
import { THEMES } from "@/lib/settings";
import { CloseIcon } from "./Icons";

interface Props {
  open: boolean;
  onClose: () => void;
}

const SAMPLE_DE = "Die Bundesregierung hat am Montag neue Maßnahmen vorgestellt.";
const SAMPLE_TRANSLATION = {
  en: "The federal government presented new measures on Monday.",
  vi: "Chính phủ liên bang đã công bố các biện pháp mới vào thứ Hai.",
};

export function SettingsDrawer({ open, onClose }: Props) {
  const [settings, update] = useSettings();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Reading settings">
      <div
        className="absolute inset-0 bg-black/35 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-2xl border-t border-border bg-surface pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-2xl sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[26rem] sm:max-h-none sm:rounded-none sm:rounded-l-2xl sm:border-l sm:border-t-0">
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-surface px-5 py-4">
          <h2 className="text-base font-semibold">Reading settings</h2>
          <button type="button" onClick={onClose} className="btn px-2 py-1.5" aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        <div className="space-y-7 px-5 py-5">
          {/* A live sample so every control shows its effect immediately. */}
          <div className="card overflow-hidden">
            <div className="reading !max-w-none px-4 py-3" lang="de">
              <p>{SAMPLE_DE}</p>
              <p className="translation mt-1 !ml-0">{SAMPLE_TRANSLATION[settings.target]}</p>
            </div>
          </div>

          <Section title="Background">
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

          <Section title="Typeface">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => update({ font: "serif" })}
                data-selected={settings.font === "serif"}
                className="chip flex-1 !justify-center !py-2"
                style={{ fontFamily: "var(--font-reading-serif)" }}
              >
                Serif
              </button>
              <button
                type="button"
                onClick={() => update({ font: "sans" })}
                data-selected={settings.font === "sans"}
                className="chip flex-1 !justify-center !py-2"
                style={{ fontFamily: "var(--font-reading-sans)" }}
              >
                Sans
              </button>
            </div>
          </Section>

          <Slider
            label="Text size"
            value={settings.fontSize}
            min={15}
            max={28}
            step={1}
            display={`${settings.fontSize}px`}
            onChange={(fontSize) => update({ fontSize })}
          />
          <Slider
            label="Line spacing"
            value={settings.lineHeight}
            min={1.3}
            max={2.4}
            step={0.05}
            display={settings.lineHeight.toFixed(2)}
            onChange={(lineHeight) => update({ lineHeight })}
          />
          <Slider
            label="Line width"
            value={settings.measure}
            min={42}
            max={92}
            step={2}
            display={`${settings.measure} characters`}
            onChange={(measure) => update({ measure })}
          />
          <Slider
            label="Letter spacing"
            value={settings.tracking}
            min={0}
            max={0.06}
            step={0.005}
            display={settings.tracking === 0 ? "Normal" : `+${settings.tracking.toFixed(3)}em`}
            onChange={(tracking) => update({ tracking })}
          />

          <Section title="Translate into">
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
                onClick={() => update({ target: "vi" })}
                data-selected={settings.target === "vi"}
                className="chip flex-1 !justify-center !py-2"
              >
                Tiếng Việt
              </button>
            </div>
          </Section>

          <Section title="Article layout">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => update({ layout: "lines" })}
                data-selected={settings.layout === "lines"}
                className="chip flex-1 !justify-center !py-2"
              >
                Line by line
              </button>
              <button
                type="button"
                onClick={() => update({ layout: "flow" })}
                data-selected={settings.layout === "flow"}
                className="chip flex-1 !justify-center !py-2"
              >
                Flowing text
              </button>
            </div>
            <p className="mt-2 text-xs text-muted">
              Line by line gives every sentence its own row and its own translation. Flowing text
              reads like the original page, with translations appearing under the paragraph.
            </p>
          </Section>

          <Section title="While reading">
            <Toggle
              label="Show all translations"
              hint="Bilingual mode: every sentence carries its translation from the start."
              checked={settings.bilingual}
              onChange={(bilingual) => update({ bilingual })}
            />
            <Toggle
              label="Paper texture"
              hint="A faint grain over the page, so it reads as a sheet rather than a screen."
              checked={settings.texture}
              onChange={(texture) => update({ texture })}
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
