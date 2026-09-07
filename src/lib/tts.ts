"use client";

import type { SourceLang, TargetLang } from "./types";

/**
 * Reading aloud, using the voices already on the device.
 *
 * The Web Speech API costs nothing, works offline on most platforms and, more
 * to the point, gives a learner the one thing text cannot: how the sentence
 * actually sounds. Voice quality varies by device, so the picker shows what
 * is really installed rather than promising anything.
 */

const BCP47: Record<SourceLang | TargetLang, string> = {
  de: "de-DE",
  en: "en-GB",
  vi: "vi-VN",
};

export function speechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function listVoices(): SpeechSynthesisVoice[] {
  if (!speechSupported()) return [];
  return window.speechSynthesis.getVoices();
}

/**
 * Voices arrive asynchronously in most browsers, and in Chrome the first call
 * returns an empty list until the engine has warmed up.
 */
export function onVoicesReady(callback: (voices: SpeechSynthesisVoice[]) => void): () => void {
  if (!speechSupported()) return () => {};
  const emit = () => callback(window.speechSynthesis.getVoices());
  emit();
  window.speechSynthesis.addEventListener("voiceschanged", emit);
  return () => window.speechSynthesis.removeEventListener("voiceschanged", emit);
}

/**
 * The joke voices, and only those.
 *
 * Apple ships a set of voices with first names - Eddy, Flo, Grandma, Grandpa,
 * Reed, Rocko, Sandy, Shelley - and every one of them exists in German. An
 * earlier version of this list read them as novelty and threw them out, which
 * silently deleted eight German voices from a picker that then looked bare.
 * What actually belongs here is the instruments and the robots: things that do
 * not sound like a person reading, in any language.
 */
const NOVELTY = new Set([
  "albert", "bad news", "bahh", "bells", "boing", "bubbles", "cellos",
  "deranged", "good news", "jester", "organ", "pipe organ", "superstar",
  "trinoids", "whisper", "wobble", "zarvox", "hysterical", "bad guy",
]);

/**
 * Older, thinner voices that still read like a person. Kept, because on a
 * device with nothing else they are the difference between hearing the
 * sentence and not, but ranked below anything newer.
 */
const LEGACY = new Set(["fred", "ralph", "kathy", "junior", "princess", "victoria", "agnes"]);

/** Names that mark a modern, more natural engine on the platforms that have one. */
const QUALITY_HINTS = ["neural", "natural", "premium", "enhanced", "siri", "online", "wavenet"];

const baseName = (voice: SpeechSynthesisVoice) =>
  voice.name.toLowerCase().replace(/\s*\(.*\)\s*$/, "").trim();

function isHumanVoice(voice: SpeechSynthesisVoice): boolean {
  const name = baseName(voice);
  return ![...NOVELTY].some((n) => name === n || name.startsWith(`${n} `));
}

function voiceRank(voice: SpeechSynthesisVoice): number {
  const name = voice.name.toLowerCase();
  if (LEGACY.has(baseName(voice))) return 9;
  const quality = QUALITY_HINTS.some((hint) => name.includes(hint)) ? 0 : 1;
  // A network voice usually sounds better; a local one always works offline.
  return quality * 2 + (voice.localService ? 1 : 0);
}

/** Where a voice is from, which is a real choice for German. */
export const VOICE_REGIONS: Record<string, string> = {
  "de-de": "Deutschland",
  "de-at": "Österreich",
  "de-ch": "Schweiz",
  "en-gb": "UK",
  "en-us": "US",
  "en-au": "Australia",
  "en-ie": "Ireland",
  "en-in": "India",
  "en-za": "South Africa",
  "en-nz": "New Zealand",
  "vi-vn": "Việt Nam",
};

export const regionOf = (voice: SpeechSynthesisVoice) =>
  VOICE_REGIONS[voice.lang.toLowerCase()] ?? voice.lang;

/**
 * Every installed voice for a language, across regions. German is spoken in
 * three countries and the browser tags them separately, so a reader who wants
 * an Austrian voice can have one.
 */
export function voicesFor(lang: SourceLang | TargetLang): SpeechSynthesisVoice[] {
  const prefix = BCP47[lang].slice(0, 2);
  const seen = new Set<string>();
  return listVoices()
    .filter((v) => {
      if (!v.lang.toLowerCase().startsWith(prefix) || !isHumanVoice(v)) return false;
      // Some platforms list the same voice twice; a duplicate row is noise.
      const key = `${v.name.toLowerCase()}|${v.lang.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => voiceRank(a) - voiceRank(b) || a.name.localeCompare(b.name));
}

export interface SpeakOptions {
  lang: SourceLang | TargetLang;
  rate?: number;
  voiceUri?: string;
  onEnd?: () => void;
  onError?: () => void;
  /**
   * Fires as each word is reached, with its offset in the text. This is what
   * makes read-along highlighting possible: the ear and the eye stay together
   * instead of the reader hunting for where the voice has got to.
   */
  onWord?: (charIndex: number, charLength: number) => void;
}

export function speak(text: string, options: SpeakOptions): void {
  if (!speechSupported() || !text.trim()) return;
  cancelSpeech();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = BCP47[options.lang];
  // Learners need it slower than a native pace, but not comically so.
  utterance.rate = options.rate ?? 0.9;

  const preferred = options.voiceUri
    ? listVoices().find((v) => v.voiceURI === options.voiceUri)
    : voicesFor(options.lang)[0];
  if (preferred) utterance.voice = preferred;

  if (options.onEnd) utterance.addEventListener("end", options.onEnd);
  if (options.onError) utterance.addEventListener("error", options.onError);
  if (options.onWord) {
    utterance.addEventListener("boundary", (event) => {
      // Safari reports only word boundaries; Chrome also reports sentences.
      if (event.name && event.name !== "word") return;
      options.onWord?.(event.charIndex, event.charLength || 0);
    });
  }

  window.speechSynthesis.speak(utterance);
}

export function pauseSpeech(): void {
  if (speechSupported()) window.speechSynthesis.pause();
}

export function resumeSpeech(): void {
  if (speechSupported()) window.speechSynthesis.resume();
}

export function isPaused(): boolean {
  return speechSupported() && window.speechSynthesis.paused;
}

export function cancelSpeech(): void {
  if (!speechSupported()) return;
  window.speechSynthesis.cancel();
}

export function isSpeaking(): boolean {
  return speechSupported() && window.speechSynthesis.speaking;
}
