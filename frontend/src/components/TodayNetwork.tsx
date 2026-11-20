"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Event, EventCategory } from "@/lib/types";
import { CATEGORIES } from "@/lib/types";
import { getCategoryColor } from "@/lib/categoryColors";
import { eventZone } from "@/lib/formatDate";

/**
 * The next day and a half in the city, drawn as a line map: each kind of
 * event that has something on is a line, each event a stop on it, in time
 * order from left to right. Every stop is a real listing and opens it.
 * The lines bundle through the middle like lines through a central
 * interchange; the geometry is fixed (0° and 45° only), the data is live.
 */

const W = 520;
const H = 300;
const MAX_LINES = 5;
const MAX_STOPS = 5;
const WINDOW_MS = 36 * 3_600_000;

const SHORT: Partial<Record<EventCategory, string>> = {
  tech: "Tech", business: "Startups", education: "Learning", arts: "Arts", sports: "Sports",
  music: "Music", community: "Community", food: "Food", health: "Wellbeing", outdoor: "Outdoors",
  family: "Family", nightlife: "Nightlife", other: "Other",
};

interface Stop {
  event: Event;
  x: number;
  y: number;
}
interface Drawn {
  cat: EventCategory;
  color: string;
  label: string;
  path: string;
  stops: Stop[];
  count: number;
  labelY: number;
}

/** Points along a polyline at fractions of its length. */
function along(points: [number, number][], fractions: number[]): [number, number][] {
  const segs = points.slice(1).map((p, i) => Math.hypot(p[0] - points[i][0], p[1] - points[i][1]));
  const total = segs.reduce((a, b) => a + b, 0);
  return fractions.map((f) => {
    let left = f * total;
    for (let i = 0; i < segs.length; i++) {
      if (left <= segs[i] || i === segs.length - 1) {
        const t = segs[i] ? Math.min(1, left / segs[i]) : 0;
        return [points[i][0] + (points[i + 1][0] - points[i][0]) * t, points[i][1] + (points[i + 1][1] - points[i][1]) * t];
      }
      left -= segs[i];
    }
    return points[points.length - 1];
  });
}

function draw(events: Event[], now: number): Drawn[] {
  const soon = events
    .filter((e) => {
      const t = Date.parse(e.start_time);
      const end = e.end_time ? Date.parse(e.end_time) : t + 3 * 3_600_000;
      return end > now && t < now + WINDOW_MS && e.lat != null;
    })
    .sort((a, b) => Date.parse(a.start_time) - Date.parse(b.start_time));
  const byCat = new Map<EventCategory, Event[]>();
  for (const e of soon) byCat.set(e.category, [...(byCat.get(e.category) ?? []), e]);
  const lines = [...byCat.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, MAX_LINES);
  const n = lines.length;
  if (n === 0) return [];
  const top = 46;
  const span = H - top - 40;
  return lines.map(([cat, list], i) => {
    const y = n === 1 ? H / 2 : top + (span * i) / (n - 1);
    // Through the interchange the lines run close together, 12px apart.
    const yc = H / 2 - ((n - 1) * 12) / 2 + i * 12;
    const dy = Math.abs(yc - y);
    const pts: [number, number][] = [
      [24, y],
      [120, y],
      [120 + dy, yc],
      [W - 120 - dy, yc],
      [W - 120, y],
      [W - 24, y],
    ];
    const shown = list.slice(0, MAX_STOPS);
    const fr = shown.length === 1 ? [0.5] : shown.map((_, k) => 0.06 + (0.88 * k) / (shown.length - 1));
    const at = along(pts, fr);
    return {
      cat,
      color: getCategoryColor(cat).color,
      label: SHORT[cat] ?? cat,
      path: pts.map((p, k) => `${k ? "L" : "M"}${p[0]},${p[1]}`).join(" "),
      stops: shown.map((event, k) => ({ event, x: at[k][0], y: at[k][1] })),
      count: list.length,
      labelY: y,
    };
  });
}

const timeIn = (e: Event) =>
  new Intl.DateTimeFormat("en-IN", { timeZone: eventZone(e), hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(
    new Date(e.start_time),
  );

export default function TodayNetwork({ events, now }: { events: Event[]; now: number }) {
  const lines = useMemo(() => (now ? draw(events, now) : []), [events, now]);
  const [focus, setFocus] = useState<Event | null>(null);
  if (lines.length < 2) return null;
  const total = lines.reduce((a, l) => a + l.count, 0);
  const label = (cat: EventCategory) => CATEGORIES.find((c) => c.value === cat)?.label ?? cat;

  return (
    <figure className="tnet">
      <figcaption className="tnet-head">
        <span className="tt-kicker-code">Network</span> Next 36 hours, by line
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="tnet-map" role="group" aria-label={`${total} events in the next 36 hours, on ${lines.length} lines`}>
        {lines.map((l) => (
          <g key={l.cat}>
            <path d={l.path} fill="none" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" style={{ stroke: l.color }} />
            <text x={24} y={l.labelY - 12} className="tnet-line" style={{ fill: l.color }}>
              {l.label}
            </text>
            <text x={W - 24} y={l.labelY - 12} textAnchor="end" className="tnet-count">
              {l.count}
            </text>
          </g>
        ))}
        {lines.map((l) =>
          l.stops.map((s) => (
            <Link
              key={s.event.id}
              href={`/events/${s.event.id}`}
              aria-label={`${s.event.title}, ${timeIn(s.event)}, ${label(l.cat)}`}
              onMouseEnter={() => setFocus(s.event)}
              onFocus={() => setFocus(s.event)}
              onMouseLeave={() => setFocus(null)}
              onBlur={() => setFocus(null)}
            >
              <circle cx={s.x} cy={s.y} r={14} className="tnet-hit" />
              <circle
                cx={s.x}
                cy={s.y}
                r={focus?.id === s.event.id ? 9 : 7}
                strokeWidth={4}
                className="tnet-stop"
                style={{ stroke: l.color }}
              />
            </Link>
          )),
        )}
      </svg>
      <p className="tnet-caption" aria-live="polite">
        {focus ? (
          <>
            <b>{timeIn(focus)}</b> {focus.title}
            {focus.location_name ? <span> · {focus.location_name}</span> : null}
          </>
        ) : (
          "Every stop is an event. Point at one, or open it."
        )}
      </p>
    </figure>
  );
}
