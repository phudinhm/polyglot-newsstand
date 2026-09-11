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

export function isAIVoice(voice: SpeechSynthesisVoice): boolean {
  if (voice.voiceURI === "google-translate-ai") return true;
  const name = voice.name.toLowerCase();
  return QUALITY_HINTS.some((hint) => name.includes(hint));
}

function isHumanVoice(voice: SpeechSynthesisVoice): boolean {
  const name = baseName(voice);
  return ![...NOVELTY].some((n) => name === n || name.startsWith(`${n} `));
}

function voiceRank(voice: SpeechSynthesisVoice): number {
  if (voice.voiceURI === "google-translate-ai") return -1; // Top priority
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
  voice.voiceURI === "google-translate-ai" ? "Cloud" : (VOICE_REGIONS[voice.lang.toLowerCase()] ?? voice.lang);

/**
 * Every installed voice for a language, across regions. German is spoken in
 * three countries and the browser tags them separately, so a reader who wants
 * an Austrian voice can have one.
 */
export function voicesFor(lang: SourceLang | TargetLang): SpeechSynthesisVoice[] {
  const prefix = BCP47[lang].slice(0, 2);
  const seen = new Set<string>();
  const nativeVoices = listVoices()
    .filter((v) => {
      if (!v.lang.toLowerCase().startsWith(prefix) || !isHumanVoice(v)) return false;
      // Some platforms list the same voice twice; a duplicate row is noise.
      const key = `${v.name.toLowerCase()}|${v.lang.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => voiceRank(a) - voiceRank(b) || a.name.localeCompare(b.name));

  const cloudVoice = {
    voiceURI: "google-translate-ai",
    name: "Google Cloud AI",
    lang: BCP47[lang],
    localService: false,
    default: false,
  } as SpeechSynthesisVoice;

  return [cloudVoice, ...nativeVoices];
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

let activeAudio: HTMLAudioElement | null = null;

export function speak(text: string, options: SpeakOptions): void {
  if (!text.trim()) return;
  cancelSpeech();

  // The cloud voice is a placeholder entry, not a real SpeechSynthesisVoice,
  // and it is also voicesFor()'s top-ranked pick - so an unset voiceUri
  // resolves to it exactly as often as an explicit choice does. Resolving
  // the URI first, before touching the Speech Synthesis API at all, is what
  // catches both: handing that placeholder to utterance.voice throws.
  const resolvedUri = options.voiceUri || voicesFor(options.lang)[0]?.voiceURI;

  if (resolvedUri === "google-translate-ai") {
    // Route through our own backend proxy to bypass any CORS/Referer blocks
    const url = `/api/tts?lang=${options.lang}&text=${encodeURIComponent(text)}`;
    activeAudio = new Audio(url);
    activeAudio.playbackRate = options.rate ?? 1;
    activeAudio.onended = () => {
      activeAudio = null;
      options.onEnd?.();
    };
    activeAudio.onerror = () => {
      activeAudio = null;
      options.onError?.();
    };
    // Simulate word boundary for the whole sentence since we don't have word-level timings
    options.onWord?.(0, text.length);
    activeAudio.play().catch(() => options.onError?.());
    return;
  }

  if (!speechSupported()) return;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = BCP47[options.lang];
  // Learners need it slower than a native pace, but not comically so.
  utterance.rate = options.rate ?? 0.9;

  const preferred = listVoices().find((v) => v.voiceURI === resolvedUri);
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
  if (activeAudio) activeAudio.pause();
  else if (speechSupported()) window.speechSynthesis.pause();
}

export function resumeSpeech(): void {
  if (activeAudio) activeAudio.play();
  else if (speechSupported()) window.speechSynthesis.resume();
}

export function isPaused(): boolean {
  if (activeAudio) return activeAudio.paused;
  return speechSupported() && window.speechSynthesis.paused;
}

export function cancelSpeech(): void {
  if (activeAudio) {
    activeAudio.pause();
    activeAudio = null;
  }
  if (speechSupported()) window.speechSynthesis.cancel();
}

export function isSpeaking(): boolean {
  if (activeAudio) return !activeAudio.paused;
  return speechSupported() && window.speechSynthesis.speaking;
}

/* ------------------------------------------------------- reading with the screen off */

/**
 * iOS suspends a plain Speech Synthesis utterance the moment the screen
 * locks - there is no audio session to keep the process alive without one.
 * A silent, looping audio element playing underneath is the standard
 * workaround: iOS sees an active playback session and keeps the tab (and
 * the voice reading from it) running with the screen off.
 */
let keepAliveAudio: HTMLAudioElement | null = null;

function ensureKeepAliveAudio(): HTMLAudioElement {
  if (!keepAliveAudio) {
    keepAliveAudio = new Audio("/silence.wav");
    keepAliveAudio.loop = true;
    keepAliveAudio.preload = "auto";
    keepAliveAudio.setAttribute("playsinline", "true");
  }
  return keepAliveAudio;
}

export function startBackgroundKeepAlive(): void {
  if (typeof window === "undefined") return;
  // Always follows a tap (the read-aloud button), so the user gesture
  // autoplay restrictions are already satisfied here.
  void ensureKeepAliveAudio()
    .play()
    .catch(() => {
      // Worst case, read-aloud stops when the screen locks, same as before.
    });
}

export function stopBackgroundKeepAlive(): void {
  keepAliveAudio?.pause();
}

/**
 * The iOS/Android lock screen and control-centre "now playing" card, so a
 * reader can see what is being read and pause or stop it without unlocking
 * the phone. Every call is a no-op where the Media Session API does not
 * exist, which today means most desktop browsers.
 */
export interface NowPlayingHandlers {
  onPlay?: () => void;
  onPause?: () => void;
  onStop?: () => void;
}

function hasMediaSession(): boolean {
  return typeof navigator !== "undefined" && "mediaSession" in navigator;
}

export function setNowPlaying(title: string, artist?: string): void {
  if (!hasMediaSession()) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist: artist ?? "Polyglot Newsstand",
    });
  } catch {
    // A lock-screen title is a nicety; losing it should not stop playback.
  }
}

export function setPlaybackState(state: MediaSessionPlaybackState): void {
  if (!hasMediaSession()) return;
  navigator.mediaSession.playbackState = state;
}

export function setNowPlayingHandlers(handlers: NowPlayingHandlers): void {
  if (!hasMediaSession()) return;
  navigator.mediaSession.setActionHandler("play", handlers.onPlay ?? null);
  navigator.mediaSession.setActionHandler("pause", handlers.onPause ?? null);
  navigator.mediaSession.setActionHandler("stop", handlers.onStop ?? null);
}

/** Called once reading stops for good: clears the card and the keep-alive audio together. */
export function clearNowPlaying(): void {
  stopBackgroundKeepAlive();
  if (!hasMediaSession()) return;
  navigator.mediaSession.metadata = null;
  navigator.mediaSession.playbackState = "none";
  setNowPlayingHandlers({});
}
