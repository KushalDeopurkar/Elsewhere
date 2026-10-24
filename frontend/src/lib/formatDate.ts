/**
 * Every formatter pins locale and time zone.
 *
 * Beyond matching the audience, this is what keeps server and client output
 * identical: the server renders in the container's zone (UTC) and the browser
 * in the viewer's, so an unpinned formatter produces a hydration mismatch on
 * every date on the page.
 */
const LOCALE = "en-IN";
const ZONE = "Asia/Kolkata";

const fmt = (opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(LOCALE, { timeZone: ZONE, ...opts });

const TIME = fmt({ hour: "numeric", minute: "2-digit", hour12: true });
const WEEKDAY = fmt({ weekday: "long" });
const DAY = fmt({ day: "numeric" });
const MONTH = fmt({ month: "short" });
const DATE_SHORT = fmt({ day: "numeric", month: "short" });
const FULL = fmt({
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

/** Calendar days between two instants, counted in IST rather than UTC. */
function daysApart(a: Date, b: Date): number {
  const key = (d: Date) => {
    const parts = fmt({ year: "numeric", month: "2-digit", day: "2-digit" })
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
export function formatDatePlate(iso: string): { day: string; month: string } {
  const d = new Date(iso);
  return { day: DAY.format(d), month: MONTH.format(d) };
}

/** "Tonight, 9:00 pm" / "Tomorrow, 7:30 pm" / "Sat, 12 Apr" */
export function formatWhen(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const diff = daysApart(d, now);
  const time = TIME.format(d);

  if (diff === 0) {
    const hour = +new Intl.DateTimeFormat("en-GB", {
      timeZone: ZONE,
      hour: "numeric",
      hour12: false,
    }).format(d);
    return `${hour >= 17 ? "Tonight" : "Today"}, ${time}`;
  }
  if (diff === 1) return `Tomorrow, ${time}`;
  if (diff > 1 && diff < 7) return `${WEEKDAY.format(d)}, ${time}`;
  return `${DATE_SHORT.format(d)}, ${time}`;
}

/** Unambiguous date and time for the detail page. */
export function formatFull(iso: string): string {
  return FULL.format(new Date(iso));
}

/** Does this event fall inside the selected time window? */
export function matchesWindow(
  iso: string,
  window: "any" | "today" | "tomorrow" | "weekend",
  now: Date = new Date(),
): boolean {
  if (window === "any") return true;
  const diff = daysApart(new Date(iso), now);
  if (diff < 0) return false;
  if (window === "today") return diff === 0;
  if (window === "tomorrow") return diff === 1;

  // Weekend: the coming Saturday and Sunday, in IST.
  const weekday = new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONE,
    weekday: "short",
  }).format(new Date(iso));
  return diff <= 7 && (weekday === "Sat" || weekday === "Sun");
}
