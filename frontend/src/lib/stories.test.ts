import { describe, expect, it } from "vitest";
import { pickStories } from "./stories";
import type { Event } from "./types";

// Thu 19 Nov 2026, 12:00 IST
const NOW = Date.parse("2026-11-19T06:30:00Z");
let n = 0;
const ev = (iso: string, category: Event["category"], image = true): Event => ({
  id: String(++n), title: `E${n}`, description: null, category, start_time: iso, end_time: null,
  location_name: null, address: null, city: "Mumbai", country: "IN", lat: null, lng: null,
  image_url: image ? "https://x/y.jpg" : null, url: null, price_min: null, price_max: null,
  is_free: false, source: "t", distance_km: null, relevance: null,
});
const SAT = "2026-11-21T14:00:00Z"; // Sat 7:30 pm IST
const SUN = "2026-11-22T13:00:00Z";
const MON = "2026-11-23T13:00:00Z";

describe("pickStories", () => {
  it("uses the weekend and spreads categories", () => {
    const list = [
      ev(SAT, "music"), ev(SAT, "music"), ev(SAT, "music"), ev(SAT, "music"),
      ev(SUN, "food"), ev(SUN, "arts"),
    ];
    const r = pickStories(list, 4, NOW);
    expect(r.label).toBe("This weekend");
    const cats = r.events.map((e) => e.category);
    expect(cats).toContain("food");
    expect(cats).toContain("arts");
    expect(r.events).toHaveLength(4);
  });
  it("tops up from the week and drops picture-less events", () => {
    const r = pickStories([ev(SAT, "music"), ev(MON, "tech"), ev(MON, "food", false)], 10, NOW);
    expect(r.label).toBe("This week");
    expect(r.events.map((e) => e.category).sort()).toEqual(["music", "tech"]);
  });
});
