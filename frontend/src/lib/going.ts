"use client";

/**
 * The signed-in person's Going / Interested status per event, shared by
 * every control on the page (the social bar and the sticky action bar), so
 * they never disagree. Also announces "just marked going" for the ticket
 * stub moment.
 */
import { track } from "./track";
import { useEffect, useSyncExternalStore } from "react";
import { currentUserId, useAuth } from "./auth";
import { myStatus, setStatus, type Status } from "./social";

type Entry = { status: Status | null; loaded: boolean };
const entries = new Map<string, Entry>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const EMPTY: Entry = { status: null, loaded: false };

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

const loading = new Set<string>();
async function load(eventId: string, uid: string) {
  const key = `${uid}:${eventId}`;
  if (loading.has(key)) return;
  loading.add(key);
  try {
    const s = await myStatus(eventId);
    entries.set(key, { status: s, loaded: true });
  } catch {
    entries.set(key, { status: null, loaded: true });
  } finally {
    loading.delete(key);
    emit();
  }
}

type GoingListener = (eventId: string) => void;
const goingListeners = new Set<GoingListener>();
/** Called when the person marks an event Going (not on page load). */
export function onMarkedGoing(fn: GoingListener): () => void {
  goingListeners.add(fn);
  return () => goingListeners.delete(fn);
}

export function useMyStatus(eventId: string, enabled: boolean): [Entry, (next: Status | null) => Promise<void>] {
  const { session } = useAuth();
  const uid = session?.user.id ?? null;
  const key = uid ? `${uid}:${eventId}` : "";
  const entry = useSyncExternalStore(
    subscribe,
    () => (key ? (entries.get(key) ?? EMPTY) : EMPTY),
    () => EMPTY,
  );
  useEffect(() => {
    if (enabled && uid && !entries.get(`${uid}:${eventId}`)?.loaded) void load(eventId, uid);
  }, [enabled, uid, eventId]);

  const set = async (next: Status | null) => {
    const me = currentUserId();
    if (!me) return;
    const k = `${me}:${eventId}`;
    const prev = entries.get(k)?.status ?? null;
    entries.set(k, { status: next, loaded: true });
    emit();
    try {
      await setStatus(eventId, next);
      if (next === "going" && prev !== "going") {
        goingListeners.forEach((f) => f(eventId));
        track("going");
      }
    } catch (e) {
      entries.set(k, { status: prev, loaded: true });
      emit();
      throw e;
    }
  };
  return [entry, set];
}
