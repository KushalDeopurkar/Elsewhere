"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Microphone } from "@phosphor-icons/react/ssr";
import { normalizeSpoken } from "@/lib/voice";
import { sfx } from "@/lib/sound";

interface Rec {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type RecCtor = new () => Rec;

const ctor = (): RecCtor | null =>
  typeof window === "undefined"
    ? null
    : ((window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor }).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: RecCtor }).webkitSpeechRecognition ??
      null);
const noop = () => () => {};

/**
 * Speak a search. Uses the browser's speech recognition (Chrome, Edge,
 * Android, Safari); hidden where it isn't available. Indian English, with
 * common Hinglish time words mapped ("kal shaam comedy").
 */
export default function VoiceButton({
  onInterim,
  onFinal,
  className = "",
}: {
  onInterim?: (text: string) => void;
  onFinal: (text: string) => void;
  className?: string;
}) {
  const supported = useSyncExternalStore(noop, () => Boolean(ctor()), () => false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Rec | null>(null);
  const cb = useRef({ onInterim, onFinal });
  useEffect(() => {
    cb.current = { onInterim, onFinal };
  });
  useEffect(() => () => rec.current?.stop(), []);

  if (!supported) return null;

  const toggle = () => {
    if (listening) {
      rec.current?.stop();
      return;
    }
    const R = ctor();
    if (!R) return;
    const r = new R();
    r.lang = "en-IN";
    r.interimResults = true;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      const list = Array.from(e.results);
      const text = list.map((x) => x[0].transcript).join(" ");
      if (list.length && list[list.length - 1].isFinal) {
        const out = normalizeSpoken(text);
        cb.current.onInterim?.(out);
        cb.current.onFinal(out);
      } else {
        cb.current.onInterim?.(text);
      }
    };
    r.onerror = (e) => {
      setError(e.error === "not-allowed" ? "Microphone blocked. Allow it in the address bar." : e.error === "no-speech" ? "Didn't catch that. Try again." : null);
    };
    r.onend = () => setListening(false);
    rec.current = r;
    setError(null);
    setListening(true);
    sfx("tick");
    try {
      r.start();
    } catch {
      setListening(false);
    }
  };

  return (
    <span className={`voice ${className}`}>
      <button
        type="button"
        className={`voice-btn${listening ? " is-on" : ""}`}
        aria-pressed={listening}
        aria-label={listening ? "Stop listening" : "Search by voice"}
        title={listening ? "Listening… tap to stop" : "Search by voice"}
        onClick={toggle}
      >
        <Microphone size={18} weight={listening ? "fill" : "bold"} />
      </button>
      <span className="sr-only" aria-live="polite">
        {listening ? "Listening" : error ?? ""}
      </span>
      {error && (
        <span className="voice-err" role="status">
          {error}
        </span>
      )}
    </span>
  );
}
