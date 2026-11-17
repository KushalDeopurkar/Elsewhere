import { describe, expect, it } from "vitest";
import { EMPTY_PASSPORT, badges, newlyEarned, stampEvent } from "./passportCore";
import type { Event } from "./types";

const ev = (over: Partial<Event>): Event => ({
  id: "x", title: "T", description: null, category: "music", start_time: "2026-11-21T16:30:00Z", end_time: null,
  location_name: "Venue A", address: null, city: "Mumbai", country: "IN", lat: null, lng: null, image_url: null,
  url: null, price_min: null, price_max: null, is_free: false, source: "t", distance_km: null, relevance: null, ...over,
});
const label = (c: string) => c.toUpperCase();

describe("passport", () => {
  it("stamps a category and city once", () => {
    const a = stampEvent(EMPTY_PASSPORT, ev({ id: "1" }), "t1", label);
    expect(a.fresh).toEqual([{ kind: "category", label: "MUSIC" }, { kind: "city", label: "Mumbai" }]);
    const b = stampEvent(a.next, ev({ id: "2" }), "t2", label);
    expect(b.fresh).toEqual([]);
    expect(b.next.cats.music).toBe("t1");
  });
  it("counts night (10 pm IST), early and free", () => {
    let p = EMPTY_PASSPORT;
    p = stampEvent(p, ev({ id: "n", start_time: "2026-11-21T16:30:00Z" }), "t", label).next; // 10 pm IST
    p = stampEvent(p, ev({ id: "e", start_time: "2026-11-21T01:30:00Z", is_free: true }), "t", label).next; // 7 am IST
    p = stampEvent(p, ev({ id: "d", start_time: "2026-11-20T18:30:00Z" }), "t", label).next; // midnight: date only
    expect(p.night).toEqual(["n"]);
    expect(p.early).toEqual(["e"]);
    expect(p.free).toEqual(["e"]);
  });
  it("ignores 'other' for category stamps", () => {
    expect(stampEvent(EMPTY_PASSPORT, ev({ category: "other", city: null }), "t", label).fresh).toEqual([]);
  });
  it("earns badges and reports new ones", () => {
    const before = badges(EMPTY_PASSPORT, 0);
    let p = EMPTY_PASSPORT;
    for (const c of ["music", "tech", "food"] as const) p = stampEvent(p, ev({ id: c, category: c }), "t", label).next;
    const after = badges(p, 3);
    expect(newlyEarned(before, after).map((b) => b.id).sort()).toEqual(["curious", "owl", "regular"]);
    expect(after.find((b) => b.id === "omnivore")).toMatchObject({ have: 3, need: 8, earned: false });
  });
});
