"use client";

import { useMemo } from "react";
import { Filters, toDayKey } from "@/lib/filters";

/**
 * Horizontal day navigator.
 *
 * Event discovery is overwhelmingly date-led — "what's on tonight", "what's
 * on Saturday" — so the calendar is promoted to a primary, always-visible
 * control rather than being buried inside a filter panel. Picking a day is a
 * real query: it resolves to an exact from_time/to_time window.
 */
const DAYS_SHOWN = 21;

export default function DateStrip({
  filters,
  now,
  onChange,
}: {
  filters: Filters;
  now: Date;
  onChange: (patch: Partial<Filters>) => void;
}) {
  const days = useMemo(() => {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Array.from({ length: DAYS_SHOWN }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return {
        key: toDayKey(d),
        weekday: d.toLocaleDateString("en-US", { weekday: "short" }),
        day: d.toLocaleDateString("en-US", { day: "numeric" }),
        month: d.toLocaleDateString("en-US", { month: "short" }),
        isToday: i === 0,
        isWeekend: d.getDay() === 0 || d.getDay() === 6,
        // A month label is drawn whenever the month changes along the strip.
        startsMonth: i === 0 || d.getDate() === 1,
      };
    });
  }, [now]);

  return (
    <div className="datestrip-wrap">
      <div
        className="datestrip scrollbar-hide"
        role="group"
        aria-label="Jump to a day"
      >
        <button
          type="button"
          className="datecell datecell-any"
          aria-pressed={filters.day === null && filters.date === "any"}
          onClick={() => onChange({ day: null, date: "any" })}
        >
          <span className="datecell-weekday">All</span>
          <span className="datecell-anylabel">dates</span>
        </button>

        {days.map((d) => (
          <button
            key={d.key}
            type="button"
            className={`datecell${d.isWeekend ? " is-weekend" : ""}${
              d.startsMonth ? " starts-month" : ""
            }`}
            aria-pressed={filters.day === d.key}
            aria-label={`${d.weekday} ${d.month} ${d.day}`}
            onClick={() =>
              onChange({ day: filters.day === d.key ? null : d.key, date: "any" })
            }
          >
            <span className="datecell-weekday">
              {d.isToday ? "Today" : d.weekday}
            </span>
            <span className="datecell-day numeric">{d.day}</span>
            {d.startsMonth && <span className="datecell-month">{d.month}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
