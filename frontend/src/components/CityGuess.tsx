"use client";

import { useEffect, useState } from "react";
import { MapPin, X } from "@phosphor-icons/react/ssr";
import { cityFromZone, nearestCity } from "@/lib/cityGuess";
import { setCity } from "@/lib/cityPref";
import { CITY_LIST } from "@/lib/cities";

const CHOSEN = "ee.city.v1";
const TRIED = "ee.city.guessed";

/**
 * First visit only: start in the visitor's own city instead of Mumbai.
 * Tries Vercel's city-level IP lookup, then the browser's time zone, and
 * picks the nearest city that has events on right now, however far (someone
 * in Nagpur starts in Indore, not Mumbai). Says so in a small note, and never
 * runs again once a city is set.
 */
export default function CityGuess() {
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(CHOSEN) ?? localStorage.getItem(TRIED);
      localStorage.setItem(TRIED, "1");
    } catch {
      return;
    }
    if (stored) return;
    let live = true;
    (async () => {
      // Where the visitor is (IP lookup, city level) and which cities have
      // events right now, side by side.
      const [at, active] = await Promise.all([
        fetch("/api/whereami", { signal: AbortSignal.timeout(2500) })
          .then((r) => (r.ok ? (r.json() as Promise<{ lat: number; lng: number } | null>) : null))
          .catch(() => null),
        fetch("/api/cities", { signal: AbortSignal.timeout(4000) })
          .then((r) => (r.ok ? (r.json() as Promise<{ active: string[] | null }>) : null))
          .then((d) => d?.active ?? null)
          .catch(() => null),
      ]);
      // Only cities that would open with something on (all of them if unknown).
      const pool = active ? CITY_LIST.filter((c) => active.includes(c.name)) : CITY_LIST;
      let from: { lat: number; lng: number } | null = at;
      if (!from) {
        // No IP location: the browser's time zone, when it names a city.
        const zoned = CITY_LIST.find((c) => c.name === cityFromZone(Intl.DateTimeFormat().resolvedOptions().timeZone));
        if (zoned) from = zoned;
      }
      if (!from || !pool.length) return;
      // The visitor's own city if we cover it, else the nearest one that does.
      const name = nearestCity(from.lat, from.lng, Infinity, pool)?.name ?? null;
      if (!name || name === "Mumbai") return;
      if (!live) return;
      setCity(name, { quiet: true });
      setNote(name);
    })();
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!note) return;
    const t = window.setTimeout(() => setNote(null), 7000);
    return () => window.clearTimeout(t);
  }, [note]);

  if (!note) return null;
  return (
    <div className="city-note" role="status">
      <MapPin size={16} weight="fill" aria-hidden="true" />
      <span>
        Showing events in <strong>{note}</strong>. Change city anytime at the top.
      </span>
      <button type="button" aria-label="Dismiss" onClick={() => setNote(null)}>
        <X size={14} weight="bold" />
      </button>
    </div>
  );
}
