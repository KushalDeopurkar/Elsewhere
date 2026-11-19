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
 * Tries Vercel's city-level IP lookup, then the browser's time zone; picks
 * the nearest city we cover (skipping ones abroad with nothing on), says so
 * in a small note, and never runs again once a city is set.
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
      let name: string | null = null;
      try {
        const r = await fetch("/api/whereami", { signal: AbortSignal.timeout(2500) });
        const at = r.ok ? ((await r.json()) as { lat: number; lng: number } | null) : null;
        if (at) name = nearestCity(at.lat, at.lng)?.name ?? null;
      } catch {
        /* fall back to the time zone */
      }
      name ??= cityFromZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
      if (!name || name === "Mumbai" || !live) return;
      // Abroad, only switch if that city has events right now.
      try {
        const r = await fetch("/api/cities");
        const d = r.ok ? ((await r.json()) as { active: string[] | null }) : { active: null };
        const abroad = Boolean(CITY_LIST.find((c) => c.name === name)?.country);
        if (abroad && d.active && !d.active.includes(name)) return;
      } catch {
        /* unknown: switch anyway */
      }
      if (!live) return;
      setCity(name);
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
