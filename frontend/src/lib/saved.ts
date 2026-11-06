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

export interface SavedEvent {
  event: Event;
  savedAt: string;
}

const store = createStore<SavedEvent[]>("ee.saved.v1", []);

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
    return false;
  }
  // Keep only what the cards need; descriptions can be long.
  const snapshot: Event = { ...event, description: event.description?.slice(0, 600) ?? null };
  store.write([{ event: snapshot, savedAt: new Date().toISOString() }, ...list].slice(0, 200));
  return true;
}

export function removeSaved(id: string): void {
  store.write(store.read().filter((s) => s.event.id !== id));
}
