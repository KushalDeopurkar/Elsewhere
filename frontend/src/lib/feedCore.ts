/**
 * Endless feed batching. Each new batch is ranked by the taste profile as it
 * is *now*, so what someone lingers on early shapes what comes next.
 */
import type { Event } from "./types";
import { rankForDeck, type TasteProfile } from "./tasteCore";

export const BATCH = 8;

export function nextBatch(
  pool: Event[],
  shown: ReadonlySet<string>,
  profile: TasteProfile,
  opts: { n?: number; now?: number; random?: () => number } = {},
): Event[] {
  const rest = pool.filter((e) => !shown.has(e.id));
  // The feed ignores the swipe deck's "seen" list: scrolling is browsing.
  return rankForDeck(rest, { ...profile, seen: [] }, { now: opts.now, random: opts.random }).slice(0, opts.n ?? BATCH);
}
