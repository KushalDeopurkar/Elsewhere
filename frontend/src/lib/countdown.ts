/**
 * Honest countdowns: only from real times we hold (an event's start, a ticket
 * tier's sales end). Nothing here invents urgency; past or far-off times
 * return null so the caller shows nothing.
 */

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** "45m", "2h 14m", "1d 3h" — whole minutes, never negative. */
export function formatSpan(ms: number): string {
  const total = Math.max(1, Math.floor(ms / MIN));
  const d = Math.floor(total / (24 * 60));
  const h = Math.floor((total % (24 * 60)) / 60);
  const m = total % 60;
  if (d > 0) return h ? `${d}d ${h}h` : `${d}d`;
  if (h > 0) return m ? `${h}h ${m}m` : `${h}h`;
  return `${m}m`;
}

export interface Countdown {
  label: string;
  /** "live" while on, "soon" inside the window. */
  tone: "live" | "soon";
}

/**
 * "On now" while the event runs, "Starts in 2h 14m" inside `windowMs`
 * (default 48h). Date-only listings (midnight IST) have no real start time,
 * so pass hasTime=false and get null.
 */
export function startCountdown(
  start: string,
  end: string | null,
  now: number,
  opts: { hasTime?: boolean; windowMs?: number } = {},
): Countdown | null {
  const { hasTime = true, windowMs = 2 * DAY } = opts;
  if (!hasTime) return null;
  const s = Date.parse(start);
  if (Number.isNaN(s)) return null;
  const e = end ? Date.parse(end) : s + 2 * HOUR;
  if (s <= now && now < e && e - s <= 12 * HOUR) return { label: "On now", tone: "live" };
  if (s > now && s - now <= windowMs) return { label: `Starts in ${formatSpan(s - now)}`, tone: "soon" };
  return null;
}

type Tier = { sales_end: string | null; available: boolean | null };

/**
 * The soonest real sales cut-off among tiers still on sale, inside
 * `windowMs` (default 72h): "Sales end in 3h 5m".
 */
export function salesCountdown(tickets: Tier[] | null | undefined, now: number, windowMs = 3 * DAY): string | null {
  let soonest = Infinity;
  for (const t of tickets ?? []) {
    if (t.available === false || !t.sales_end) continue;
    const at = Date.parse(t.sales_end);
    if (!Number.isNaN(at) && at > now && at < soonest) soonest = at;
  }
  if (soonest === Infinity || soonest - now > windowMs) return null;
  return `Sales end in ${formatSpan(soonest - now)}`;
}
