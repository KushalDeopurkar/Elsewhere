/**
 * "Your month in Elsewhere": a recap built only from what this device (and,
 * if signed in, the account) already knows. Pure, so the persona and the
 * numbers are testable. Nothing here is estimated: every figure is a count
 * of things the person did.
 */
import type { EventCategory } from "./types";
import type { Passport } from "./passportCore";

export interface RecapInput {
  now: number;
  saved: { savedAt: string; category: EventCategory }[];
  passport: Passport;
  topCategories: { value: EventCategory; label: string }[];
  streak: number;
  going: number | null;
  labelOf: (c: EventCategory) => string;
}

export interface Recap {
  month: string; // "November"
  monthKey: string; // "2026-11"
  saved: number;
  stamps: { value: EventCategory; label: string }[];
  top: { value: EventCategory; label: string } | null;
  nights: number;
  early: number;
  free: number;
  cities: string[];
  streak: number;
  going: number | null;
  persona: { title: string; line: string };
  empty: boolean;
}

const MONTH = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", month: "long" });
const KEY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit" });
const monthKeyOf = (t: number) => KEY.format(new Date(t)).slice(0, 7);

const PERSONA: Partial<Record<EventCategory, { title: string; line: string }>> = {
  music: { title: "Front Row Regular", line: "If there's a stage, you've found it." },
  nightlife: { title: "After-Dark Scout", line: "The city's best hours start late." },
  tech: { title: "Meetup Maven", line: "Lanyards, laptops and good questions." },
  business: { title: "Room Worker", line: "You go where the founders go." },
  arts: { title: "Gallery Drifter", line: "Openings, prints and slow looks." },
  food: { title: "Table Hunter", line: "Tasting menus and pop-ups, noted." },
  sports: { title: "Game Day Starter", line: "Sweat first, brunch after." },
  outdoor: { title: "Trail Taker", line: "Early alarms, better views." },
  health: { title: "Calm Collector", line: "Breathwork, mats and quiet mornings." },
  education: { title: "Workshop Junkie", line: "Always learning one more thing." },
  community: { title: "Connector", line: "You show up for people." },
  family: { title: "Weekend Planner", line: "Plans that work for everyone." },
};

export function buildRecap(i: RecapInput): Recap {
  const mk = monthKeyOf(i.now);
  const inMonth = (iso: string) => monthKeyOf(Date.parse(iso)) === mk;
  const savedThisMonth = i.saved.filter((s) => inMonth(s.savedAt));
  const stamps = (Object.entries(i.passport.cats) as [EventCategory, string][])
    .filter(([, at]) => at && inMonth(at))
    .map(([value]) => ({ value, label: i.labelOf(value) }));

  // Top category: what they saved most this month, else their taste profile.
  const counts = new Map<EventCategory, number>();
  savedThisMonth.forEach((s) => counts.set(s.category, (counts.get(s.category) ?? 0) + 1));
  const bySaves = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const topValue = bySaves ?? i.topCategories[0]?.value ?? null;
  const top = topValue ? { value: topValue, label: i.labelOf(topValue) } : null;

  const nights = i.passport.night.length;
  let persona = (top && PERSONA[top.value]) || { title: "Curious Wanderer", line: "A little of everything, and that's the point." };
  if (nights >= 5) persona = { title: "Night Owl", line: "Most of your plans start after 9 pm." };
  else if (i.passport.early.length >= 3) persona = { title: "Early Riser", line: "You're out before the city wakes up." };

  const cities = Object.entries(i.passport.cities)
    .filter(([, at]) => inMonth(at))
    .map(([c]) => c);

  return {
    month: MONTH.format(new Date(i.now)),
    monthKey: mk,
    saved: savedThisMonth.length,
    stamps,
    top,
    nights,
    early: i.passport.early.length,
    free: i.passport.free.length,
    cities,
    streak: i.streak,
    going: i.going,
    persona,
    empty: savedThisMonth.length === 0 && stamps.length === 0 && (i.going ?? 0) === 0,
  };
}
