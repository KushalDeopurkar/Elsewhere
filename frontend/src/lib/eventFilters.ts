/**
 * Client-side filtering and sorting shared by Explore, category pages and the
 * homepage rails. Times are judged in IST, like the rest of the site.
 */

import { Event } from "./types";
import { hasTime, matchesWindow } from "./formatDate";

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
  return matchesWindow(e.start_time, when);
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

/** Upcoming only, de-duplicated by id, with a picture-first bias for showcases. */
export function upcoming(events: Event[], now = Date.now()): Event[] {
  const seen = new Set<string>();
  return events.filter((e) => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    const end = e.end_time ? Date.parse(e.end_time) : Date.parse(e.start_time) + 3 * 3_600_000;
    return end >= now;
  });
}

/** Events worth putting in a large slot: a real picture and a real time. */
export function showcase(events: Event[]): Event[] {
  return events.filter((e) => Boolean(e.image_url) && hasTime(e.start_time));
}

export function textMatch(e: Event, words: string[]): boolean {
  const hay = `${e.title} ${e.description ?? ""}`.toLowerCase();
  return words.some((w) => hay.includes(w));
}
