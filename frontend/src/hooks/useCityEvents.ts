"use client";

import { useEffect, useRef, useState } from "react";
import { searchEvents } from "@/lib/api";
import type { Event, EventCategory } from "@/lib/types";
import type { CityPoint } from "@/lib/cities";

const RETRY_DELAYS = [3000, 8000, 15000];

interface Result {
  key: string;
  events: Event[];
  isSample: boolean;
  error: string | null;
}

/**
 * Upcoming events around a city from the existing search API, refetched when
 * the city, category or query changes. A newer request always wins.
 */
export function useCityEvents(
  city: CityPoint,
  opts: { category?: EventCategory | null; q?: string; limit?: number } = {},
) {
  const key = `${city.name}|${opts.category ?? ""}|${opts.q ?? ""}|${opts.limit ?? 100}`;
  const [result, setResult] = useState<Result | null>(null);
  const [nonce, setNonce] = useState(0);
  const latest = useRef(key);

  useEffect(() => {
    latest.current = key;
    let live = true;
    searchEvents({
      lat: city.lat,
      lng: city.lng,
      radius_km: 40,
      limit: opts.limit ?? 100,
      category: opts.category ?? undefined,
      q: opts.q || undefined,
    })
      .then((r) => {
        if (live && latest.current === key) setResult({ key, events: r.events, isSample: r.isSample, error: null });
      })
      .catch((e: unknown) => {
        if (live && latest.current === key)
          setResult({ key, events: [], isSample: false, error: e instanceof Error ? e.message : "Something went wrong" });
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, nonce]);

  // A cold API answers its first requests with errors, which drops us to
  // the bundled sample set. Retry with backoff until live data arrives.
  const attempt = useRef(0);
  useEffect(() => {
    attempt.current = 0;
  }, [key]);
  const failed = result?.key === key && (result.isSample || Boolean(result.error));
  useEffect(() => {
    if (!failed || attempt.current >= RETRY_DELAYS.length) return;
    const t = window.setTimeout(() => setNonce((n) => n + 1), RETRY_DELAYS[attempt.current]);
    attempt.current += 1;
    return () => window.clearTimeout(t);
  }, [failed, result]);

  const ready = result?.key === key;
  return {
    events: ready ? result.events : [],
    isSample: ready ? result.isSample : false,
    error: ready ? result.error : null,
    loading: !ready,
    retry: () => setNonce((n) => n + 1),
  };
}

export interface CategoryStat {
  value: EventCategory;
  count: number | null;
  capped: boolean;
  image: string | null;
}

/** Per-category counts and tile pictures for a city (from /api/categories). */
export function useCategoryStats(cityName: string) {
  const [state, setState] = useState<{ city: string; data: CategoryStat[] } | null>(null);
  useEffect(() => {
    let live = true;
    fetch(`/api/categories?city=${encodeURIComponent(cityName)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j) => {
        if (live) setState({ city: cityName, data: j.data as CategoryStat[] });
      })
      .catch(() => {
        if (live) setState({ city: cityName, data: [] });
      });
    return () => {
      live = false;
    };
  }, [cityName]);
  return state?.city === cityName ? state.data : null;
}
