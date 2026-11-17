/**
 * Picks the "This weekend" stories: up to 10 events with a real picture and
 * a real time, weekend first (topped up from the coming week), spread across
 * categories so the reel is not ten comedy nights in a row.
 */
import type { Event } from "./types";
import { inDateWindow, showcase, sortEvents } from "./eventFilters";

export function pickStories(events: Event[], max = 10, now = Date.now()): { events: Event[]; label: string } {
  const pool = showcase(events);
  const weekend = sortEvents(pool.filter((e) => inDateWindow(e, "weekend", now)), "soonest");
  const week = sortEvents(pool.filter((e) => inDateWindow(e, "week", now)), "soonest");
  const base = weekend.length >= 4 ? weekend : [...weekend, ...week.filter((e) => !weekend.includes(e))];
  const label = weekend.length >= 4 ? "This weekend" : "This week";

  // Round-robin by category, keeping each category's soonest first.
  const byCat = new Map<string, Event[]>();
  for (const e of base) {
    const list = byCat.get(e.category) ?? [];
    list.push(e);
    byCat.set(e.category, list);
  }
  const queues = [...byCat.values()];
  const out: Event[] = [];
  while (out.length < max && queues.some((q) => q.length)) {
    for (const q of queues) {
      const e = q.shift();
      if (e) out.push(e);
      if (out.length >= max) break;
    }
  }
  // Keep the reel in time order once it is diverse.
  return { events: sortEvents(out, "soonest"), label };
}
