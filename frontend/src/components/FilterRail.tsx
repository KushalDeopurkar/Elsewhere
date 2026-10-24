"use client";

import { CATEGORIES, EventCategory } from "@/lib/types";
import { getCategoryColor } from "@/lib/categoryColors";

export type TimeWindow = "any" | "today" | "tomorrow" | "weekend";

const WINDOWS: { value: TimeWindow; label: string }[] = [
  { value: "any", label: "Any time" },
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "weekend", label: "This weekend" },
];

export function TimeRail({
  value,
  onChange,
}: {
  value: TimeWindow;
  onChange: (next: TimeWindow) => void;
}) {
  return (
    <div className="rail no-scrollbar" role="group" aria-label="Filter by date">
      {WINDOWS.map((w) => (
        <button
          key={w.value}
          type="button"
          className="chip"
          aria-pressed={value === w.value}
          onClick={() => onChange(w.value)}
        >
          {w.label}
        </button>
      ))}
    </div>
  );
}

export function CategoryRail({
  value,
  onChange,
}: {
  value: EventCategory | null;
  onChange: (next: EventCategory | null) => void;
}) {
  return (
    <div className="rail no-scrollbar" role="tablist" aria-label="Filter by category">
      <button
        type="button"
        role="tab"
        className="chip"
        aria-selected={value === null}
        onClick={() => onChange(null)}
      >
        Everything
      </button>
      {CATEGORIES.filter((c) => c.value !== "other").map((cat) => (
        <button
          key={cat.value}
          type="button"
          role="tab"
          className="chip"
          aria-selected={value === cat.value}
          onClick={() => onChange(value === cat.value ? null : cat.value)}
          style={
            { "--chip-hue": getCategoryColor(cat.value).color } as React.CSSProperties
          }
        >
          <span className="chip-dot" aria-hidden="true" />
          {cat.label}
        </button>
      ))}
    </div>
  );
}
