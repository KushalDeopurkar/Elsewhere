"use client";

/**
 * Vibe as colour grade: the mood you pick on /vibe re-tints the whole site
 * (accent, glow, and how quickly things move) for this browsing session.
 * Session storage, so it never sticks around for days unannounced; the
 * nav chip resets it.
 */
import { useSyncExternalStore } from "react";
import type { VibeId } from "./vibe";

const KEY = "ee.grade.v1";
const listeners = new Set<() => void>();

function read(): VibeId | null {
  try {
    return (sessionStorage.getItem(KEY) as VibeId | null) || null;
  } catch {
    return null;
  }
}

export function setGrade(id: VibeId | null): void {
  try {
    if (id) sessionStorage.setItem(KEY, id);
    else sessionStorage.removeItem(KEY);
  } catch {
    /* storage blocked: still apply for this page */
  }
  if (id) document.documentElement.dataset.grade = id;
  else delete document.documentElement.dataset.grade;
  listeners.forEach((l) => l());
}

export function useGrade(): VibeId | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
    () => null,
  );
}
