"use client";

import { useState } from "react";
import { MapPin, CaretDown } from "@phosphor-icons/react/ssr";
import { INDIA_LIST, WORLD_LIST } from "@/lib/cities";
import { pickCity, useCity } from "@/lib/cityPref";
import { useActiveCities } from "@/lib/activeCities";

/**
 * City picker. A native select underneath, so it is accessible on every device.
 *
 * A native select fires no change when you pick the option that's already
 * selected, so while the menu is open by pointer the select holds a blank
 * value: any pick, even the current city, then registers (the map uses that
 * to fly back to the city after you've dragged away). Keyboard use is the
 * plain select, unchanged.
 */
export default function LocationSelector({ compact = false }: { compact?: boolean }) {
  const city = useCity();
  const [open, setOpen] = useState(false);
  // Only offer cities abroad that have events on (plus the one you're in).
  const active = useActiveCities();
  const world = WORLD_LIST.filter((c) => !active || active.has(c.name) || c.name === city.name);
  return (
    <label className={`loc${compact ? " is-compact" : ""}`}>
      <MapPin size={16} weight="fill" aria-hidden="true" />
      <span className="loc-name">{city.name}</span>
      <CaretDown size={12} weight="bold" aria-hidden="true" />
      <select
        value={open ? "" : city.name}
        onPointerDown={() => setOpen(true)}
        onChange={(e) => {
          setOpen(false);
          if (e.target.value) pickCity(e.target.value);
        }}
        onBlur={() => setOpen(false)}
        onKeyDown={() => setOpen(false)}
        aria-label="Choose your city"
      >
        {open && <option value="" hidden disabled />}
        <optgroup label="India">
          {INDIA_LIST.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name}
            </option>
          ))}
        </optgroup>
        {world.length > 0 && (
        <optgroup label="Around the world">
          {world.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name}
            </option>
          ))}
        </optgroup>
        )}
      </select>
    </label>
  );
}
