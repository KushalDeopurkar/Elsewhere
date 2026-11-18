"use client";

/**
 * Opt-in sound (and haptics on Android). Off by default, one switch in the nav, remembered on this
 * device. Everything is synthesised with Web Audio (no files to download),
 * kept short and quiet, and nothing ever plays before the person turns
 * sound on with a click, which is also what unlocks audio in browsers.
 */
import { createStore } from "./clientStore";
import type { EventCategory } from "./types";

const store = createStore<boolean>("ee.sound.v1", false);
export const useSoundOn = store.useValue;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.22;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function setSound(on: boolean): void {
  store.write(on);
  if (on) {
    audio();
    sfx("pop");
  } else {
    stopAmbient();
  }
}

export type Sfx = "tick" | "whoosh" | "pop" | "swipe" | "stamp";

function tone(c: AudioContext, freq: number, at: number, dur: number, type: OscillatorType, peak: number, glideTo?: number) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, at + dur);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(master!);
  o.start(at);
  o.stop(at + dur + 0.02);
}

function noise(c: AudioContext, at: number, dur: number, from: number, to: number, peak: number) {
  const len = Math.ceil(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.Q.value = 0.9;
  f.frequency.setValueAtTime(from, at);
  f.frequency.exponentialRampToValueAtTime(to, at + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + dur * 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(f).connect(g).connect(master!);
  src.start(at);
}

const BUZZ: Record<Sfx, number | number[]> = { tick: 6, pop: 12, whoosh: 10, swipe: 8, stamp: [12, 50, 24] };

/**
 * Play a UI sound if sound is on, with a matching short vibration on phones
 * that support it (Android). Safe to call anywhere.
 */
export function sfx(name: Sfx): void {
  if (!store.read()) return;
  try {
    navigator.vibrate?.(BUZZ[name]);
  } catch {
    /* some browsers throw outside a user gesture */
  }
  const c = audio();
  if (!c) return;
  const t = c.currentTime;
  switch (name) {
    case "tick":
      tone(c, 1800, t, 0.05, "sine", 0.25);
      break;
    case "pop":
      tone(c, 520, t, 0.14, "sine", 0.5, 880);
      break;
    case "whoosh":
      noise(c, t, 0.32, 400, 3200, 0.5);
      break;
    case "swipe":
      noise(c, t, 0.2, 2400, 600, 0.35);
      break;
    case "stamp":
      tone(c, 160, t, 0.18, "triangle", 0.6, 90);
      tone(c, 660, t + 0.05, 0.22, "sine", 0.25, 990);
      break;
  }
}

/** Per-category ambient bed: root note and filter brightness. */
const AMBIENT: Partial<Record<EventCategory, { root: number; bright: number }>> = {
  music: { root: 110, bright: 900 },
  nightlife: { root: 98, bright: 700 },
  arts: { root: 147, bright: 1400 },
  tech: { root: 131, bright: 2200 },
  business: { root: 123, bright: 1200 },
  education: { root: 165, bright: 1600 },
  sports: { root: 117, bright: 1800 },
  outdoor: { root: 175, bright: 2600 },
  health: { root: 196, bright: 1100 },
  food: { root: 139, bright: 1000 },
  family: { root: 220, bright: 2000 },
  community: { root: 156, bright: 1300 },
};

let bed: { stop: () => void; key: string } | null = null;

/** A soft two-voice pad for a category; replaces any bed already playing. */
export function playAmbient(category: EventCategory): void {
  if (!store.read()) return;
  const c = audio();
  if (!c) return;
  if (bed?.key === category) return;
  stopAmbient();
  const spec = AMBIENT[category] ?? { root: 146, bright: 1200 };
  const t = c.currentTime;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.18, t + 1.2);
  const f = c.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = spec.bright;
  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  lfo.frequency.value = 0.12;
  lfoGain.gain.value = spec.bright * 0.35;
  lfo.connect(lfoGain).connect(f.frequency);
  const voices = [1, 1.5, 2.005].map((m) => {
    const o = c.createOscillator();
    o.type = m === 1 ? "triangle" : "sine";
    o.frequency.value = spec.root * m;
    o.connect(f);
    return o;
  });
  f.connect(g).connect(master!);
  voices.forEach((o) => o.start(t));
  lfo.start(t);
  bed = {
    key: category,
    stop: () => {
      const n = c.currentTime;
      g.gain.cancelScheduledValues(n);
      g.gain.setValueAtTime(g.gain.value, n);
      g.gain.exponentialRampToValueAtTime(0.0001, n + 0.5);
      voices.forEach((o) => o.stop(n + 0.55));
      lfo.stop(n + 0.55);
    },
  };
}

export function stopAmbient(): void {
  bed?.stop();
  bed = null;
}
