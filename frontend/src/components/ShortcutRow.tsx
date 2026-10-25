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

const SHORTCUTS: Shortcut[] = [
  {
    id: "today",
    label: "Today",
    patch: { date: "today" },
    isActive: (f) => f.date === "today",
  },
  {
    id: "weekend",
    label: "This weekend",
    patch: { date: "weekend" },
    isActive: (f) => f.date === "weekend",
  },
  {
    id: "week",
    label: "Next 7 days",
    patch: { date: "week" },
    isActive: (f) => f.date === "week",
  },
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
              else if (s.id === "online" || s.id === "in-person") onChange({ online: null });
              else onChange({ date: "any" });
            }}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
