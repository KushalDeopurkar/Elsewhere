/**
 * Reads dates, times of day and prices out of a search, in the city's own
 * calendar: "on 22nd", "22 nov", "nov 22", "22/11", "2026-11-22", "22-25
 * dec", "friday", "next friday", "this week", "next month", "in december",
 * "christmas", "after 7pm", "morning", "under ₹500", "between 500 and 1000".
 *
 * Every reader returns the words it used (`source`), so the search can take
 * them out of the text it matches against titles, and show them as chips.
 * Days are local calendar days as "YYYY-MM-DD"; nothing here guesses a date
 * the words don't say.
 */

import type { Event } from "./types";
import { eventZone } from "./formatDate";

export interface DayRange {
  /** First and last local day, inclusive, "YYYY-MM-DD". */
  from: string;
  to: string;
  label: string;
  source: string;
}

export interface Hours {
  /** Local hours; `to` may pass 24 for "tonight" (until 4 am). */
  from: number;
  to: number;
  label: string;
  source: string;
}

export interface PriceCap {
  min: number | null;
  max: number | null;
  label: string;
  source: string;
}

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5,
  jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9,
  oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};
const MONTH_NAMES = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTH_RE = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join("|");
const WEEKDAYS: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
  mon: 1, tue: 2, tues: 2, wed: 3, weds: 3, thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6, sun: 0,
};
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ORD = "(?:st|nd|rd|th)";

// ---- calendar helpers (pure, UTC-based arithmetic on local dates) ----------

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const parts = (day: string) => day.split("-").map(Number) as [number, number, number];

/** The local calendar day of an instant in a zone. */
export function localDay(ms: number, zone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(ms);
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = parts(day);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return ymd(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

const weekday = (day: string) => {
  const [y, m, d] = parts(day);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const valid = (y: number, m: number, d: number) => m >= 1 && m <= 12 && d >= 1 && d <= daysIn(y, m);

/** The instant a local day and hour begin in a zone (for asking the API for a range). */
export function zonedTime(day: string, hour: number, zone: string): number {
  const [y, m, d] = parts(day);
  const guess = Date.UTC(y, m - 1, d, hour);
  // The zone's offset at that moment: format the guess back and compare.
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(guess);
  const v = (t: string) => Number(f.find((p) => p.type === t)?.value);
  const shown = Date.UTC(v("year"), v("month") - 1, v("day"), v("hour") % 24, v("minute"));
  return guess - (shown - guess);
}

function label(from: string, to: string, today: string): string {
  const one = (day: string) => {
    if (day === today) return "Today";
    if (day === addDays(today, 1)) return "Tomorrow";
    const [y, m, d] = parts(day);
    const [ty] = parts(today);
    return `${DAY_NAMES[weekday(day)].slice(0, 3)} ${d} ${MONTH_NAMES[m].slice(0, 3)}${y !== ty ? ` ${y}` : ""}`;
  };
  return from === to ? one(from) : `${one(from)} to ${one(to)}`;
}

/** A day and month without a year: this year, or next year once it has passed. */
function nextDate(today: string, m: number, d: number, y?: number): string | null {
  const [ty] = parts(today);
  if (y) return valid(y, m, d) ? ymd(y, m, d) : null;
  for (const yy of [ty, ty + 1]) {
    if (!valid(yy, m, d)) continue;
    const day = ymd(yy, m, d);
    if (day >= today) return day;
  }
  return null;
}

/** A bare day of the month ("22nd"): this month, or next month once it has passed. */
function nextDayOfMonth(today: string, d: number): string | null {
  let [y, m] = parts(today);
  for (let i = 0; i < 3; i++) {
    if (valid(y, m, d) && ymd(y, m, d) >= today) return ymd(y, m, d);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return null;
}

const fullYear = (y?: string) => (!y ? undefined : y.length === 2 ? 2000 + Number(y) : Number(y));

// ---- dates -----------------------------------------------------------------

interface Rule {
  re: RegExp;
  read: (m: RegExpMatchArray, today: string, dayFirst: boolean) => [string, string] | null;
}

const RULES: Rule[] = [
  // 22-25 dec, 22nd to 25th of december 2026, from 22 till 25 dec
  {
    re: new RegExp(`\\b(?:from |between )?(\\d{1,2})${ORD}?\\s*(?:-|–|to|till|until|and)\\s*(\\d{1,2})${ORD}?\\s+(?:of\\s+)?(${MONTH_RE})\\b(?:,?\\s+(\\d{4}))?`),
    read: (m, today) => {
      const mo = MONTHS[m[3]];
      const a = nextDate(today, mo, Number(m[1]), fullYear(m[4]));
      if (!a) return null;
      const [ay] = parts(a);
      const b = valid(ay, mo, Number(m[2])) ? ymd(ay, mo, Number(m[2])) : null;
      return b && b >= a ? [a, b] : null;
    },
  },
  // dec 22-25, december 22nd to 25th
  {
    re: new RegExp(`\\b(${MONTH_RE})\\s+(\\d{1,2})${ORD}?\\s*(?:-|–|to|till|until|and)\\s*(\\d{1,2})${ORD}?\\b(?:,?\\s+(\\d{4}))?`),
    read: (m, today) => {
      const mo = MONTHS[m[1]];
      const a = nextDate(today, mo, Number(m[2]), fullYear(m[4]));
      if (!a) return null;
      const [ay] = parts(a);
      const b = valid(ay, mo, Number(m[3])) ? ymd(ay, mo, Number(m[3])) : null;
      return b && b >= a ? [a, b] : null;
    },
  },
  // 2026-11-22
  {
    re: /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/,
    read: (m) => (valid(+m[1], +m[2], +m[3]) ? [ymd(+m[1], +m[2], +m[3]), ymd(+m[1], +m[2], +m[3])] : null),
  },
  // 22/11, 22.11.2026 (day first; month first for US cities)
  {
    re: /\b(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?\b/,
    read: (m, today, dayFirst) => {
      const [d, mo] = dayFirst ? [+m[1], +m[2]] : [+m[2], +m[1]];
      const day = nextDate(today, mo, d, fullYear(m[3]));
      return day ? [day, day] : null;
    },
  },
  // 22 nov, 22nd of november 2026
  {
    re: new RegExp(`\\b(\\d{1,2})${ORD}?\\s+(?:of\\s+)?(${MONTH_RE})\\b(?:,?\\s+(\\d{4}))?`),
    read: (m, today) => {
      const day = nextDate(today, MONTHS[m[2]], Number(m[1]), fullYear(m[3]));
      return day ? [day, day] : null;
    },
  },
  // nov 22, november 22nd, 2026
  {
    re: new RegExp(`\\b(${MONTH_RE})\\s+(\\d{1,2})${ORD}?\\b(?:,?\\s+(\\d{4}))?(?!\\s*(?::|am|pm))`),
    read: (m, today) => {
      const day = nextDate(today, MONTHS[m[1]], Number(m[2]), fullYear(m[3]));
      return day ? [day, day] : null;
    },
  },
  // 22nd to 25th (this month)
  {
    re: new RegExp(`\\b(?:from |between )?(\\d{1,2})${ORD}\\s*(?:-|–|to|till|until|and)\\s*(\\d{1,2})${ORD}?\\b`),
    read: (m, today) => {
      const a = nextDayOfMonth(today, Number(m[1]));
      if (!a) return null;
      const [y, mo] = parts(a);
      const b = valid(y, mo, Number(m[2])) ? ymd(y, mo, Number(m[2])) : null;
      return b && b >= a ? [a, b] : null;
    },
  },
  // on 22nd, the 22nd, 22nd, on 22
  {
    re: new RegExp(`\\b(?:on (?:the )?|the )?(\\d{1,2})${ORD}\\b|\\bon (?:the )?(\\d{1,2})\\b(?!\\s*(?:am|pm|:|%|k\\b|-|/))`),
    read: (m, today) => {
      const day = nextDayOfMonth(today, Number(m[1] ?? m[2]));
      return day ? [day, day] : null;
    },
  },
  // Fixed holidays
  {
    re: /\b(christmas eve|christmas|xmas|new year'?s eve|nye|new year'?s day|new year|valentine'?s(?: day)?|halloween)\b/,
    read: (m, today) => {
      const k = m[1];
      const md: [number, number] =
        k === "christmas eve" ? [12, 24]
        : k === "christmas" || k === "xmas" ? [12, 25]
        : k.startsWith("new year") && k.includes("eve") ? [12, 31]
        : k === "nye" ? [12, 31]
        : k.startsWith("new year") ? [1, 1]
        : k.startsWith("valentine") ? [2, 14]
        : [10, 31];
      const day = nextDate(today, md[0], md[1]);
      return day ? [day, day] : null;
    },
  },
  // Relative days and spans
  {
    re: /\b(day after tomorrow|today|tonight|this evening|right now|tomorrow|tmrw|tmr|next weekend|this weekend|weekend|this week|next week|this month|next month|(?:next|coming) (\d{1,2}) days|in (\d{1,2}) days)\b/,
    read: (m, today) => {
      const k = m[1];
      if (k === "day after tomorrow") return [addDays(today, 2), addDays(today, 2)];
      if (k === "today" || k === "tonight" || k === "this evening" || k === "right now") return [today, today];
      if (k === "tomorrow" || k === "tmrw" || k === "tmr") return [addDays(today, 1), addDays(today, 1)];
      const wd = weekday(today);
      if (k === "weekend" || k === "this weekend") {
        // Saturday and Sunday; on a Sunday, just today.
        if (wd === 0) return [today, today];
        const sat = addDays(today, 6 - wd);
        return [sat, addDays(sat, 1)];
      }
      if (k === "next weekend") {
        // The weekend after this one; on a Sunday, the coming one.
        const sat = wd === 0 ? addDays(today, 6) : addDays(today, 6 - wd + 7);
        return [sat, addDays(sat, 1)];
      }
      if (k === "this week") return [today, addDays(today, (7 - wd) % 7)];
      if (k === "next week") {
        const mon = addDays(today, ((8 - wd) % 7) || 7);
        return [mon, addDays(mon, 6)];
      }
      const [y, mo] = parts(today);
      if (k === "this month") return [today, ymd(y, mo, daysIn(y, mo))];
      if (k === "next month") {
        const ny = mo === 12 ? y + 1 : y;
        const nm = mo === 12 ? 1 : mo + 1;
        return [ymd(ny, nm, 1), ymd(ny, nm, daysIn(ny, nm))];
      }
      const n = Number(m[2] ?? m[3]);
      if (m[3]) return [addDays(today, n), addDays(today, n)];
      return [today, addDays(today, n)];
    },
  },
  // friday, on friday, this friday, next friday, coming saturday
  {
    re: /\b(this |next |coming |on )?(sunday|monday|tuesday|wednesday|thursday|friday|saturday|tues|weds|thurs|thur|mon|tue|wed|thu|fri|sat|sun)\b/,
    read: (m, today) => {
      const word = m[2];
      // Three-letter forms ("sun", "sat", "wed") only with a lead-in word.
      if (word.length <= 3 && !m[1]) return null;
      const target = WEEKDAYS[word];
      const ahead = (target - weekday(today) + 7) % 7;
      const day = addDays(today, ahead + (m[1] === "next " ? 7 : 0));
      return [day, day];
    },
  },
  // in december, this march, next may, december 2026; a full month name alone (not "may"/"march")
  {
    re: new RegExp(`\\b(?:(in|during|this|next|for|by|all of)\\s+)?(${MONTH_RE})\\b(?:\\s+(\\d{4}))?`),
    read: (m, today) => {
      const word = m[2];
      if (!m[1] && !m[3] && (word.length <= 3 || word === "may" || word === "march")) return null;
      const mo = MONTHS[word];
      const [ty, tm] = parts(today);
      let y = m[3] ? Number(m[3]) : mo < tm ? ty + 1 : ty;
      if (m[1] === "next" && !m[3] && mo === tm) y += 1;
      const first = ymd(y, mo, 1);
      const last = ymd(y, mo, daysIn(y, mo));
      if (last < today) return null;
      return [first < today ? today : first, last];
    },
  },
];

/** The days the search asks for, in the city's calendar; null when it names none. */
export function readDays(text: string, now: number, zone: string, dayFirst = true): DayRange | null {
  const q = ` ${text.toLowerCase().replace(/\s+/g, " ")} `;
  const today = localDay(now, zone);
  for (const rule of RULES) {
    const m = q.match(rule.re);
    if (!m) continue;
    const got = rule.read(m, today, dayFirst);
    if (!got) continue;
    const [from, to] = got;
    if (to < today) continue;
    return { from: from < today ? today : from, to, label: label(from < today ? today : from, to, today), source: m[0].trim() };
  }
  return null;
}

// ---- times of day ----------------------------------------------------------

const hourOf = (h: string, min: string | undefined, ampm: string | undefined): number | null => {
  let hour = Number(h);
  if (ampm) {
    if (hour < 1 || hour > 12) return null;
    if (ampm === "pm" && hour !== 12) hour += 12;
    if (ampm === "am" && hour === 12) hour = 0;
  } else if (hour > 23) return null;
  return hour + (min ? Number(min) / 60 : 0);
};
const clock = (h: number) => {
  const hh = Math.floor(h) % 24;
  const mm = Math.round((h % 1) * 60);
  const ap = hh >= 12 ? "pm" : "am";
  return `${hh % 12 || 12}${mm ? `:${pad(mm)}` : ""}${ap}`;
};

/** A time of day ("after 7pm", "evening", "tonight"); null when none is named. */
export function readHours(text: string): Hours | null {
  const q = ` ${text.toLowerCase()} `;
  const t = "(\\d{1,2})(?::(\\d{2}))?\\s*(am|pm)";
  const t24 = "(\\d{1,2}):(\\d{2})";
  let m = q.match(new RegExp(`\\b(after|from|past)\\s+(?:${t}|${t24})`));
  if (m) {
    const h = m[2] ? hourOf(m[2], m[3], m[4]) : hourOf(m[5], m[6], undefined);
    if (h != null) return { from: h, to: 28, label: `After ${clock(h)}`, source: m[0].trim() };
  }
  m = q.match(new RegExp(`\\b(before|by|until|till)\\s+(?:${t}|${t24})`));
  if (m) {
    const h = m[2] ? hourOf(m[2], m[3], m[4]) : hourOf(m[5], m[6], undefined);
    if (h != null) return { from: 0, to: h, label: `Before ${clock(h)}`, source: m[0].trim() };
  }
  m = q.match(new RegExp(`\\b(?:at|around)\\s+(?:${t}|${t24})`));
  if (m) {
    const h = m[1] ? hourOf(m[1], m[2], m[3]) : hourOf(m[4], m[5], undefined);
    if (h != null) return { from: h - 0.5, to: h + 1, label: `Around ${clock(h)}`, source: m[0].trim() };
  }
  m = q.match(/\b(late night|late-night|tonight|this evening|morning|afternoon|evening|night)\b/);
  if (m) {
    const k = m[1];
    if (k === "morning") return { from: 5, to: 12, label: "Morning", source: k };
    if (k === "afternoon") return { from: 12, to: 17, label: "Afternoon", source: k };
    if (k === "evening" || k === "this evening") return { from: 17, to: 22, label: "Evening", source: k };
    if (k === "tonight") return { from: 17, to: 28, label: "Tonight", source: k };
    if (k === "night") return { from: 19, to: 28, label: "Night", source: k };
    return { from: 22, to: 29, label: "Late night", source: k };
  }
  return null;
}

// ---- prices ----------------------------------------------------------------

const CUR = "(?:₹|rs\\.?|inr|\\$|usd|£|gbp|€|eur|aud|cad|sgd|nzd)";
const NUM = "(\\d[\\d,]*(?:\\.\\d+)?)\\s*(k)?";
const amount = (n: string, k?: string) => Number(n.replace(/,/g, "")) * (k ? 1000 : 1);

/** A price limit ("under ₹500", "below 1000", "between 500 and 1500", "over $50"); null when none. */
export function readPrice(text: string): PriceCap | null {
  const q = ` ${text.toLowerCase()} `;
  let m = q.match(new RegExp(`\\bbetween\\s+${CUR}?\\s*${NUM}\\s*${CUR}?\\s*(?:and|-|to)\\s*${CUR}?\\s*${NUM}`));
  if (m) {
    const a = amount(m[1], m[2]);
    const b = amount(m[3], m[4]);
    // "between 22 and 25" is a date, not a price.
    if (b > a && (b > 31 || /₹|rs|inr|\$|£|€|usd|eur|gbp/.test(m[0]))) {
      return { min: a, max: b, label: `${a} to ${b}`, source: m[0].trim() };
    }
  }
  m = q.match(new RegExp(`\\b(under|below|less than|cheaper than|up ?to|upto|max(?:imum)?|within|at most|no more than|not more than|budget(?: of)?)\\s+${CUR}?\\s*${NUM}`));
  if (m) {
    const n = amount(m[2], m[3]);
    if (n > 0) return { min: null, max: n, label: `Under ${n}`, source: m[0].trim() };
  }
  m = q.match(new RegExp(`${CUR}\\s*${NUM}\\s*(?:or less|and under|max|or below|or under)`));
  if (m) {
    const n = amount(m[1], m[2]);
    if (n > 0) return { min: null, max: n, label: `Under ${n}`, source: m[0].trim() };
  }
  m = q.match(new RegExp(`\\b(over|above|more than|at least|min(?:imum)?)\\s+${CUR}?\\s*${NUM}`));
  if (m && !/\b(over|above|more than) \d+\s*(people|guests|years|yrs|km|mins?|minutes|hours)/.test(q)) {
    const n = amount(m[2], m[3]);
    if (n > 0) return { min: n, max: null, label: `Over ${n}`, source: m[0].trim() };
  }
  return null;
}

// ---- matching an event -----------------------------------------------------

const localHour = (ms: number, zone: string) => {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: zone, hourCycle: "h23", hour: "2-digit", minute: "2-digit" }).formatToParts(ms);
  return Number(f.find((p) => p.type === "hour")?.value) + Number(f.find((p) => p.type === "minute")?.value) / 60;
};

/** Does the event happen on those days (a run of several days counts if it overlaps)? */
export function inDays(e: Event, range: DayRange): boolean {
  const zone = eventZone(e) ?? "Asia/Kolkata";
  const start = Date.parse(e.start_time);
  if (Number.isNaN(start)) return false;
  const first = localDay(start, zone);
  const end = e.end_time ? Date.parse(e.end_time) : NaN;
  const last = Number.isNaN(end) ? first : localDay(end - 1, zone);
  if (first > range.to || last < range.from) return false;
  // A weekly series listed as one row ("Friday Karaoke", this Friday to the
  // last one in January) only happens on its weekday, not on every day of
  // the run: it matches a range only if that weekday falls inside it.
  const day = first === last ? null : seriesWeekday(e.title);
  if (day == null) return true;
  const from = first > range.from ? first : range.from;
  const to = last < range.to ? last : range.to;
  for (let d = from, i = 0; d <= to && i < 7; d = addDays(d, 1), i++) if (weekday(d) === day) return true;
  return false;
}

/** The one weekday a series is named for ("Friday Karaoke", "Mehfil Monday"), or null. */
function seriesWeekday(title: string): number | null {
  const words = title.toLowerCase().match(/[a-z]+/g) ?? [];
  const named = new Set(words.map((w) => DAY_NAMES.findIndex((d) => d.toLowerCase() === w.replace(/s$/, ""))).filter((i) => i >= 0));
  return named.size === 1 ? [...named][0] : null;
}

/** Does it start in that part of the day? Date-only listings (midnight) are left in. */
export function inHours(e: Event, hours: Hours): boolean {
  const zone = eventZone(e) ?? "Asia/Kolkata";
  const h = localHour(Date.parse(e.start_time), zone);
  if (h === 0) return true;
  const hh = h < 5 && hours.to > 24 ? h + 24 : h;
  return hh >= hours.from && hh < hours.to;
}

/** Is the cheapest way in within the cap? Free counts as 0; an unknown price does not pass. */
export function inPriceCap(e: Event, cap: PriceCap): boolean {
  const lowest = e.is_free ? 0 : e.price_min;
  if (lowest == null) return false;
  if (cap.max != null && lowest > cap.max) return false;
  if (cap.min != null && lowest < cap.min && !(e.price_max != null && e.price_max >= cap.min)) return false;
  return true;
}
