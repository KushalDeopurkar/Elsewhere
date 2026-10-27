"use client";

import { Filters } from "@/lib/filters";

/**
 * Discovery shortcuts.
 *
 * Each one is a real query against parameters the API implements — date
 * windows via from_time/to_time, free_only, online_only, and a geo origin.
 * "Near me" is omitted here and lives in the location control, because it
 * needs a permission prompt rather than a single click.
 */
interface Shortcut {
  id: string;
  label: string;
  patch: Partial<Filters>;
  isActive: (f: Filters) => boolean;
}

/**
 * Date presets deliberately live in the date strip, not here — duplicating
 * them produced two competing date controls stacked on top of each other.
 * This row covers only what the strip cannot express.
 */
const SHORTCUTS: Shortcut[] = [
  {
    id: "free",
    label: "Free",
    patch: { freeOnly: true },
    isActive: (f) => f.freeOnly,
  },
  {
    id: "online",
    label: "Online",
    patch: { online: true },
    isActive: (f) => f.online === true,
  },
  {
    id: "in-person",
    label: "In person",
    patch: { online: false },
    isActive: (f) => f.online === false,
  },
];

export default function ShortcutRow({
  filters,
  onChange,
}: {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
}) {
  return (
    <div className="chip-row scrollbar-hide" aria-label="Discovery shortcuts">
      {SHORTCUTS.map((s) => {
        const active = s.isActive(filters);
        return (
          <button
            key={s.id}
            type="button"
            className="chip"
            aria-pressed={active}
            onClick={() => {
              // Pressing an active shortcut clears it, so each chip is a
              // toggle rather than a one-way trip.
              if (!active) {
                onChange(s.patch);
                return;
              }
              if (s.id === "free") onChange({ freeOnly: false });
              else onChange({ online: null });
            }}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
