"use client";

import { MapPin, CaretDown } from "@phosphor-icons/react/ssr";
import { CITY_LIST } from "@/lib/cities";
import { setCity, useCity } from "@/lib/cityPref";

/** City picker. A native select underneath, so it is accessible on every device. */
export default function LocationSelector({ compact = false }: { compact?: boolean }) {
  const city = useCity();
  return (
    <label className={`loc${compact ? " is-compact" : ""}`}>
      <MapPin size={16} weight="fill" aria-hidden="true" />
      <span className="loc-name">{city.name}</span>
      <CaretDown size={12} weight="bold" aria-hidden="true" />
      <select
        value={city.name}
        onChange={(e) => setCity(e.target.value)}
        aria-label="Choose your city"
      >
        {CITY_LIST.map((c) => (
          <option key={c.name} value={c.name}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}
