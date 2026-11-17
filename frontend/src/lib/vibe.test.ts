import { describe, expect, it } from "vitest";
import { BUDGET_MAX, DEFAULT_FILTERS, applyVibe, filtersFromParams, filtersToQuery, vibeFit } from "./vibe";
import type { Event } from "./types";

const NOW = new Date("2026-11-17T06:00:00Z"); // Tue 11:30 IST
const C = { lat: 19.076, lng: 72.8777 }; // Mumbai
function ev(id: string, over: Partial<Event> = {}): Event {
  return {
    id, title: id, description: null, category: "music", start_time: "2026-11-17T16:30:00Z", end_time: null,
    location_name: null, address: null, city: "Mumbai", country: "IN", lat: 19.08, lng: 72.88, image_url: null,
    url: null, price_min: 300, price_max: null, is_free: false, source: "t", distance_km: null, relevance: null, ...over,
  };
}

describe("vibeFit", () => {
  it("scores category, keywords and slot", () => {
    expect(vibeFit(ev("Techno party all night"), ["wild"])).toBe(4.5);
    expect(vibeFit(ev("a", { category: "tech" }), ["wild"])).toBe(0);
    expect(vibeFit(ev("Pottery workshop", { category: "other" }), ["creative", "learn"])).toBe(1);
  });
});

describe("applyVibe", () => {
  it("filters by vibe, budget, distance and date", () => {
    const events = [
      ev("gig"),
      ev("pricey", { price_min: 4000 }),
      ev("far", { lat: 18.52, lng: 73.85 }), // Pune
      ev("talk", { category: "education" }),
      ev("later", { start_time: "2026-11-30T16:30:00Z" }),
      ev("past", { start_time: "2026-11-16T10:00:00Z" }),
    ];
    const ids = (f: Partial<typeof DEFAULT_FILTERS>) =>
      applyVibe(events, { ...DEFAULT_FILTERS, ...f }, C, { now: NOW }).map((h) => h.event.id);
    expect(ids({})).toHaveLength(5);
    expect(ids({ vibes: ["wild"], budget: 1000, distance: 20, when: "today" })).toEqual(["gig"]);
    expect(ids({ vibes: ["learn"] })).toEqual(["talk"]);
    expect(ids({ when: "week" })).not.toContain("later");
  });
  it("ranks better vibe fit first, then taste", () => {
    const hits = applyVibe([ev("plain"), ev("DJ rave night")], { ...DEFAULT_FILTERS, vibes: ["wild"] }, C, { now: NOW });
    expect(hits[0].event.id).toBe("DJ rave night");
    const byTaste = applyVibe([ev("a"), ev("b")], DEFAULT_FILTERS, C, { now: NOW, taste: (e) => (e.id === "b" ? 90 : 10) });
    expect(byTaste[0].event.id).toBe("b");
  });
});

describe("url", () => {
  it("round-trips", () => {
    const f = { vibes: ["chill", "social"] as const, budget: 1000, distance: 10, when: "weekend" as const };
    const q = filtersToQuery({ ...f, vibes: [...f.vibes] });
    expect(q).toBe("?v=chill%2Csocial&b=1000&d=10&w=weekend");
    expect(filtersFromParams(new URLSearchParams(q))).toEqual({ ...f, vibes: ["chill", "social"] });
    expect(filtersFromParams(new URLSearchParams("v=nope&b=0")).budget).toBe(0);
    expect(filtersFromParams(new URLSearchParams("")).budget).toBe(BUDGET_MAX);
  });
});
