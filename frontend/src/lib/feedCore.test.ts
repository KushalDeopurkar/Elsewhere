import { describe, expect, it } from "vitest";
import { nextBatch } from "./feedCore";
import { EMPTY_PROFILE, addSeen, applySignal } from "./tasteCore";
import type { Event } from "./types";

const NOW = Date.parse("2026-11-17T06:00:00Z");
const ev = (id: string, over: Partial<Event> = {}): Event => ({
  id, title: id, description: null, category: "music", start_time: "2026-11-18T14:00:00Z", end_time: null,
  location_name: null, address: null, city: null, country: null, lat: null, lng: null, image_url: null, url: null,
  price_min: 300, price_max: null, is_free: false, source: "t", distance_km: null, relevance: null, ...over,
});

describe("nextBatch", () => {
  it("skips shown events, ignores deck seen list, caps size", () => {
    const pool = Array.from({ length: 12 }, (_, i) => ev(`e${i}`));
    const out = nextBatch(pool, new Set(["e0", "e1"]), addSeen(EMPTY_PROFILE, "e2"), { n: 5, now: NOW, random: () => 0 });
    expect(out).toHaveLength(5);
    expect(out.map((e) => e.id)).not.toContain("e0");
    expect(pool.slice(2).some((e) => out.includes(e))).toBe(true);
  });
  it("adapts to taste: liked category leads the next batch", () => {
    let p = EMPTY_PROFILE;
    for (let i = 0; i < 6; i++) p = applySignal(p, ev("x", { category: "tech" }), "dwell");
    const pool = [...Array.from({ length: 4 }, (_, i) => ev(`m${i}`)), ...Array.from({ length: 4 }, (_, i) => ev(`t${i}`, { category: "tech" }))];
    expect(nextBatch(pool, new Set(), p, { now: NOW, random: () => 0 })[0].category).toBe("tech");
  });
});
