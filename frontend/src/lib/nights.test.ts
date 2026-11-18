import { describe, expect, it } from "vitest";
import { groupByNight } from "./nights";
import type { Event } from "./types";

const NOW = Date.parse("2026-11-19T12:30:00Z"); // Thu 18:00 IST
let n = 0;
const ev = (iso: string): Event => ({
  id: String(++n), title: "x", description: null, category: "music", start_time: iso, end_time: null, location_name: null,
  address: null, city: null, country: "IN", lat: null, lng: null, image_url: null, url: null, price_min: null, price_max: null,
  is_free: false, source: "t", distance_km: null, relevance: null,
});

describe("groupByNight", () => {
  it("labels and orders nights in IST", () => {
    const g = groupByNight(
      [ev("2026-11-21T14:00:00Z"), ev("2026-11-19T15:00:00Z"), ev("2026-11-19T19:00:00Z"), ev("2026-11-20T14:00:00Z")],
      NOW,
      { night: true },
    );
    // 19:00Z on the 19th is 00:30 IST on the 20th -> tomorrow.
    expect(g.map((x) => [x.label, x.events.length])).toEqual([
      ["Tonight", 1],
      ["Tomorrow", 2],
      ["Sat, 21 Nov", 1],
    ]);
  });
  it("folds still-running earlier events into today", () => {
    expect(groupByNight([ev("2026-11-18T10:00:00Z")], NOW)[0].label).toBe("Today");
  });
});
