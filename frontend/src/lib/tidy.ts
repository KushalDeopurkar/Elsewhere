/**
 * Listing hygiene shared by every surface: the same event posted on two
 * sites (or twice on one) is shown once, test listings never reach people,
 * and decorative emoji don't lead a headline.
 *
 * Twins: same local day, at the same venue (or within ~200 m), with titles
 * that say the same thing once case, accents, emoji, punctuation, the city
 * name and filler like "presents" or "tour" are set aside ("ANYMA presents
 * AEDEN", "Anyma presents ÆDEN - Mumbai" and "Anyma ÆDEN Tour – Mumbai" are
 * one concert). Of a set, the listing with a picture, a price and a
 * description is kept.
 */

import type { Event } from "./types";
import { kmBetween } from "./geo";

const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}\u{20E3}]/gu;

/** Lower case, no accents or emoji, "æ" as "ae", words separated by single spaces. */
export function normTitle(t: string): string {
  return t
    .replace(EMOJI, " ")
    .replace(/æ/gi, "ae")
    .replace(/œ/gi, "oe")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** The title to show: leading and trailing emoji and stray separators removed. */
export function displayTitle(t: string): string {
  const trimmed = t
    .replace(/^[\s\p{Extended_Pictographic}\u{FE0F}\u{200D}|•·:\-–—]+/u, "")
    .replace(/[\s\p{Extended_Pictographic}\u{FE0F}\u{200D}|•·:\-–—]+$/u, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return trimmed || t.trim();
}

/** Listings that are plainly tests or placeholders, not events. */
export function isJunk(e: Pick<Event, "title">): boolean {
  const t = normTitle(e.title);
  return (
    t.length < 2 ||
    /^(test|testing|test event|sample event|dummy|dummy event|untitled|untitled event|tbd|tba|placeholder|asdf\w*)$/.test(t) ||
    /\b(broken images?|do not (book|attend|use)|lorem ipsum|test listing|qa test)\b/.test(t)
  );
}

/** Words that don't make two titles different events. */
const FILLER = new Set(
  "a an the and of in at on for with by presents present presented live tour concert show edition ft feat featuring vs x india".split(" "),
);

function titleWords(e: Event): Set<string> {
  const city = normTitle(e.city ?? "");
  return new Set(
    normTitle(e.title)
      .split(" ")
      .filter((w) => w.length > 1 && !FILLER.has(w) && w !== city && !/^\d{4}$/.test(w)),
  );
}

/** Do the two titles name the same thing? */
function sameTitle(a: Set<string>, b: Set<string>): boolean {
  if (!a.size || !b.size) return false;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared += 1;
  const smaller = Math.min(a.size, b.size);
  // All of the shorter title is in the longer one, or most words are shared.
  return shared === smaller || shared / Math.max(a.size, b.size) >= 0.6;
}

const dayOf = (e: Event) => e.start_time.slice(0, 10);
const venueOf = (e: Event) => normTitle(e.location_name ?? "");

function samePlace(a: Event, b: Event): boolean {
  const va = venueOf(a);
  const vb = venueOf(b);
  if (va && vb && (va === vb || va.includes(vb) || vb.includes(va))) return true;
  if (a.lat != null && a.lng != null && b.lat != null && b.lng != null) return kmBetween(a.lat, a.lng, b.lat, b.lng) <= 0.2;
  return false;
}

/** How complete a listing is, to choose which twin to keep. */
const richness = (e: Event) =>
  (e.image_url ? 4 : 0) + (e.price_min != null || e.is_free ? 2 : 0) + (e.description ? 1 : 0) + (e.end_time ? 1 : 0);

export function areTwins(a: Event, b: Event): boolean {
  if (a.id === b.id) return true;
  if (dayOf(a) !== dayOf(b)) return false;
  // Exactly the same title at the same minute is the same listing anywhere.
  if (normTitle(a.title) === normTitle(b.title) && a.start_time.slice(0, 16) === b.start_time.slice(0, 16)) return true;
  return samePlace(a, b) && sameTitle(titleWords(a), titleWords(b));
}

/**
 * One of each event, keeping the order of first appearance but the
 * richest listing of each set of twins. Test listings are dropped.
 */
export function dedupeEvents(events: Event[]): Event[] {
  const kept: Event[] = [];
  const byDay = new Map<string, number[]>();
  for (const e of events) {
    if (isJunk(e)) continue;
    const day = dayOf(e);
    const same = (byDay.get(day) ?? []).find((i) => areTwins(kept[i], e));
    if (same != null) {
      if (richness(e) > richness(kept[same])) kept[same] = e;
      continue;
    }
    byDay.set(day, [...(byDay.get(day) ?? []), kept.length]);
    kept.push(e);
  }
  return kept;
}
