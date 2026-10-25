"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Event, SearchParams } from "@/lib/types";
import { searchEvents } from "@/lib/api";

/**
 * Result of the most recent settled request, tagged with the query it
 * answers. Tagging is what lets `loading` be derived rather than stored: if
 * the settled tag isn't the current query, a request is in flight. That also
 * makes stale responses harmless — an out-of-date tag is simply ignored.
 */
interface Settled<T> {
  tag: string;
  data: T;
  error: string | null;
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : "Failed to load events";
}

/**
 * A single search.
 *
 * Params are compared by serialised value, not object identity, so a caller
 * rebuilding its params object each render doesn't refetch forever.
 */
export function useEventSearch(params: SearchParams, enabled: boolean = true) {
  const key = useMemo(() => JSON.stringify(params), [params]);
  const [nonce, setNonce] = useState(0);
  const [settled, setSettled] = useState<Settled<Event[]> | null>(null);

  const tag = `${key}#${nonce}#${enabled}`;
  const current = settled?.tag === tag ? settled : null;

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    searchEvents(JSON.parse(key) as SearchParams)
      .then((data) => {
        if (!cancelled) setSettled({ tag, data, error: null });
      })
      .catch((e: unknown) => {
        if (!cancelled) setSettled({ tag, data: [], error: message(e) });
      });

    return () => {
      cancelled = true;
    };
  }, [tag, key, enabled]);

  const retry = useCallback(() => setNonce((n) => n + 1), []);

  return {
    // Previous results are kept while a new query is in flight; callers
    // render a skeleton off `loading`, so this only avoids a blank flash.
    events: settled?.data ?? [],
    loading: enabled && current === null,
    error: current?.error ?? null,
    retry,
  };
}

export interface RailConfig {
  id: string;
  title: string;
  /** Stated basis for the rail's contents — see SectionHead. */
  basis: string;
  params: SearchParams;
  /** Link target for the rail's "see all". */
  href: string;
}

export interface RailResult extends RailConfig {
  events: Event[];
}

/**
 * Loads every homepage rail in parallel.
 *
 * A single rail failing or coming back empty never blocks the others — each
 * is an independent query, and empty rails are dropped by the caller rather
 * than rendered as bare shelves.
 */
export function useRails(configs: RailConfig[]) {
  const key = useMemo(() => JSON.stringify(configs), [configs]);
  const [nonce, setNonce] = useState(0);
  const [settled, setSettled] = useState<Settled<RailResult[]> | null>(null);

  const tag = `${key}#${nonce}`;
  const current = settled?.tag === tag ? settled : null;

  useEffect(() => {
    const list = JSON.parse(key) as RailConfig[];
    let cancelled = false;

    Promise.all(
      list.map(async (cfg) => {
        try {
          return { ...cfg, events: await searchEvents(cfg.params) };
        } catch {
          // One rail's failure is not a page error.
          return { ...cfg, events: [] };
        }
      })
    )
      .then((data) => {
        if (!cancelled) setSettled({ tag, data, error: null });
      })
      .catch((e: unknown) => {
        if (!cancelled) setSettled({ tag, data: [], error: message(e) });
      });

    return () => {
      cancelled = true;
    };
  }, [tag, key]);

  const retry = useCallback(() => setNonce((n) => n + 1), []);

  return {
    rails: current?.data ?? [],
    loading: current === null,
    error: current?.error ?? null,
    retry,
  };
}
