"use client";

import { useEffect, useRef, useState } from "react";
import { searchEvents } from "@/lib/api";
import type { Event, EventCategory } from "@/lib/types";
import type { CityPoint } from "@/lib/cities";

const RETRY_DELAYS = [3000, 8000];

interface Result {
  key: string;
  events: Event[];
  isSample: boolean;
  error: string | null;
  /** The server has more after these (the page was full). */
  more: boolean;
  /** Next server offset to ask for. */
  offset: number;
}

/**
 * Recent answers, so going back to a page shows its events at once while a
 * fresh copy loads (stale-while-revalidate, for this tab only).
 */
const recent = new Map<string, { at: number; result: Result }>();
const FRESH_MS = 2 * 60_000;

/**
 * The last answer per search is also kept on the device, so a return visit
 * shows its listings at once, and a slow or failing database shows the last
 * good ones instead of a spinner. Refreshed whenever a live answer arrives.
 */
const STORE = "elsewhere:events:v1:";
const STORE_MAX_AGE = 12 * 60 * 60_000;

function readStored(key: string): Result | null {
  try {
    const raw = window.localStorage.getItem(STORE + key);
    if (!raw) return null;
    const { at, result } = JSON.parse(raw) as { at: number; result: Result };
    if (Date.now() - at > STORE_MAX_AGE || !result?.events?.length) return null;
    // Only what hasn't finished yet.
    const now = Date.now();
    const events = result.events.filter((e) => Date.parse(e.end_time ?? e.start_time) > now - 60 * 60_000);
    return events.length ? { ...result, key, events, error: null } : null;
  } catch {
    return null;
  }
}

function writeStored(key: string, result: Result) {
  try {
    window.localStorage.setItem(STORE + key, JSON.stringify({ at: Date.now(), result }));
  } catch {
    // Storage full or blocked: memory still holds it for this tab.
  }
}

/**
 * Upcoming events around a city from the existing search API, refetched when
 * the city, category, query or dates change. A newer request always wins.
 * While a waking API is retried, the page keeps its loading state rather
 * than showing "nothing here"; `loadMore` fetches the next server page.
 */
export function useCityEvents(
  city: CityPoint,
  opts: { category?: EventCategory | null; q?: string; limit?: number; from?: string; to?: string; skip?: boolean } = {},
) {
  const limit = opts.limit ?? 100;
  const key = `${city.name}|${opts.category ?? ""}|${opts.q ?? ""}|${limit}|${opts.from ?? ""}|${opts.to ?? ""}|${opts.skip ? 1 : 0}`;
  const [result, setResult] = useState<Result | null>(() => recent.get(key)?.result ?? null);
  const [tries, setTries] = useState<{ key: string; n: number }>({ key, n: 0 });
  const [paging, setPaging] = useState(false);
  const latest = useRef(key);
  const attempt = tries.key === key ? tries.n : 0;

  const params = {
    lat: city.lat,
    lng: city.lng,
    radius_km: 40,
    limit,
    category: opts.category ?? undefined,
    q: opts.q || undefined,
    from: opts.from,
    to: opts.to,
  };

  useEffect(() => {
    latest.current = key;
    let live = true;
    if (opts.skip) return;
    const cached = recent.get(key);
    if (cached && Date.now() - cached.at < FRESH_MS && attempt === 0) {
      // Fresh enough: no request at all.
      return;
    }
    // Nothing in this tab yet: show what this device saw last, right away,
    // while the live answer loads.
    const stored = !cached && attempt === 0 ? readStored(key) : null;
    if (stored) {
      queueMicrotask(() => {
        if (live && latest.current === key) setResult((prev) => (prev?.key === key ? prev : stored));
      });
    }
    searchEvents(params)
      .then((r) => {
        if (!live || latest.current !== key) return;
        const res: Result = { key, events: r.events, isSample: r.isSample, error: null, more: Boolean(r.more), offset: limit };
        if (!r.isSample) {
          recent.set(key, { at: Date.now(), result: res });
          writeStored(key, res);
        }
        setResult(res);
      })
      .catch((e: unknown) => {
        if (!live || latest.current !== key) return;
        const fallback = recent.get(key)?.result ?? stored ?? readStored(key);
        // Keep showing the last good listings rather than an error.
        if (fallback?.events.length) setResult({ ...fallback, key, error: null });
        else setResult({ key, events: [], isSample: false, error: e instanceof Error ? e.message : "Something went wrong", more: false, offset: 0 });
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);

  // A cold API answers its first requests with errors. Retry with backoff
  // until live data arrives; until the last retry, the page stays "loading".
  const failed = !opts.skip && result?.key === key && (result.isSample || Boolean(result.error));
  const retriesLeft = attempt < RETRY_DELAYS.length;
  useEffect(() => {
    if (!failed || !retriesLeft) return;
    const t = window.setTimeout(() => setTries({ key, n: attempt + 1 }), RETRY_DELAYS[attempt]);
    return () => window.clearTimeout(t);
  }, [failed, retriesLeft, attempt, key]);

  const loadMore = async () => {
    const base = result?.key === key ? result : recent.get(key)?.result;
    if (!base || !base.more || paging) return;
    setPaging(true);
    try {
      const r = await searchEvents({ ...params, offset: base.offset });
      if (latest.current !== key) return;
      const seen = new Set(base.events.map((e) => e.id));
      const next: Result = {
        ...base,
        events: [...base.events, ...r.events.filter((e) => !seen.has(e.id))],
        more: Boolean(r.more),
        offset: base.offset + limit,
      };
      recent.set(key, { at: Date.now(), result: next });
      setResult(next);
    } catch {
      // Leave what is shown; "Show more" stays available to try again.
    } finally {
      setPaging(false);
    }
  };

  // A skipped fetch is ready at once, with nothing in it.
  const mine = result?.key === key ? result : (recent.get(key)?.result ?? null);
  const waking = Boolean(failed && retriesLeft && !mine?.events.length);
  const ready = opts.skip || (mine != null && !waking);
  return {
    events: ready && mine ? mine.events : [],
    isSample: ready && mine ? mine.isSample : false,
    error: ready && mine ? mine.error : null,
    loading: !ready,
    /** The listings API is waking up; still trying. */
    waking,
    /** The server has more events than these. */
    more: ready && mine ? mine.more : false,
    paging,
    loadMore,
    retry: () => setTries({ key, n: 0 }),
  };
}

export interface CategoryStat {
  value: EventCategory;
  count: number | null;
  capped: boolean;
  image: string | null;
}

/** Answers already fetched in this tab, by city. */
const statsSeen = new Map<string, { data: CategoryStat[]; total: number | null }>();

/**
 * Per-category counts, the city's total upcoming events, and tile
 * pictures (from /api/categories). One retry after a failure.
 */
export function useCategoryStats(cityName: string) {
  const [state, setState] = useState<{ city: string; data: CategoryStat[]; total: number | null } | null>(() => {
    const seen = statsSeen.get(cityName);
    return seen ? { city: cityName, ...seen } : null;
  });
  useEffect(() => {
    let live = true;
    const load = (tryAgain: boolean) =>
      fetch(`/api/categories?city=${encodeURIComponent(cityName)}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((j) => {
          const got = { data: j.data as CategoryStat[], total: typeof j.total === "number" ? j.total : null };
          statsSeen.set(cityName, got);
          if (live) setState({ city: cityName, ...got });
        })
        .catch(() => {
          if (!live) return;
          if (tryAgain) window.setTimeout(() => live && load(false), 3000);
          else setState((prev) => (prev?.city === cityName ? prev : { city: cityName, data: [], total: null }));
        });
    load(true);
    return () => {
      live = false;
    };
  }, [cityName]);
  return state?.city === cityName ? state : null;
}
