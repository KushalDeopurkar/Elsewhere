/**
 * The passport: stamps for the kinds of event, cities and venues someone
 * has explored, and badges for milestones. Pure functions over a plain
 * object, so they're testable and the store stays dumb.
 */
import type { Event, EventCategory } from "./types";

export interface Passport {
  /** First time each thing was stamped (ISO). */
  cats: Partial<Record<EventCategory, string>>;
  cities: Record<string, string>;
  venues: Record<string, string>;
  /** Event ids, capped, for the time and price badges. */
  night: string[];
  early: string[];
  free: string[];
}

export const EMPTY_PASSPORT: Passport = { cats: {}, cities: {}, venues: {}, night: [], early: [], free: [] };

const CAP = 60;
const add = (list: string[], id: string) => (list.includes(id) ? list : [id, ...list].slice(0, CAP));

function istHour(iso: string): number {
  const d = new Date(Date.parse(iso) + 5.5 * 3_600_000);
  return d.getUTCHours() + d.getUTCMinutes() / 60;
}

export interface Stamp {
  kind: "category" | "city" | "venue";
  label: string;
}

/** Stamp an event someone opened or saved. Returns the new passport and any first-time stamps. */
export function stampEvent(p: Passport, e: Event, at: string, labelOf: (c: EventCategory) => string): { next: Passport; fresh: Stamp[] } {
  const fresh: Stamp[] = [];
  const next: Passport = { ...p, cats: { ...p.cats }, cities: { ...p.cities }, venues: { ...p.venues } };
  if (e.category !== "other" && !next.cats[e.category]) {
    next.cats[e.category] = at;
    fresh.push({ kind: "category", label: labelOf(e.category) });
  }
  const city = e.city?.trim();
  if (city && !next.cities[city]) {
    next.cities[city] = at;
    fresh.push({ kind: "city", label: city });
  }
  const venue = e.location_name?.trim();
  if (venue && !next.venues[venue]) {
    next.venues[venue] = at;
    // Venues are many; they count toward a badge but don't each pop a toast.
  }
  const h = istHour(e.start_time);
  // Date-only listings sit at exactly midnight; they say nothing about the hour.
  if (h !== 0) {
    if (h >= 21 || h < 3) next.night = add(p.night, e.id);
    if (h >= 5 && h < 9) next.early = add(p.early, e.id);
  }
  if (e.is_free) next.free = add(p.free, e.id);
  return { next, fresh };
}

export interface Badge {
  id: string;
  title: string;
  desc: string;
  have: number;
  need: number;
  earned: boolean;
}

export function badges(p: Passport, streak: number): Badge[] {
  const cats = Object.keys(p.cats).length;
  const list: Omit<Badge, "earned">[] = [
    { id: "curious", title: "Curious", desc: "Explore 3 kinds of event", have: cats, need: 3 },
    { id: "omnivore", title: "Omnivore", desc: "Explore 8 kinds of event", have: cats, need: 8 },
    { id: "everything", title: "Full set", desc: "Every category stamped", have: cats, need: 12 },
    { id: "hopper", title: "City hopper", desc: "Look around 2 cities", have: Object.keys(p.cities).length, need: 2 },
    { id: "local", title: "Local", desc: "Check out 10 different venues", have: Object.keys(p.venues).length, need: 10 },
    { id: "owl", title: "Night owl", desc: "3 events that start after 9 pm", have: p.night.length, need: 3 },
    { id: "lark", title: "Early bird", desc: "3 events that start before 9 am", have: p.early.length, need: 3 },
    { id: "free", title: "Free spirit", desc: "5 free events", have: p.free.length, need: 5 },
    { id: "regular", title: "Regular", desc: "Visit 3 days in a row", have: streak, need: 3 },
  ];
  return list.map((b) => ({ ...b, have: Math.min(b.have, b.need), earned: b.have >= b.need }));
}

export function newlyEarned(before: Badge[], after: Badge[]): Badge[] {
  const had = new Set(before.filter((b) => b.earned).map((b) => b.id));
  return after.filter((b) => b.earned && !had.has(b.id));
}

const earliest = (a: Record<string, string>, b: Record<string, string>) => {
  const out: Record<string, string> = { ...a };
  for (const [k, v] of Object.entries(b)) if (!out[k] || v < out[k]) out[k] = v;
  return out;
};
const union = (a: string[], b: string[]) => [...new Set([...a, ...b])].slice(0, CAP);

/** Combine this device's passport with the account's: union of stamps, earliest dates kept. */
export function mergePassports(a: Passport, b: Partial<Passport> | null | undefined): Passport {
  if (!b) return a;
  return {
    cats: earliest(a.cats as Record<string, string>, (b.cats ?? {}) as Record<string, string>) as Passport["cats"],
    cities: earliest(a.cities, b.cities ?? {}),
    venues: earliest(a.venues, b.venues ?? {}),
    night: union(a.night, b.night ?? []),
    early: union(a.early, b.early ?? []),
    free: union(a.free, b.free ?? []),
  };
}
