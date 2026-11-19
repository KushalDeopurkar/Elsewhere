"use client";

import { useEffect, useState } from "react";

/**
 * Cities outside India that currently have upcoming events (from
 * /api/cities). null until known, or when it can't be told, in which case
 * callers show every city. Fetched once per page load and shared.
 */
let cached: Set<string> | null | undefined;
let pending: Promise<Set<string> | null> | null = null;

function load(): Promise<Set<string> | null> {
  pending ??= fetch("/api/cities")
    .then((r) => (r.ok ? r.json() : { active: null }))
    .then((d: { active: string[] | null }) => (cached = d.active ? new Set(d.active) : null))
    .catch(() => (cached = null));
  return pending;
}

export function useActiveCities(): Set<string> | null {
  const [active, setActive] = useState<Set<string> | null>(cached ?? null);
  useEffect(() => {
    if (cached !== undefined) return;
    let live = true;
    void load().then((s) => live && setActive(s));
    return () => {
      live = false;
    };
  }, []);
  return active;
}
