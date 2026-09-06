"use client";

import type { SourceLang } from "./types";

/**
 * Pronunciation practice: hear it, say it, hear yourself, get a score.
 *
 * The recording uses MediaRecorder and never leaves the page. The score comes
 * from the browser's own speech recognition: whatever it heard is compared
 * word by word with the sentence. That is a real, if blunt, measure - if the
 * machine cannot make out the word, a listener probably could not either.
 *
 * Recognition is not local on every platform. In Chrome the audio is sent to
 * Google for transcription, so the UI says so before the microphone opens.
 */

const BCP47: Record<SourceLang, string> = { de: "de-DE", en: "en-GB", vi: "vi-VN" };

interface RecognitionResultLike {
  0: { transcript: string };
  isFinal: boolean;
}
interface RecognitionEventLike {
  results: { length: number; [i: number]: RecognitionResultLike };
}
interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onresult: ((e: RecognitionEventLike) => void) | null;
  onerror: ((e: unknown) => void) | null;
  onend: (() => void) | null;
}

function recognitionClass(): (new () => RecognitionLike) | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as {
    SpeechRecognition?: new () => RecognitionLike;
    webkitSpeechRecognition?: new () => RecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export function recordingSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== "undefined"
  );
}

export function scoringSupported(): boolean {
  return Boolean(recognitionClass());
}

export interface Recorder {
  stop(): Promise<Blob>;
}

export async function startRecording(): Promise<Recorder> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const chunks: BlobPart[] = [];
  const recorder = new MediaRecorder(stream);
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  recorder.start();

  return {
    stop: () =>
      new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          // Releasing the tracks is what turns off the browser's mic indicator.
          stream.getTracks().forEach((t) => t.stop());
          resolve(new Blob(chunks, { type: recorder.mimeType || "audio/webm" }));
        };
        recorder.stop();
      }),
  };
}

/** Listens for one utterance and returns what it heard. */
export function listenOnce(lang: SourceLang, timeoutMs = 12_000): Promise<string> {
  const Recognition = recognitionClass();
  if (!Recognition) return Promise.reject(new Error("No speech recognition in this browser."));

  return new Promise((resolve, reject) => {
    const recognition = new Recognition();
    recognition.lang = BCP47[lang];
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };

    const timer = setTimeout(() => finish(() => reject(new Error("Heard nothing."))), timeoutMs);

    recognition.onresult = (e) => {
      const heard = e.results[0]?.[0]?.transcript ?? "";
      finish(() => resolve(heard));
    };
    recognition.onerror = () => finish(() => reject(new Error("The microphone did not catch that.")));
    recognition.onend = () => finish(() => reject(new Error("Heard nothing.")));

    recognition.start();
  });
}

export interface WordScore {
  word: string;
  ok: boolean;
}

export interface Score {
  percent: number;
  words: WordScore[];
  heard: string;
}

function normalise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Longest common subsequence over words, so a missed word in the middle does
 * not throw off everything after it.
 */
export function scoreAttempt(target: string, heard: string): Score {
  const want = normalise(target);
  const got = normalise(heard);
  if (!want.length) return { percent: 0, words: [], heard };

  const table: number[][] = Array.from({ length: want.length + 1 }, () =>
    new Array<number>(got.length + 1).fill(0),
  );
  for (let i = 1; i <= want.length; i++) {
    for (let j = 1; j <= got.length; j++) {
      table[i][j] =
        want[i - 1] === got[j - 1]
          ? table[i - 1][j - 1] + 1
          : Math.max(table[i - 1][j], table[i][j - 1]);
    }
  }

  const matched = new Set<number>();
  let i = want.length;
  let j = got.length;
  while (i > 0 && j > 0) {
    if (want[i - 1] === got[j - 1]) {
      matched.add(i - 1);
      i--;
      j--;
    } else if (table[i - 1][j] >= table[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  // Report against the words as written, so the highlighting lines up.
  const written = target.split(/(\s+)/).filter((t) => t.trim());
  let index = 0;
  const words: WordScore[] = written.map((word) => {
    const isWord = /[\p{L}\p{N}]/u.test(word);
    if (!isWord) return { word, ok: true };
    const ok = matched.has(index);
    index++;
    return { word, ok };
  });

  return {
    percent: Math.round((matched.size / want.length) * 100),
    words,
    heard,
  };
}
