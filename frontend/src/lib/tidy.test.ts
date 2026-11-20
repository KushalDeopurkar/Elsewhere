import { describe, expect, it } from "vitest";
import { dedupeEvents, displayTitle, isJunk, normTitle } from "./tidy";
import type { Event } from "./types";

const ev = (o: Partial<Event>): Event =>
  ({ id: Math.random().toString(36), title: "x", category: "music", start_time: "2026-11-28T14:00:00Z", end_time: null,
     location_name: "Jio World Garden", address: null, city: "Mumbai", country: "IN", lat: 19.06, lng: 72.86,
     image_url: null, url: null, price_min: null, price_max: null, is_free: false, source: "a", ...o }) as Event;

describe("tidy", () => {
  it("normalises titles", () => {
    expect(normTitle("Anyma presents ÆDEN – Mumbai 🔥")).toBe("anyma presents aeden mumbai");
    expect(normTitle("Café Crème")).toBe("cafe creme");
  });
  it("one concert listed three ways is shown once, keeping the richest", () => {
    const list = [
      ev({ title: "ANYMA presents AEDEN" }),
      ev({ title: "Anyma presents ÆDEN - Mumbai", image_url: "https://x/p.jpg", price_min: 4000 }),
      ev({ title: "Anyma ÆDEN Tour – Mumbai", start_time: "2026-11-28T14:30:00Z" }),
      ev({ title: "Fred again.. in Mumbai" }),
    ];
    const out = dedupeEvents(list);
    expect(out.map((e) => e.title)).toEqual(["Anyma presents ÆDEN - Mumbai", "Fred again.. in Mumbai"]);
  });
  it("keeps the same show on different days, and different shows at one venue", () => {
    expect(dedupeEvents([ev({ title: "Founders Running Club" }), ev({ title: "Founders Running Club", start_time: "2026-12-05T01:00:00Z" })])).toHaveLength(2);
    expect(dedupeEvents([ev({ title: "Jazz Night" }), ev({ title: "Comedy Night" })])).toHaveLength(2);
  });
  it("drops test listings and trims decorative emoji", () => {
    expect(isJunk({ title: "BROKEN IMAGES" })).toBe(true);
    expect(isJunk({ title: "Test event" })).toBe(true);
    expect(isJunk({ title: "Testing the Waters: a Pottery Class" })).toBe(false);
    expect(displayTitle("🎬🔥 Movie Night Under The Stars 🔥🎬")).toBe("Movie Night Under The Stars");
    expect(displayTitle("🎉")).toBe("🎉");
  });
});
