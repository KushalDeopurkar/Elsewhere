/**
 * Map time scrubber: which events are on, or about to start, at a moment in
 * the coming week, and how busy each part of the week is. Pure.
 */
import type { Event } from "./types";

export const HOUR = 3_600_000;
export const WEEK_HOURS = 7 * 24;
/** Events with no end time are treated as lasting this long. */
export const DEFAULT_LENGTH = 2 * HOUR;
/** "About to start" look-ahead from the scrubbed moment. */
export const SOON = 3 * HOUR;

export type AtStatus = "live" | "soon";

/** A zone's offset from UTC at an instant, in ms (India: +5:30). */
export function zoneOffset(zone: string, at: number): number {
  if (zone === "Asia/Kolkata") return 5.5 * HOUR;
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: zone, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hourCycle: "h23",
  }).formatToParts(at);
  const g = (t: string) => +(p.find((x) => x.type === t)?.value ?? 0);
  const wall = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour") % 24, g("minute"), g("second"));
  return wall - Math.floor(at / 1000) * 1000;
}

/** Start of the timeline: the current local hour, so the slider's 0 is "now". */
export function timelineStart(now: number, zone = "Asia/Kolkata"): number {
  const off = zoneOffset(zone, now);
  return Math.floor((now + off) / HOUR) * HOUR - off;
}

function endOf(e: Event): number {
  const start = Date.parse(e.start_time);
  const end = e.end_time ? Date.parse(e.end_time) : NaN;
  // Multi-day listings (festivals, exhibitions) cap at 12 h per showing so
  // the map does not light up with them at every hour of the week.
  return Number.isFinite(end) && end > start ? Math.min(end, start + 12 * HOUR) : start + DEFAULT_LENGTH;
}

export function statusAt(e: Event, t: number): AtStatus | null {
  const start = Date.parse(e.start_time);
  if (start <= t && t < endOf(e)) return "live";
  if (start > t && start - t <= SOON) return "soon";
  return null;
}

export function eventsAt(events: Event[], t: number): { events: Event[]; live: Set<string> } {
  const out: Event[] = [];
  const live = new Set<string>();
  for (const e of events) {
    const s = statusAt(e, t);
    if (!s) continue;
    out.push(e);
    if (s === "live") live.add(e.id);
  }
  return { events: out, live };
}

/** Events starting in each bucket of `bucketHours`, across the week. */
export function busyness(events: Event[], start: number, bucketHours = 3): number[] {
  const buckets = new Array(Math.ceil(WEEK_HOURS / bucketHours)).fill(0);
  for (const e of events) {
    const i = Math.floor((Date.parse(e.start_time) - start) / (bucketHours * HOUR));
    if (i >= 0 && i < buckets.length) buckets[i]++;
  }
  return buckets;
}

/** "Now", "Tonight 9 pm", "Sat 11 am": short label in local time. */
export function momentLabel(t: number, now: number, zone = "Asia/Kolkata"): string {
  if (t - timelineStart(now, zone) < HOUR) return "Now";
  const day = (x: number) => new Date(x).toLocaleDateString("en-CA", { timeZone: zone });
  const time = new Date(t)
    .toLocaleTimeString("en-IN", { timeZone: zone, hour: "numeric", hour12: true })
    .replace(/\s/g, " ")
    .toLowerCase();
  const hour = Number(new Date(t).toLocaleString("en-GB", { timeZone: zone, hour: "numeric", hourCycle: "h23" }));
  if (day(t) === day(now)) return `${hour >= 17 ? "Tonight" : "Today"} ${time}`;
  if (day(t) === day(now + 24 * HOUR)) return `Tomorrow ${time}`;
  const wd = new Date(t).toLocaleDateString("en-IN", { timeZone: zone, weekday: "short" });
  return `${wd} ${time}`;
}
