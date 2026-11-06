"use client";

/**
 * Tiny localStorage-backed stores read through useSyncExternalStore, so every
 * component sees the same value, other tabs stay in sync, and the server
 * render (which has no storage) never mismatches the first client render.
 *
 * Storage can be unavailable (private mode, blocked site data); every read
 * and write is guarded and the app keeps working with in-memory state.
 */

import { useSyncExternalStore } from "react";

type Listener = () => void;

export function createStore<T>(key: string, fallback: T) {
  const listeners = new Set<Listener>();
  let cache: T | undefined;
  let raw: string | null | undefined;

  const read = (): T => {
    let next: string | null = null;
    try {
      next = window.localStorage.getItem(key);
    } catch {
      next = null;
    }
    if (cache !== undefined && next === raw) return cache;
    raw = next;
    try {
      cache = next ? (JSON.parse(next) as T) : fallback;
    } catch {
      cache = fallback;
    }
    return cache;
  };

  const write = (value: T) => {
    cache = value;
    try {
      raw = JSON.stringify(value);
      window.localStorage.setItem(key, raw);
    } catch {
      raw = undefined;
    }
    listeners.forEach((l) => l());
  };

  const subscribe = (l: Listener) => {
    listeners.add(l);
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) l();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(l);
      window.removeEventListener("storage", onStorage);
    };
  };

  const useValue = (): T => useSyncExternalStore(subscribe, read, () => fallback);

  return { read, write, useValue };
}
