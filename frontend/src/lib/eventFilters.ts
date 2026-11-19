/**
 * Client-side filtering and sorting shared by Explore, category pages and the
 * homepage rails. Times are judged in IST, like the rest of the site.
 */

import { kmBetween } from "./geo";
import { Event } from "./types";
import { matchesWindow, eventZone, timedOf } from "./formatDate";

export type DateFilter = "any" | "today" | "tomorrow" | "weekend" | "week";
export type PriceFilter = "any" | "free" | "paid";
export type SortKey = "relevance" | "soonest" | "price" | "distance";

const DAY = 86_400_000;

export function inDateWindow(e: Event, when: DateFilter, now = Date.now()): boolean {
  if (when === "any") return true;
  if (when === "week") {
    const t = Date.parse(e.start_time);
    return t >= now - 2 * 3_600_000 && t <= now + 7 * DAY;
  }
  return matchesWindow(e.start_time, when, undefined, eventZone(e));
}

export function inPrice(e: Event, price: PriceFilter): boolean {
  if (price === "free") return e.is_free;
  if (price === "paid") return !e.is_free;
  return true;
}

export function sortEvents(events: Event[], key: SortKey): Event[] {
  const list = [...events];
  if (key === "soonest") list.sort((a, b) => Date.parse(a.start_time) - Date.parse(b.start_time));
  if (key === "price") {
    const p = (e: Event) => (e.is_free ? 0 : e.price_min ?? Number.MAX_SAFE_INTEGER);
    list.sort((a, b) => p(a) - p(b));
  }
  if (key === "distance") {
    list.sort((a, b) => (a.distance_km ?? Infinity) - (b.distance_km ?? Infinity));
  }
  return list;
}

/** The same listing scraped from two sites: same title, same start minute, same city. */
const sameListing = (e: Event) =>
  `${e.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}|${e.start_time.slice(0, 16)}|${(e.city ?? "").toLowerCase()}`;

/**
 * Upcoming only, without duplicates (by id, and the same listing posted on
 * two sites) and without listings whose own title says they're cancelled.
 * Events with an unreadable start time are dropped rather than misplaced.
 */
export function upcoming(events: Event[], now = Date.now()): Event[] {
  const seen = new Set<string>();
  return events.filter((e) => {
    const start = Date.parse(e.start_time);
    if (Number.isNaN(start)) return false;
    const twin = sameListing(e);
    if (seen.has(e.id) || seen.has(twin)) return false;
    seen.add(e.id);
    seen.add(twin);
    if (listingStatus(e) === "cancelled") return false;
    const end = e.end_time ? Date.parse(e.end_time) : start + 3 * 3_600_000;
    return (Number.isNaN(end) ? start + 3 * 3_600_000 : end) >= now;
  });
}

/**
 * What the listing itself says about its status. There is no status column,
 * so only an explicit word in the title counts; nothing is guessed.
 */
export function listingStatus(e: Pick<Event, "title">): "cancelled" | "postponed" | "sold out" | null {
  const t = e.title.toLowerCase();
  if (/\b(cancelled|canceled)\b/.test(t)) return "cancelled";
  if (/\bpostponed\b/.test(t)) return "postponed";
  if (/\bsold[\s-]?out\b/.test(t)) return "sold out";
  return null;
}

/** Events worth putting in a large slot: a real picture and a real time. */
export function showcase(events: Event[]): Event[] {
  return events.filter((e) => Boolean(e.image_url) && timedOf(e));
}

export function textMatch(e: Event, words: string[]): boolean {
  const hay = `${e.title} ${e.description ?? ""}`.toLowerCase();
  return words.some((w) => hay.includes(w));
}

/**
 * Events on right now or starting within the next few hours, each with a
 * short live badge. Multi-day runs (exhibitions, fests) are left out: "on
 * now" should mean you can walk in to something happening this evening.
 */
export function startingSoon(events: Event[], hours = 3, now = Date.now()): { event: Event; badge: string }[] {
  const out: { event: Event; badge: string; at: number }[] = [];
  for (const e of events) {
    if (!timedOf(e)) continue;
    const start = Date.parse(e.start_time);
    const end = e.end_time ? Date.parse(e.end_time) : start + 2 * 3_600_000;
    if (start <= now && end > now && end - start <= 8 * 3_600_000) {
      out.push({ event: e, badge: "On now", at: start });
    } else if (start > now && start - now <= hours * 3_600_000) {
      const min = Math.max(1, Math.round((start - now) / 60_000));
      const label = min < 60 ? `${min} min` : `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ""}`;
      out.push({ event: e, badge: `Starts in ${label}`, at: start });
    }
  }
  return out.sort((a, b) => a.at - b.at).map(({ event, badge }) => ({ event, badge }));
}

export type FormatFilter = "any" | "in_person" | "online";

/**
 * Online or not. The API has no format column yet, so a listing counts as
 * online when it says so, or when its venue is literally "Online".
 */
export function isOnline(e: Event): boolean {
  if (e.format === "online") return true;
  const place = `${e.location_name ?? ""} ${e.city ?? ""}`.toLowerCase();
  return /\bonline\b/.test(place);
}

export function inFormat(e: Event, format: FormatFilter): boolean {
  if (format === "any") return true;
  return format === "online" ? isOnline(e) : !isOnline(e);
}

/** Within `km` of a point; online events and listings without coordinates always pass. */
export function withinKm(e: Event, km: number | null, lat: number, lng: number): boolean {
  if (km == null || isOnline(e) || e.lat == null || e.lng == null) return true;
  return kmBetween(lat, lng, e.lat, e.lng) <= km;
}
