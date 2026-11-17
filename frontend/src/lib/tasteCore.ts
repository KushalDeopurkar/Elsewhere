/**
 * Pure taste scoring. No storage here, so it is unit-testable.
 * The taste profile is built from swipe and browse signals on this device.
 */
import { CATEGORIES, type Event, type EventCategory } from "./types";

export type Signal = "save" | "open" | "dwell" | "notnow" | "skip";
export type PriceBand = "free" | "low" | "mid" | "high";
export type Slot = "morning" | "afternoon" | "evening" | "night";

export interface TasteProfile {
  category: Partial<Record<EventCategory, number>>;
  price: Record<PriceBand, number>;
  slot: Record<Slot, number>;
  seen: string[];
  signals: number;
}

export const EMPTY_PROFILE: TasteProfile = {
  category: {},
  price: { free: 0, low: 0, mid: 0, high: 0 },
  slot: { morning: 0, afternoon: 0, evening: 0, night: 0 },
  seen: [],
  signals: 0,
};

export const SIGNAL_WEIGHT: Record<Signal, number> = {
  save: 3,
  open: 1,
  dwell: 0.5,
  notnow: -0.25,
  skip: -1,
};

export const MIN_W = -10;
export const MAX_W = 20;
export const COLD_START = 5;
const SEEN_CAP = 500;

const clamp = (n: number) => Math.max(MIN_W, Math.min(MAX_W, n));

export function priceBand(e: Pick<Event, "is_free" | "price_min">): PriceBand {
  if (e.is_free || e.price_min === 0) return "free";
  const p = e.price_min ?? 0;
  if (p <= 500) return "low";
  if (p <= 2000) return "mid";
  return "high";
}

/** Time-of-day slot in India time, which is where every listing is. */
export function slotOf(iso: string): Slot {
  const h = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Kolkata" }).format(new Date(iso)),
  );
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 21) return "evening";
  return "night";
}

/** Apply a signal (or undo one with sign = -1). Returns a new profile. */
export function applySignal(p: TasteProfile, e: Event, signal: Signal, sign: 1 | -1 = 1): TasteProfile {
  const w = SIGNAL_WEIGHT[signal] * sign;
  const band = priceBand(e);
  const slot = slotOf(e.start_time);
  return {
    ...p,
    category: { ...p.category, [e.category]: clamp((p.category[e.category] ?? 0) + w) },
    price: { ...p.price, [band]: clamp(p.price[band] + w) },
    slot: { ...p.slot, [slot]: clamp(p.slot[slot] + w) },
    signals: Math.max(0, p.signals + sign),
  };
}

export function addSeen(p: TasteProfile, id: string): TasteProfile {
  if (p.seen[0] === id) return p;
  return { ...p, seen: [id, ...p.seen.filter((s) => s !== id)].slice(0, SEEN_CAP) };
}

const CAT_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label])) as Record<string, string>;
const SLOT_LABEL: Record<Slot, string> = {
  morning: "Morning plans",
  afternoon: "Afternoon plans",
  evening: "Evening plans",
  night: "Late nights",
};

/** Hours until start, used as a small recency bonus. */
function soonBonus(e: Event, now: number): number {
  const hrs = (new Date(e.start_time).getTime() - now) / 3_600_000;
  if (hrs < 0) return 0;
  if (hrs <= 48) return 6;
  if (hrs <= 168) return 3;
  return 0;
}

export function scoreEvent(
  e: Event,
  p: TasteProfile,
  now: number = Date.now(),
): { score: number; reasons: string[] } {
  if (p.signals < COLD_START) {
    return { score: Math.min(100, 50 + soonBonus(e, now)), reasons: [] };
  }
  const band = priceBand(e);
  const slot = slotOf(e.start_time);
  const parts: { v: number; label: string }[] = [
    { v: (p.category[e.category] ?? 0) * 2, label: `You like ${CAT_LABEL[e.category] ?? e.category}` },
    { v: p.price[band], label: band === "free" ? "Free" : band === "low" ? "Under ₹500" : "In your budget" },
    { v: p.slot[slot] * 0.75, label: SLOT_LABEL[slot] },
  ];
  // Raw sum ranges roughly -45..75; map onto 0..100 around a 50 midpoint.
  const raw = parts.reduce((s, x) => s + x.v, 0);
  const score = Math.round(Math.max(1, Math.min(99, 50 + raw * 1.6 + soonBonus(e, now))));
  const reasons = parts
    .filter((x) => x.v > 0.5)
    .sort((a, b) => b.v - a.v)
    .slice(0, 2)
    .map((x) => x.label);
  return { score, reasons };
}

/**
 * Order events for the deck: drop seen and past ones, rank by score, and put
 * a lower-ranked "explore" pick at every 5th slot so the deck never narrows
 * to one category.
 */
export function rankForDeck(
  events: Event[],
  p: TasteProfile,
  opts: { now?: number; random?: () => number } = {},
): Event[] {
  const now = opts.now ?? Date.now();
  const rand = opts.random ?? Math.random;
  const seen = new Set(p.seen);
  const ids = new Set<string>();
  const pool = events.filter((e) => {
    if (seen.has(e.id) || ids.has(e.id)) return false;
    const end = new Date(e.end_time ?? e.start_time).getTime();
    if (end < now) return false;
    ids.add(e.id);
    return true;
  });
  const ranked = pool
    .map((e) => ({ e, s: scoreEvent(e, p, now).score }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.e);
  if (ranked.length < 6) return ranked;

  const out: Event[] = [];
  const top = ranked.slice(0, Math.ceil(ranked.length / 2));
  const tail = ranked.slice(top.length);
  while (top.length || tail.length) {
    if ((out.length + 1) % 5 === 0 && tail.length) {
      out.push(tail.splice(Math.floor(rand() * tail.length), 1)[0]);
    } else if (top.length) {
      out.push(top.shift()!);
    } else {
      out.push(tail.shift()!);
    }
  }
  return out;
}

/** Top categories with positive weight, for the "your taste so far" card. */
export function tasteSummary(p: TasteProfile) {
  const cats = Object.entries(p.category)
    .filter(([, v]) => (v ?? 0) > 0)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .slice(0, 3)
    .map(([k, v]) => ({ value: k as EventCategory, label: CAT_LABEL[k] ?? k, weight: v ?? 0 }));
  const best = <K extends string>(r: Record<K, number>): K | null => {
    const [k, v] = (Object.entries(r) as [K, number][]).sort((a, b) => b[1] - a[1])[0];
    return v > 0 ? k : null;
  };
  return { cats, slot: best(p.slot), price: best(p.price) };
}
