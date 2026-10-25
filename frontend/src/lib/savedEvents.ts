"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Saved events, stored in this browser only.
 *
 * The project has no authentication and no user table, so there is nowhere
 * server-side to put a saved list. This keeps it honest: the UI says "saved
 * on this device" rather than implying an account-backed collection.
 *
 * Only event ids are stored. Titles and times are re-fetched, so a saved
 * entry can never go stale or show details that have since changed.
 */
const STORAGE_KEY = "eventengine.saved.v1";
const CHANGE_EVENT = "eventengine:saved-change";

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    // Private mode, blocked site data, or corrupt JSON — saving is a
    // convenience, so degrade to "nothing saved" rather than throwing.
    return [];
  }
}

function write(ids: string[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Storage unavailable or full; the in-memory state below still updates
    // so the current page stays consistent for this session.
  }
  // Same-tab listeners: the native `storage` event only fires cross-tab.
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useSavedEvents() {
  const [ids, setIds] = useState<string[]>([]);
  // Nothing is read during render, so the server and first client render
  // agree; the stored list arrives on mount.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => {
      setIds(read());
      setReady(true);
    };
    sync();
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const toggle = useCallback((id: string) => {
    const current = read();
    const next = current.includes(id)
      ? current.filter((v) => v !== id)
      : [id, ...current];
    write(next);
    setIds(next);
  }, []);

  const isSaved = useCallback((id: string) => ids.includes(id), [ids]);

  return { savedIds: ids, isSaved, toggle, ready, count: ids.length };
}
