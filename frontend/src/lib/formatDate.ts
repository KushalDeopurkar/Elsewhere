/**
 * Every formatter pins locale and time zone.
 *
 * Beyond matching the audience, this is what keeps server and client output
 * identical: the server renders in the container's zone (UTC) and the browser
 * in the viewer's, so an unpinned formatter produces a hydration mismatch on
 * every date on the page.
 */
import { zoneOf } from "./cities";

const LOCALE = "en-IN";
/** India's zone: the default for every formatter. Events elsewhere pass
 * their own (see `zoneOf`), so a London gig reads in London time. */
export const DEFAULT_ZONE = "Asia/Kolkata";

type Kind = "time" | "weekday" | "day" | "month" | "dateShort" | "full" | "hhmm" | "dateOnlyFull" | "ymd" | "hour" | "wd";
const OPTS: Record<Kind, Intl.DateTimeFormatOptions & { locale?: string }> = {
  time: { hour: "numeric", minute: "2-digit", hour12: true },
  weekday: { weekday: "long" },
  day: { day: "numeric" },
  month: { month: "short" },
  dateShort: { day: "numeric", month: "short" },
  full: { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true },
  hhmm: { hour: "2-digit", minute: "2-digit", hourCycle: "h23" },
  dateOnlyFull: { weekday: "long", day: "numeric", month: "long", year: "numeric" },
  ymd: { year: "numeric", month: "2-digit", day: "2-digit" },
  hour: { hour: "numeric", hour12: false, locale: "en-GB" },
  wd: { weekday: "short", locale: "en-GB" },
};
const cache = new Map<string, Intl.DateTimeFormat>();
function f(kind: Kind, zone: string = DEFAULT_ZONE): Intl.DateTimeFormat {
  const key = `${kind}|${zone}`;
  let x = cache.get(key);
  if (!x) {
    const { locale, ...opts } = OPTS[kind];
    x = new Intl.DateTimeFormat(locale ?? LOCALE, { timeZone: zone, ...opts });
    cache.set(key, x);
  }
  return x;
}

/** The zone for an event's times. */
export const eventZone = zoneOf;

/**
 * Some sources list only a date, which arrives as exactly midnight IST.
 * Treat that as "time not listed" rather than an event at 12:00 am.
 */
export function hasTime(iso: string, zone?: string): boolean {
  return f("hhmm", zone).format(new Date(iso)) !== "00:00";
}

/** Calendar days between two instants, counted in IST rather than UTC. */
function daysApart(a: Date, b: Date, zone?: string): number {
  const key = (d: Date) => {
    const parts = f("ymd", zone)
      .formatToParts(d)
      .reduce<Record<string, string>>((acc, p) => {
        acc[p.type] = p.value;
        return acc;
      }, {});
    return Date.UTC(+parts.year, +parts.month - 1, +parts.day);
  };
  return Math.round((key(a) - key(b)) / 86_400_000);
}

/** The date plate on a card: a numeral and a month, nothing else. */
export function formatDatePlate(iso: string, zone?: string): { day: string; month: string } {
  const d = new Date(iso);
  return { day: f("day", zone).format(d), month: f("month", zone).format(d) };
}

/** "Tonight, 9:00 pm" / "Tomorrow, 7:30 pm" / "Sat, 12 Apr" */
export function formatWhen(iso: string, now: Date = new Date(), zone?: string): string {
  const d = new Date(iso);
  const diff = daysApart(d, now, zone);
  if (!hasTime(iso, zone)) {
    if (diff === 0) return "Today, time on listing";
    if (diff === 1) return "Tomorrow, time on listing";
    if (diff > 1 && diff < 7) return `${f("weekday", zone).format(d)}, time on listing`;
    return `${f("dateShort", zone).format(d)}, time on listing`;
  }
  const time = f("time", zone).format(d);

  if (diff === 0) {
    const hour = +f("hour", zone).format(d);
    return `${hour >= 17 ? "Tonight" : "Today"}, ${time}`;
  }
  if (diff === 1) return `Tomorrow, ${time}`;
  if (diff > 1 && diff < 7) return `${f("weekday", zone).format(d)}, ${time}`;
  return `${f("dateShort", zone).format(d)}, ${time}`;
}

/** Unambiguous date and time for the detail page. */
export function formatFull(iso: string, zone?: string): string {
  if (!hasTime(iso, zone)) return `${f("dateOnlyFull", zone).format(new Date(iso))} (time on listing)`;
  return f("full", zone).format(new Date(iso));
}

type Placed = { start_time: string; lat?: number | null; lng?: number | null; country?: string | null };

/** formatWhen for an event, in its own city's time. */
export const whenOf = (e: Placed, now?: Date) => formatWhen(e.start_time, now, zoneOf(e));
/** hasTime for an event, in its own city's time. */
export const timedOf = (e: Placed) => hasTime(e.start_time, zoneOf(e));

/** Does this event fall inside the selected time window? */
export function matchesWindow(
  iso: string,
  window: "any" | "today" | "tomorrow" | "weekend",
  now: Date = new Date(),
  zone?: string,
): boolean {
  if (window === "any") return true;
  const diff = daysApart(new Date(iso), now, zone);
  if (diff < 0) return false;
  if (window === "today") return diff === 0;
  if (window === "tomorrow") return diff === 1;

  // Weekend: the coming Saturday and Sunday, in IST.
  const weekday = f("wd", zone).format(new Date(iso));
  return diff <= 7 && (weekday === "Sat" || weekday === "Sun");
}

/** Short zone name for clocks: "IST", "GMT", "EST", "AEDT"; "LOCAL" when the platform only knows an offset. */
export function zoneLabel(zone: string, at: number): string {
  if (zone === "Asia/Kolkata") return "IST";
  const part = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "short" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")?.value;
  return part && !part.startsWith("GMT+") && !part.startsWith("GMT-") ? part : "LOCAL";
}
