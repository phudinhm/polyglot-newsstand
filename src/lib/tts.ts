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

export function voicesFor(lang: SourceLang | TargetLang): SpeechSynthesisVoice[] {
  const prefix = BCP47[lang].slice(0, 2);
  return listVoices().filter((v) => v.lang.toLowerCase().startsWith(prefix));
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
