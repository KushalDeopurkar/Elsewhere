"use client";

/** Taste profile kept on this device, built from swipes and browsing. */
import { createStore } from "./clientStore";
import type { Event } from "./types";
import { EMPTY_PROFILE, addSeen, applySignal, type Signal, type TasteProfile } from "./tasteCore";

export * from "./tasteCore";

const store = createStore<TasteProfile>("ee.taste.v1", EMPTY_PROFILE);

export function useTaste(): TasteProfile {
  return store.useValue();
}

export function readTaste(): TasteProfile {
  return store.read();
}

export function recordSignal(event: Event, signal: Signal, sign: 1 | -1 = 1): void {
  store.write(applySignal(store.read(), event, signal, sign));
}

export function markSeen(id: string): void {
  store.write(addSeen(store.read(), id));
}

export function unmarkSeen(id: string): void {
  const p = store.read();
  store.write({ ...p, seen: p.seen.filter((s) => s !== id) });
}

export function resetSeen(): void {
  store.write({ ...store.read(), seen: [] });
}

export function resetTaste(): void {
  store.write(EMPTY_PROFILE);
}
