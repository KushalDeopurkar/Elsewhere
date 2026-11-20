"use client";

import { ArrowRight } from "@phosphor-icons/react";
import { useActiveCities } from "@/lib/activeCities";
import { CITY_LIST, type CityPoint } from "@/lib/cities";
import { nearbyCities } from "@/lib/cityGuess";
import { pickCity } from "@/lib/cityPref";

/**
 * The name, taken literally: when a city has nothing for what you asked,
 * offer the nearest cities that do have listings, one tap each.
 */
export default function TryElsewhere({ city, lead = "Nothing here? Try elsewhere." }: { city: CityPoint; lead?: string }) {
  const active = useActiveCities();
  // India's cities are always listed; abroad, only cities with events now.
  const pool = CITY_LIST.filter((c) => !c.country || c.country === "IN" || !active || active.has(c.name));
  const near = nearbyCities(city, 3, pool);
  if (near.length === 0) return null;
  return (
    <div className="elsewhere-try" role="group" aria-label="Try a nearby city">
      <p className="elsewhere-try-lead">{lead}</p>
      <ul>
        {near.map((c) => (
          <li key={c.name}>
            <button type="button" className="elsewhere-try-btn" onClick={() => pickCity(c.name)}>
              {c.name} <ArrowRight size={14} weight="bold" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
