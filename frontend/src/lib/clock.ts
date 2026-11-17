"use client";

/**
 * One shared ticking clock for live countdowns. Every subscriber reads the
 * same value, a single timer runs only while something is listening, and the
 * server snapshot is 0 so time-dependent text renders only on the client
 * (no hydration mismatch).
 */
import { useSyncExternalStore } from "react";

const listeners = new Map<number, Set<() => void>>();
const timers = new Map<number, number>();
const snaps = new Map<number, number>();

const tick = (step: number) => Math.floor(Date.now() / step) * step;

function subscribeFor(step: number) {
  return (l: () => void) => {
    let set = listeners.get(step);
    if (!set) listeners.set(step, (set = new Set()));
    set.add(l);
    if (!timers.has(step)) {
      snaps.set(step, tick(step));
      timers.set(
        step,
        window.setInterval(() => {
          const next = tick(step);
          if (next === snaps.get(step)) return;
          snaps.set(step, next);
          listeners.get(step)?.forEach((f) => f());
        }, Math.min(step, 1000)),
      );
    }
    return () => {
      set!.delete(l);
      if (set!.size === 0) {
        window.clearInterval(timers.get(step));
        timers.delete(step);
      }
    };
  };
}

const subs = new Map<number, (l: () => void) => () => void>();

/** Current time rounded down to `stepMs` (default 15s); 0 during SSR. */
export function useNow(stepMs = 15_000): number {
  let sub = subs.get(stepMs);
  if (!sub) subs.set(stepMs, (sub = subscribeFor(stepMs)));
  return useSyncExternalStore(
    sub,
    () => {
      if (!snaps.has(stepMs)) snaps.set(stepMs, tick(stepMs));
      return snaps.get(stepMs)!;
    },
    () => 0,
  );
}
