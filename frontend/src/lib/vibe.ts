/**
 * Vibe discovery: moods mapped onto categories, keywords and time of day,
 * plus the budget, distance and date filters. Pure, so it is unit-testable.
 */
import type { Event, EventCategory } from "./types";
import { matchesWindow } from "./formatDate";
import { slotOf, type Slot } from "./tasteCore";

export type VibeId = "chill" | "social" | "learn" | "wild" | "creative" | "active";
export type When = "any" | "today" | "tomorrow" | "weekend" | "week";

export interface Vibe {
  id: VibeId;
  label: string;
  emoji: string;
  line: string;
  cats: EventCategory[];
  words: string[];
  slots: Slot[];
}

export const VIBES: Vibe[] = [
  {
    id: "chill", label: "Chill", emoji: "🌿", line: "Slow, cosy, low effort",
    cats: ["arts", "food", "health", "outdoor"],
    words: ["acoustic", "brunch", "cafe", "café", "yoga", "walk", "book", "pottery", "tea", "coffee", "meditation", "picnic", "unplugged"],
    slots: ["morning", "afternoon"],
  },
  {
    id: "social", label: "Social", emoji: "🥂", line: "Meet new people",
    cats: ["community", "food", "nightlife", "business"],
    words: ["meetup", "mixer", "networking", "quiz", "trivia", "social", "board game", "speed", "community", "dinner"],
    slots: ["evening"],
  },
  {
    id: "learn", label: "Learn", emoji: "🧠", line: "Pick up something new",
    cats: ["education", "tech", "business"],
    words: ["workshop", "class", "talk", "course", "masterclass", "bootcamp", "seminar", "session", "lecture", "hackathon"],
    slots: ["morning", "afternoon"],
  },
  {
    id: "wild", label: "Wild", emoji: "🔥", line: "Loud, late, all in",
    cats: ["nightlife", "music"],
    words: ["party", "rave", "gig", "festival", "dj", "techno", "concert", "club", "night", "live"],
    slots: ["night", "evening"],
  },
  {
    id: "creative", label: "Creative", emoji: "🎨", line: "Make or watch art",
    cats: ["arts", "music"],
    words: ["pottery", "painting", "theatre", "theater", "film", "poetry", "open mic", "comedy", "art", "craft", "photography", "exhibition"],
    slots: ["afternoon", "evening"],
  },
  {
    id: "active", label: "Active", emoji: "⚡", line: "Move your body",
    cats: ["sports", "health", "outdoor"],
    words: ["run", "trek", "hike", "cycle", "cycling", "yoga", "football", "marathon", "dance", "climb", "swim", "fitness"],
    slots: ["morning"],
  },
];

const BY_ID = Object.fromEntries(VIBES.map((v) => [v.id, v])) as Record<VibeId, Vibe>;
export const isVibeId = (s: string): s is VibeId => s in BY_ID;

/** How well an event fits the chosen vibes. 0 means not at all. */
export function vibeFit(e: Event, vibes: VibeId[]): number {
  if (!vibes.length) return 0;
  const text = `${e.title} ${e.description ?? ""}`.toLowerCase();
  const slot = slotOf(e.start_time);
  let best = 0;
  for (const id of vibes) {
    const v = BY_ID[id];
    let fit = v.cats.includes(e.category) ? 2 : 0;
    fit += Math.min(2, v.words.filter((w) => text.includes(w)).length);
    if (fit > 0 && v.slots.includes(slot)) fit += 0.5;
    best = Math.max(best, fit);
  }
  return best;
}

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export const BUDGET_MAX = 5000; // slider top means "any price"
export const DISTANCE_MAX = 40; // slider top means "anywhere in the city"

export interface VibeFilters {
  vibes: VibeId[];
  budget: number;
  distance: number;
  when: When;
}

export const DEFAULT_FILTERS: VibeFilters = { vibes: [], budget: BUDGET_MAX, distance: DISTANCE_MAX, when: "any" };

function inWindow(iso: string, when: When, now: Date): boolean {
  if (when === "week") {
    const ms = new Date(iso).getTime() - now.getTime();
    return ms >= -3 * 3_600_000 && ms <= 7 * 86_400_000;
  }
  return matchesWindow(iso, when, now);
}

export interface VibeHit {
  event: Event;
  fit: number;
  km: number | null;
}

/**
 * Filter and rank. `taste` adds the swipe-learned score (0..100) so two
 * equally good vibe matches come out in the order the person tends to like.
 */
export function applyVibe(
  events: Event[],
  f: VibeFilters,
  center: { lat: number; lng: number },
  opts: { now?: Date; taste?: (e: Event) => number } = {},
): VibeHit[] {
  const now = opts.now ?? new Date();
  const out: VibeHit[] = [];
  for (const e of events) {
    const end = new Date(e.end_time ?? e.start_time).getTime();
    if (end < now.getTime()) continue;
    if (f.when !== "any" && !inWindow(e.start_time, f.when, now)) continue;
    if (f.budget < BUDGET_MAX && !e.is_free && (e.price_min ?? Infinity) > f.budget) continue;
    const km = e.lat != null && e.lng != null ? distanceKm(center, { lat: e.lat, lng: e.lng }) : null;
    if (f.distance < DISTANCE_MAX && km != null && km > f.distance) continue;
    const fit = vibeFit(e, f.vibes);
    if (f.vibes.length && fit < 2) continue;
    out.push({ event: e, fit, km });
  }
  const t = opts.taste ?? (() => 50);
  return out.sort(
    (a, b) =>
      b.fit * 20 + t(b.event) - (a.fit * 20 + t(a.event)) ||
      new Date(a.event.start_time).getTime() - new Date(b.event.start_time).getTime(),
  );
}

/** URL <-> filters, so a vibe can be shared as a link. */
export function filtersFromParams(p: URLSearchParams): VibeFilters {
  const num = (k: string, max: number) => {
    const n = Number(p.get(k));
    return Number.isFinite(n) && n > 0 ? Math.min(n, max) : max;
  };
  const w = p.get("w");
  return {
    vibes: (p.get("v") ?? "").split(",").filter(isVibeId),
    budget: p.get("b") === "0" ? 0 : num("b", BUDGET_MAX),
    distance: num("d", DISTANCE_MAX),
    when: w === "today" || w === "tomorrow" || w === "weekend" || w === "week" ? w : "any",
  };
}

export function filtersToQuery(f: VibeFilters): string {
  const q = new URLSearchParams();
  if (f.vibes.length) q.set("v", f.vibes.join(","));
  if (f.budget < BUDGET_MAX) q.set("b", String(f.budget));
  if (f.distance < DISTANCE_MAX) q.set("d", String(f.distance));
  if (f.when !== "any") q.set("w", f.when);
  const s = q.toString();
  return s ? `?${s}` : "";
}
