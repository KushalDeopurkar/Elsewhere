/**
 * "Did you mean": fix spelling mistakes and unfinished place names in a
 * search before it is read, so "gigs in pars" and "gigs in par" both search
 * Paris, and "comdey in mumbia" searches comedy in Mumbai. Only words the
 * search would otherwise not understand are touched, and every change is
 * returned so the page can say what it searched instead.
 */

import { PLACE_NAMES } from "./cities";
import { QUERY_PHRASES } from "./intent";
import { CATEGORIES } from "./types";
import { editDistance, isTypoOf, typoLimit, wordsOf } from "./fuzzy";

export interface Fix {
  from: string;
  to: string;
}

export interface Spelled {
  /** The query with the fixes applied (unchanged when there are none). */
  text: string;
  fixes: Fix[];
}

/** Everyday words that are never corrected, however close they sit to a place. */
const COMMON = new Set(
  (
    "a an and or the in on at to of for from by with near around me my i we you it is are be any some all " +
    "what whats where when which who how this that these those next last new old big small good best top " +
    "event events thing things stuff something anything show find get go do see want looking look need " +
    "tonight today tomorrow week weekend month year day night morning evening afternoon " +
    "january february march april may june july august september october november december " +
    "jan feb mar apr jun jul aug sep sept oct nov dec " +
    "monday tuesday wednesday thursday friday saturday sunday mon tue wed thu fri sat sun " +
    "under over above below cheap free paid price ticket tickets rs inr usd " +
    "kid kids adult adults student students men women girls boys couple couples " +
    "fun cool chill nice great open late early up out off not no yes " +
    "sea beach park lake river hill hills city town street road cafe pub bar club wine beer tea " +
    "jazz rock pop rap folk indie dance salsa comedy standup quiz trivia chess poker film movie " +
    "art craft pottery dinner lunch brunch talk show play opera ballet book books game games team"
  ).split(" "),
);

/** Single words the reader knows (from its phrases and the category names). */
const KNOWN = new Set([
  ...QUERY_PHRASES.flatMap(wordsOf),
  ...CATEGORIES.flatMap((c) => wordsOf(c.label)),
  ...PLACE_NAMES.flatMap(wordsOf),
]);

/** Words a typo may be corrected to: places first (busiest first), then the reader's words. */
const PLACES_ONE = PLACE_NAMES.filter((p) => !p.includes(" "));
const PLACES_MULTI = PLACE_NAMES.filter((p) => p.includes(" "));
const VOCAB = [...new Set(QUERY_PHRASES.flatMap(wordsOf).filter((w) => w.length >= 4))];

function closest(typed: string, candidates: string[]): string | null {
  let best: string | null = null;
  let bestD = Infinity;
  for (const c of candidates) {
    if (!isTypoOf(typed, c)) continue;
    const d = editDistance(typed, c, typoLimit(Math.min(typed.length, c.length)));
    if (d < bestD) {
      best = c;
      bestD = d;
    }
  }
  return best;
}

/** What one unknown word most likely meant, or null to leave it alone. */
function fixWord(w: string, local: Set<string>, localList: string[]): string | null {
  if (w.length < 3 || /\d/.test(w) || KNOWN.has(w) || COMMON.has(w) || local.has(w)) return null;
  // A plural or other form of a real word is spelled right ("workshops").
  for (const base of [w.replace(/ies$/, "y"), w.replace(/(ches|shes|sses|xes)$/, (m) => m.slice(0, -2)), w.replace(/s$/, ""), w.replace(/ing$/, ""), w.replace(/ed$/, "")]) {
    if (base !== w && base.length >= 3 && (KNOWN.has(base) || local.has(base) || COMMON.has(base))) return null;
  }
  // Typos first: "pars" is Paris, "mumbia" is Mumbai, "comdey" is comedy
  // (a word from the events on show), "workshp" is workshop.
  const typo = closest(w, PLACES_ONE) ?? closest(w, VOCAB) ?? closest(w, localList);
  if (typo) return typo;
  // Then an unfinished place name, from three letters: "par" is Paris.
  const start = PLACE_NAMES.find((p) => p.startsWith(w));
  return start ?? null;
}

/**
 * @param raw what was typed
 * @param seen words from the events on show (titles, venues): real words
 *   there are never "corrected", and typos of them are ("comdey").
 */
export function correctQuery(raw: string, seen: Iterable<string> = []): Spelled {
  const fixes: Fix[] = [];
  const local = new Set<string>();
  for (const w of seen) if (w.length >= 4 && !/\d/.test(w)) local.add(w);
  const localList = [...local];
  // Keep the person's own spacing and punctuation; replace whole words only.
  let text = raw.replace(/[A-Za-zÀ-ɏ]+/g, (word) => {
    const lower = wordsOf(word)[0] ?? "";
    const to = lower ? fixWord(lower, local, localList) : null;
    if (!to || to === lower) return word;
    fixes.push({ from: word, to });
    return to;
  });

  // Two-word places typed with a slip across both words ("new yrok").
  if (!fixes.length) {
    const words = wordsOf(raw);
    for (let i = 0; i + 1 < words.length; i++) {
      const pair = `${words[i]} ${words[i + 1]}`;
      if (PLACE_NAMES.includes(pair) || COMMON.has(words[i + 1]) || KNOWN.has(words[i + 1])) continue;
      const hit = closest(pair, PLACES_MULTI);
      if (hit) {
        const re = new RegExp(`${words[i]}\\W+${words[i + 1]}`, "i");
        text = text.replace(re, hit);
        fixes.push({ from: pair, to: hit });
        break;
      }
    }
  }
  return { text, fixes };
}

/** Is this a word the search knows (its own vocabulary, places, or everyday words)? */
export function isKnownWord(w: string): boolean {
  const x = w.toLowerCase();
  return KNOWN.has(x) || COMMON.has(x) || KNOWN.has(x.replace(/s$/, ""));
}
