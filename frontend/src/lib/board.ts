/**
 * The home "departures board": tonight's (or tomorrow's, or the weekend's)
 * real events as board rows. Pure, so the rows and their status words are
 * testable. Status is only ever a fact we hold: on now, a countdown to a
 * real start time, or the price.
 */
import type { Event } from "./types";
import { hasTime, matchesWindow } from "./formatDate";
import { priceBadge } from "./money";
import { formatSpan } from "./countdown";

export type BoardTab = "today" | "tomorrow" | "weekend";

export interface BoardRow {
  event: Event;
  time: string; // "21:00" or "ALL DAY"
  day: string; // "SAT" for weekend rows, "" otherwise
  title: string;
  area: string;
  status: string;
  tone: "live" | "soon" | "free" | "price";
}

const HHMM = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const DOW = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", weekday: "short" });

// Date-only listings (midnight IST) run for the whole day.
const endOf = (e: Event) =>
  e.end_time ? Date.parse(e.end_time) : Date.parse(e.start_time) + (hasTime(e.start_time) ? 3 : 24) * 3_600_000;

export function rowFor(e: Event, tab: BoardTab, now: number): BoardRow {
  const s = Date.parse(e.start_time);
  const timed = hasTime(e.start_time);
  const live = timed && s <= now && now < endOf(e) && endOf(e) - s <= 12 * 3_600_000;
  const soon = timed && s > now && s - now <= 3 * 3_600_000;
  const price = priceBadge(e);
  const free = /free/i.test(price);
  return {
    event: e,
    time: timed ? HHMM.format(new Date(s)) : "ALL DAY",
    day: tab === "weekend" ? DOW.format(new Date(s)).toUpperCase() : "",
    title: e.title,
    area: (e.location_name || e.city || "").trim(),
    status: live ? "ON NOW" : soon ? `IN ${formatSpan(s - now).toUpperCase()}` : free ? "FREE" : price.toUpperCase(),
    tone: live ? "live" : soon ? "soon" : free ? "free" : "price",
  };
}

/** Rows for a tab: upcoming or running, soonest first; untimed listings last. */
export function boardRows(events: Event[], tab: BoardTab, now: number): BoardRow[] {
  const seen = new Set<string>();
  return events
    .filter((e) => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return endOf(e) > now && matchesWindow(e.start_time, tab, new Date(now));
    })
    .sort((a, b) => {
      const ta = hasTime(a.start_time) ? 0 : 1;
      const tb = hasTime(b.start_time) ? 0 : 1;
      return ta - tb || Date.parse(a.start_time) - Date.parse(b.start_time);
    })
    .map((e) => rowFor(e, tab, now));
}

/** Split into board pages of `size` rows. */
export function pages<T>(rows: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}
