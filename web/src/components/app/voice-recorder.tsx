"use client";
import { Mic, Square } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/* Minimal typings for the Web Speech API (not in lib.dom for all TS versions). */
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<SpeechRecognitionResultLike> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

function getRecognition(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

/**
 * Voice note capture with live on-device transcription (Web Speech API).
 * Audio is never stored or uploaded by DAYZERO — only the transcript, which
 * the user can edit before saving.
 */
export function VoiceRecorder({ onTranscript, transcript }: { onTranscript: (t: string) => void; transcript: string }) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [recording, setRecording] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const baseRef = useRef("");
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const timerRef = useRef<number>(0);

  useEffect(() => setSupported(!!getRecognition()), []);

  const cleanup = useCallback(() => {
    window.clearInterval(timerRef.current);
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setLevel(0);
  }, []);

  useEffect(() => () => {
    recRef.current?.abort();
    cleanup();
  }, [cleanup]);

  const stop = useCallback(() => {
    recRef.current?.stop();
    setRecording(false);
    cleanup();
  }, [cleanup]);

  const start = async () => {
    setError(null);
    const rec = getRecognition();
    if (!rec) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(buf);
        setLevel(buf.reduce((a, b) => a + b, 0) / buf.length / 128);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      setError("Microphone access was blocked. Allow it in your browser settings, or type your note instead.");
      return;
    }
    baseRef.current = transcript ? `${transcript.trim()} ` : "";
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language || "en-US";
    rec.onresult = (e) => {
      let finalText = "";
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interimText += r[0].transcript;
      }
      if (finalText) {
        baseRef.current = `${baseRef.current}${finalText.trim()} `;
        onTranscript(baseRef.current.trim());
      }
      setInterim(interimText);
    };
    rec.onerror = (e) => {
      if (e.error !== "no-speech" && e.error !== "aborted") setError(e.error === "not-allowed" ? "Microphone access was blocked." : `Transcription stopped (${e.error}).`);
      stop();
    };
    rec.onend = () => {
      setRecording(false);
      setInterim("");
      cleanup();
    };
    recRef.current = rec;
    rec.start();
    setRecording(true);
    setSeconds(0);
    timerRef.current = window.setInterval(() => setSeconds((s) => (s >= 300 ? (stop(), s) : s + 1)), 1000);
  };

  if (supported === false) {
    return (
      <p className="rounded-lg border border-line bg-surface p-3 text-sm text-muted">
        Live voice transcription isn&apos;t available in this browser. Try Chrome, Edge or Safari — or type your note in the box below.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-line bg-surface px-4 py-6">
      <button
        type="button"
        onClick={recording ? stop : start}
        disabled={supported === null}
        aria-pressed={recording}
        aria-label={recording ? "Stop recording" : "Start recording"}
        className={cn("relative grid h-16 w-16 place-items-center rounded-full transition", recording ? "bg-danger text-white" : "bg-accent text-accent-fg hover:brightness-105")}
      >
        {recording && <span className="absolute inset-0 rounded-full bg-danger/40" style={{ transform: `scale(${1 + Math.min(level, 1) * 0.5})`, transition: "transform 80ms" }} aria-hidden="true" />}
        {recording ? <Square className="relative h-5 w-5 fill-current" /> : <Mic className="relative h-6 w-6" />}
      </button>
      <div className="text-center text-sm" aria-live="polite">
        {recording ? (
          <span className="tabular-nums text-fg">
            Listening… {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
          </span>
        ) : (
          <span className="text-muted">{transcript ? "Tap to keep talking" : "Tap and speak — e.g. “Dentist Tuesday at 4, and pay rent by Friday”"}</span>
        )}
        {interim && <p className="mt-1 italic text-subtle">{interim}</p>}
      </div>
      {error && (
        <p role="alert" className="text-center text-xs text-danger">
          {error}
        </p>
      )}
      {recording && (
        <Button size="sm" variant="outline" onClick={stop}>
          Done
        </Button>
      )}
    </div>
  );
}
