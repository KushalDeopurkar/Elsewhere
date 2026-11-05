import { Event } from "./types";

/**
 * Shared shapes and pure helpers for the day planner. Safe to import on both
 * the server (the /api/plan route) and the client (the planner UI).
 */

export interface TravelLeg {
  km: number;
  /** Rough road time at city traffic speed. An estimate, labelled as one. */
  minutes: number;
}

export interface PlanStop {
  event: Event;
  /** One line on why this stop fits the request. */
  why: string;
  /** Leg from the previous stop; null for the first stop or missing coordinates. */
  travel: TravelLeg | null;
}

export interface PlanResult {
  title: string;
  summary: string;
  /** Caveat when the request could not be met in full. */
  note: string | null;
  city: string;
  stops: PlanStop[];
  /** Lowest total ticket cost in rupees across the stops. */
  totalCost: number;
  engine: { kind: "ai" | "rules"; label: string };
  /** True when the backend was unreachable and sample events were used. */
  isSample: boolean;
  /** How many events were considered. */
  considered: number;
}

/** Average door-to-door speed in an Indian metro, km/h. Deliberately pessimistic. */
const CITY_KMH = 20;
/** Fixed overhead per hop: finding a cab, parking, walking in. */
const HOP_MINUTES = 8;
/** Long-running events (festivals, exhibitions) are treated as a visit of this length. */
const MAX_VISIT_MINUTES = 180;
const DEFAULT_VISIT_MINUTES = 120;

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function travelBetween(a: Event, b: Event): TravelLeg | null {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null;
  // Straight-line distance understates road distance by roughly a third.
  const km = haversineKm({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng }) * 1.35;
  const minutes = km < 0.4 ? 5 : Math.round((km / CITY_KMH) * 60 + HOP_MINUTES);
  return { km: Math.round(km * 10) / 10, minutes };
}

export function visitEnd(e: Event): number {
  const start = Date.parse(e.start_time);
  const end = e.end_time ? Date.parse(e.end_time) : NaN;
  const length = Number.isFinite(end) && end > start
    ? Math.min((end - start) / 60_000, MAX_VISIT_MINUTES)
    : DEFAULT_VISIT_MINUTES;
  return start + length * 60_000;
}

export function lowestPrice(e: Event): number {
  if (e.is_free) return 0;
  return e.price_min ?? 0;
}

/**
 * Turn picks into a timeline that can actually be attended: sort by start,
 * then keep a stop only if you can get there from the previous one in time.
 * Picks earlier in `ranked` win a clash, so the model's (or the rules')
 * priority decides what gets dropped.
 */
export function buildSchedule(
  ranked: { event: Event; why: string }[],
  opts: { budget?: number | null; maxStops?: number } = {},
): { stops: PlanStop[]; dropped: number } {
  const maxStops = opts.maxStops ?? 4;
  const accepted: { event: Event; why: string }[] = [];
  let spend = 0;

  for (const pick of ranked) {
    if (accepted.length >= maxStops) break;
    const price = lowestPrice(pick.event);
    if (opts.budget != null && spend + price > opts.budget) continue;

    const trial = [...accepted, pick].sort(
      (a, b) => Date.parse(a.event.start_time) - Date.parse(b.event.start_time),
    );
    const feasible = trial.every((cur, i) => {
      if (i === 0) return true;
      const prev = trial[i - 1].event;
      const leg = travelBetween(prev, cur.event);
      // Ten minutes of slack: arriving a little late to a meetup is normal.
      return visitEnd(prev) + (leg?.minutes ?? 15) * 60_000 - 10 * 60_000 <= Date.parse(cur.event.start_time);
    });
    if (!feasible) continue;

    accepted.push(pick);
    spend += price;
  }

  accepted.sort((a, b) => Date.parse(a.event.start_time) - Date.parse(b.event.start_time));
  const stops = accepted.map((p, i) => ({
    event: p.event,
    why: p.why,
    travel: i === 0 ? null : travelBetween(accepted[i - 1].event, p.event),
  }));
  return { stops, dropped: ranked.length - accepted.length };
}

/** "under 1000", "₹1500", "1000 rs", "budget 800". Null when no budget is stated. */
export function parseBudget(text: string): number | null {
  const t = text.toLowerCase().replace(/,/g, "");
  const m =
    t.match(/(?:₹|rs\.?|inr)\s*(\d{2,6})/) ||
    t.match(/(\d{2,6})\s*(?:₹|rs\.?|rupees|inr|bucks)/) ||
    t.match(/(?:under|below|less than|within|budget(?: of)?|max|upto|up to|andar)\s*(\d{2,6})/);
  return m ? Number(m[1]) : null;
}

// ---------------------------------------------------------------------------
// Calendar export
// ---------------------------------------------------------------------------

function icsDate(ms: number): string {
  return new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function icsEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, (c) => `\\${c}`);
}

function venueLine(e: Event): string {
  return [e.location_name, e.address ?? e.city].filter(Boolean).join(", ");
}

export function planToIcs(plan: PlanResult, origin: string): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//EventEngine//Day Planner//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  const stamp = icsDate(Date.now());
  for (const s of plan.stops) {
    const e = s.event;
    const link = e.url || `${origin}/events/${e.id}`;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.id}@eventengine`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsDate(Date.parse(e.start_time))}`,
      `DTEND:${icsDate(visitEnd(e))}`,
      `SUMMARY:${icsEscape(e.title)}`,
      `LOCATION:${icsEscape(venueLine(e))}`,
      `DESCRIPTION:${icsEscape(`${s.why}\n${link}`)}`,
      `URL:${link}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function googleCalendarLink(stop: PlanStop, origin: string): string {
  const e = stop.event;
  const qs = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${icsDate(Date.parse(e.start_time))}/${icsDate(visitEnd(e))}`,
    details: `${stop.why}\n${e.url || `${origin}/events/${e.id}`}`,
    location: venueLine(e),
  });
  return `https://calendar.google.com/calendar/render?${qs}`;
}
