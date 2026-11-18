/**
 * Group events into "nights" for the filmstrip Explore: Tonight, Tomorrow,
 * then one row per date ("Sat 21 Nov"). Days are IST calendar days.
 */
import type { Event } from "./types";

export interface Night {
  key: string; // yyyy-mm-dd in IST
  label: string;
  events: Event[];
}

const KEY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" });
const LABEL = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short" });

export function groupByNight(events: Event[], now: number, opts: { night?: boolean } = {}): Night[] {
  const today = KEY.format(new Date(now));
  const tomorrow = KEY.format(new Date(now + 86_400_000));
  const map = new Map<string, Event[]>();
  for (const e of events) {
    const k = KEY.format(new Date(Date.parse(e.start_time)));
    // Anything already running from earlier days counts as today.
    const key = k < today ? today : k;
    const list = map.get(key) ?? [];
    list.push(e);
    map.set(key, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, list]) => ({
      key,
      label: key === today ? (opts.night ? "Tonight" : "Today") : key === tomorrow ? "Tomorrow" : LABEL.format(new Date(`${key}T12:00:00+05:30`)),
      events: list,
    }));
}
