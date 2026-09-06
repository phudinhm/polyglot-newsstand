"use client";

import { useEffect, useRef, useState } from "react";
import { useSettings } from "@/hooks/useSettings";
import { speak, speechSupported } from "@/lib/tts";
import {
  listenOnce,
  recordingSupported,
  scoreAttempt,
  scoringSupported,
  startRecording,
  type Recorder,
  type Score,
} from "@/lib/pronunciation";
import type { SourceLang } from "@/lib/types";
import { CloseIcon, MicIcon, SpeakerIcon, SpinnerIcon, StopIcon } from "./Icons";

type Phase = "idle" | "recording" | "scoring" | "done";

/**
 * Say the line back.
 *
 * Reading builds recognition; saying it out loud is the only thing that builds
 * production. The loop is deliberately short: hear it, say it, hear yourself,
 * see which words did not land.
 */
export function PronunciationPractice({
  sentence,
  lang,
  onClose,
}: {
  sentence: string;
  lang: SourceLang;
  onClose: () => void;
}) {
  const [settings] = useSettings();
  const [phase, setPhase] = useState<Phase>("idle");
  const [score, setScore] = useState<Score | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clipUrl, setClipUrl] = useState<string | null>(null);
  const recorderRef = useRef<Recorder | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // A blob URL that outlives the panel would leak the recording in memory.
  useEffect(() => () => {
    if (clipUrl) URL.revokeObjectURL(clipUrl);
  }, [clipUrl]);

  async function begin() {
    setError(null);
    setScore(null);
    if (clipUrl) URL.revokeObjectURL(clipUrl);
    setClipUrl(null);

    try {
      recorderRef.current = await startRecording();
      setPhase("recording");

      // Recognition runs alongside the recording, on the same voice.
      if (scoringSupported()) {
        listenOnce(lang)
          .then((heard) => {
            setScore(scoreAttempt(sentence, heard));
            setPhase("done");
          })
          .catch((err: Error) => {
            setError(err.message);
            setPhase("done");
          })
          .finally(() => void finishRecording());
      }
    } catch {
      setError("The microphone is not available. Check the browser's permission for this site.");
      setPhase("idle");
    }
  }

  async function finishRecording() {
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (!recorder) return;
    const blob = await recorder.stop();
    setClipUrl(URL.createObjectURL(blob));
  }

  async function stopNow() {
    setPhase(scoringSupported() ? "scoring" : "done");
    await finishRecording();
    if (!scoringSupported()) setPhase("done");
  }

  const canRecord = recordingSupported();

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/35 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-label="Pronunciation practice"
        className="fixed inset-x-3 bottom-3 z-50 max-h-[80vh] overflow-y-auto rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow)] sm:inset-x-auto sm:left-1/2 sm:bottom-auto sm:top-1/2 sm:w-[30rem] sm:-translate-x-1/2 sm:-translate-y-1/2"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-[15px] font-semibold">Say it back</h2>
          <button type="button" onClick={onClose} className="btn !px-1.5 !py-1.5" aria-label="Close">
            <CloseIcon width={16} height={16} />
          </button>
        </div>

        <p className="reading mt-3 !max-w-none rounded-xl bg-surface-2 px-3.5 py-3 !text-[17px]" lang={lang}>
          {score
            ? score.words.map((w, i) => (
                <span
                  key={i}
                  className={
                    w.ok
                      ? "text-translation"
                      : "rounded bg-[color-mix(in_srgb,var(--accent)_22%,transparent)] text-fg"
                  }
                >
                  {w.word}{" "}
                </span>
              ))
            : sentence}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {speechSupported() && (
            <button
              type="button"
              onClick={() =>
                speak(sentence, { lang, rate: settings.speechRate, voiceUri: settings.voices[lang] })
              }
              className="btn"
            >
              <SpeakerIcon width={16} height={16} /> Hear it
            </button>
          )}

          {canRecord &&
            (phase === "recording" ? (
              <button type="button" onClick={() => void stopNow()} className="btn btn-primary">
                <StopIcon width={16} height={16} /> Stop
              </button>
            ) : phase === "scoring" ? (
              <button type="button" disabled className="btn">
                <SpinnerIcon width={16} height={16} /> Listening…
              </button>
            ) : (
              <button type="button" onClick={() => void begin()} className="btn btn-primary">
                <MicIcon width={16} height={16} />
                {score ? "Try again" : "Record"}
              </button>
            ))}

          {clipUrl && (
            <audio controls src={clipUrl} className="h-9 min-w-0 flex-1" aria-label="Your recording" />
          )}
        </div>

        {phase === "recording" && (
          <p className="mt-2.5 flex items-center gap-2 text-[13px] text-muted">
            <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-accent" />
            Recording. Read the line out loud, then press stop.
          </p>
        )}

        {score && (
          <div className="mt-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold tabular-nums">{score.percent}%</span>
              <span className="text-[13px] text-muted">
                {score.percent >= 85
                  ? "Clear. That would be understood anywhere."
                  : score.percent >= 60
                    ? "Mostly there. The highlighted words did not come through."
                    : "Hard to make out. Try it slower, one word at a time."}
              </span>
            </div>
            <p className="mt-1.5 text-[12px] text-muted">Heard: “{score.heard}”</p>
          </div>
        )}

        {error && <p className="mt-3 text-[13px] text-muted">{error}</p>}

        {!canRecord && (
          <p className="mt-3 text-[13px] text-muted">
            This browser cannot record audio, so practice is unavailable here. It works in Chrome,
            Edge and Safari.
          </p>
        )}

        {canRecord && !scoringSupported() && (
          <p className="mt-3 text-[12px] text-muted">
            This browser can record but cannot score, so you will hear yourself back without a mark.
          </p>
        )}

        {canRecord && scoringSupported() && (
          <p className="mt-3 border-t border-border pt-2.5 text-[11.5px] leading-relaxed text-muted">
            The recording stays on this device. Scoring uses the browser's own speech recognition,
            which on Chrome means the audio is sent to Google to be transcribed.
          </p>
        )}
      </div>
    </>
  );
}
