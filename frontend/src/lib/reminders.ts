/**
 * What a reminder for a saved event says and when it goes out. Pure, so the
 * browser and the server agree, and it can be tested.
 */

import { Event } from "./types";
import { hasTime } from "./formatDate";
import { zoneOf } from "./cities";

/** How long before a timed event its reminder arrives. */
export const LEAD_MS = 2 * 60 * 60 * 1000;
/** Date-only events: a morning nudge on the day (local time). */
const MORNING_MS = 9 * 60 * 60 * 1000;
/** Most reminders one device can hold. */
export const MAX_REMINDERS = 60;
/** Reminders further out than this are skipped (re-synced later). */
export const HORIZON_MS = 60 * 24 * 60 * 60 * 1000;

export interface Reminder {
  event_id: string;
  remind_at: string;
  title: string;
  body: string;
  url: string;
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** The reminder for one event, or null when its moment has already passed. */
export function reminderFor(e: Event, now = Date.now()): Reminder | null {
  const start = Date.parse(e.start_time);
  if (!Number.isFinite(start)) return null;
  const zone = zoneOf(e);
  const timed = hasTime(e.start_time, zone);
  const at = timed ? start - LEAD_MS : start + MORNING_MS;
  if (at <= now || at - now > HORIZON_MS) return null;

  const time = timed
    ? new Intl.DateTimeFormat("en-IN", { timeZone: zone, hour: "numeric", minute: "2-digit", hour12: true }).format(start)
    : null;
  const place = e.location_name?.trim() || e.city?.trim() || "";
  return {
    event_id: String(e.id).slice(0, 100),
    remind_at: new Date(at).toISOString(),
    title: clip(timed ? `In 2 hours: ${e.title}` : `Today: ${e.title}`, 120),
    body: clip([place, time ? `starts ${time}` : ""].filter(Boolean).join(" · "), 200),
    url: `/events/${encodeURIComponent(String(e.id))}`,
  };
}

/** Reminders for a saved list, soonest first, capped. */
export function remindersFor(events: Event[], now = Date.now()): Reminder[] {
  return events
    .map((e) => reminderFor(e, now))
    .filter((r): r is Reminder => r !== null)
    .sort((a, b) => a.remind_at.localeCompare(b.remind_at))
    .slice(0, MAX_REMINDERS);
}

/** A stable fingerprint, so the browser only re-syncs when something changed. */
export function reminderKey(list: Reminder[]): string {
  return list.map((r) => `${r.event_id}@${r.remind_at}`).join("|");
}
