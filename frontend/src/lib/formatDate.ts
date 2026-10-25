const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

const TIME_FORMAT: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
const WEEKDAY_FORMAT: Intl.DateTimeFormatOptions = { weekday: "long" };
const SHORT_DATE_FORMAT: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
const SHORT_DATE_WITH_YEAR_FORMAT: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
};

/**
 * Relative-ish event date for cards: "Today", "Tomorrow", "This Saturday"
 * for the next week, otherwise a short absolute date. Always paired with
 * the time so the card stays scannable.
 */
export function formatEventDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const dayDiff = Math.round((startOfDay(date).getTime() - startOfDay(now).getTime()) / DAY_MS);
  const time = date.toLocaleTimeString("en-US", TIME_FORMAT);

  let day: string;
  if (dayDiff === 0) {
    day = "Today";
  } else if (dayDiff === 1) {
    day = "Tomorrow";
  } else if (dayDiff > 1 && dayDiff < 7) {
    day = `This ${date.toLocaleDateString("en-US", WEEKDAY_FORMAT)}`;
  } else if (dayDiff < 0 && dayDiff > -7) {
    day = date.toLocaleDateString("en-US", WEEKDAY_FORMAT);
  } else if (date.getFullYear() === now.getFullYear()) {
    day = date.toLocaleDateString("en-US", SHORT_DATE_FORMAT);
  } else {
    day = date.toLocaleDateString("en-US", SHORT_DATE_WITH_YEAR_FORMAT);
  }

  return `${day} · ${time}`;
}

/** Full, unambiguous date+time for the event detail page. */
export function formatFullDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Day/month pair for the stacked datestamp on featured cards. */
export function datestampParts(dateStr: string): { day: string; month: string } {
  const date = new Date(dateStr);
  return {
    day: date.toLocaleDateString("en-US", { day: "numeric" }),
    month: date.toLocaleDateString("en-US", { month: "short" }),
  };
}

/** Compact day label for map/list rows, without the time. */
export function formatDayOnly(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const same =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (same) return "Today";
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
