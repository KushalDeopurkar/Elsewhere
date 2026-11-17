"use client";

/**
 * Saved events, kept on this device.
 *
 * There is no sign-in yet, so saves live in the browser's localStorage and
 * say so in the UI. A snapshot of each event is stored, so the Saved page
 * renders without a network call. Syncing across devices needs accounts and
 * a saved_events table (see the hand-off notes).
 */

import { Event } from "./types";
import { createStore } from "./clientStore";
import { stampPassport } from "./passport";

export interface SavedEvent {
  event: Event;
  savedAt: string;
}

const store = createStore<SavedEvent[]>("ee.saved.v1", []);

/** Where saves are mirrored when someone is signed in (set by lib/sync). */
type Sink = (event: Event, saved: boolean) => void;
let sink: Sink | null = null;
export function setSavedSink(fn: Sink | null): void {
  sink = fn;
}

export function readSaved(): SavedEvent[] {
  return store.read();
}

/** Add saves that came from the account (no sink echo, no stamps). */
export function mergeSaved(items: SavedEvent[]): void {
  const list = store.read();
  const have = new Set(list.map((s) => s.event.id));
  const fresh = items.filter((s) => !have.has(s.event.id));
  if (fresh.length) store.write([...list, ...fresh].sort((a, b) => b.savedAt.localeCompare(a.savedAt)).slice(0, 200));
}

export function useSaved(): SavedEvent[] {
  return store.useValue();
}

export function isSaved(list: SavedEvent[], id: string): boolean {
  return list.some((s) => s.event.id === id);
}

export function toggleSaved(event: Event): boolean {
  const list = store.read();
  if (isSaved(list, event.id)) {
    store.write(list.filter((s) => s.event.id !== event.id));
    sink?.(event, false);
    return false;
  }
  // Keep only what the cards need; descriptions can be long.
  const snapshot: Event = { ...event, description: event.description?.slice(0, 600) ?? null };
  store.write([{ event: snapshot, savedAt: new Date().toISOString() }, ...list].slice(0, 200));
  stampPassport(event);
  sink?.(event, true);
  return true;
}

export function removeSaved(id: string): void {
  const hit = store.read().find((s) => s.event.id === id);
  store.write(store.read().filter((s) => s.event.id !== id));
  if (hit) sink?.(hit.event, false);
}

/** Save without toggling: a no-op when the event is already saved. */
export function ensureSaved(event: Event): void {
  if (!isSaved(store.read(), event.id)) toggleSaved(event);
}
