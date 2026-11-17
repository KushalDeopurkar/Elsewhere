import { describe, expect, it } from "vitest";
import {
  EMPTY_PROFILE, MAX_W, addSeen, applySignal, priceBand, rankForDeck, scoreEvent, slotOf, tasteSummary,
  type TasteProfile,
} from "./tasteCore";
import type { Event } from "./types";

const NOW = Date.parse("2026-11-17T06:00:00Z");
function ev(id: string, over: Partial<Event> = {}): Event {
  return {
    id, title: id, description: null, category: "music", start_time: "2026-11-18T14:00:00Z", end_time: null,
    location_name: null, address: null, city: "Mumbai", country: "IN", lat: null, lng: null, image_url: null,
    url: null, price_min: 300, price_max: null, is_free: false, source: "test", distance_km: null, relevance: null,
    ...over,
  };
}
const warm = (p: TasteProfile = EMPTY_PROFILE): TasteProfile => ({ ...p, signals: 10 });

describe("buckets", () => {
  it("price bands", () => {
    expect(priceBand({ is_free: true, price_min: null })).toBe("free");
    expect(priceBand({ is_free: false, price_min: 500 })).toBe("low");
    expect(priceBand({ is_free: false, price_min: 1500 })).toBe("mid");
    expect(priceBand({ is_free: false, price_min: 3000 })).toBe("high");
  });
  it("slots use India time", () => {
    expect(slotOf("2026-11-18T03:30:00Z")).toBe("morning"); // 9:00 IST
    expect(slotOf("2026-11-18T08:30:00Z")).toBe("afternoon"); // 14:00
    expect(slotOf("2026-11-18T14:00:00Z")).toBe("evening"); // 19:30
    expect(slotOf("2026-11-18T17:30:00Z")).toBe("night"); // 23:00
  });
});

describe("applySignal", () => {
  it("adds weights to category, price and slot", () => {
    const p = applySignal(EMPTY_PROFILE, ev("a"), "save");
    expect(p.category.music).toBe(3);
    expect(p.price.low).toBe(3);
    expect(p.slot.evening).toBe(3);
    expect(p.signals).toBe(1);
  });
  it("undo reverses a signal", () => {
    const p = applySignal(applySignal(EMPTY_PROFILE, ev("a"), "skip"), ev("a"), "skip", -1);
    expect(p.category.music).toBe(0);
    expect(p.signals).toBe(0);
  });
  it("clamps weights", () => {
    let p = EMPTY_PROFILE;
    for (let i = 0; i < 20; i++) p = applySignal(p, ev("a"), "save");
    expect(p.category.music).toBe(MAX_W);
  });
});

describe("scoreEvent", () => {
  it("cold start scores 50 plus soon bonus with no reasons", () => {
    expect(scoreEvent(ev("a"), EMPTY_PROFILE, NOW)).toEqual({ score: 56, reasons: [] });
  });
  it("liked category scores higher and explains why", () => {
    const p = warm(applySignal(applySignal(EMPTY_PROFILE, ev("x"), "save"), ev("y"), "save"));
    const liked = scoreEvent(ev("a"), p, NOW);
    const other = scoreEvent(ev("b", { category: "tech", is_free: true, start_time: "2026-11-18T03:30:00Z" }), p, NOW);
    expect(liked.score).toBeGreaterThan(other.score);
    expect(liked.reasons[0]).toBe("You like Music");
    expect(liked.reasons).toHaveLength(2);
  });
});

describe("rankForDeck", () => {
  it("drops seen and past events", () => {
    const p = addSeen(EMPTY_PROFILE, "seen");
    const out = rankForDeck([ev("seen"), ev("past", { start_time: "2026-11-10T10:00:00Z" }), ev("ok")], p, { now: NOW });
    expect(out.map((e) => e.id)).toEqual(["ok"]);
  });
  it("puts an explore pick from the lower half at every 5th slot", () => {
    let p = EMPTY_PROFILE;
    for (let i = 0; i < 6; i++) p = applySignal(p, ev("m"), "save");
    const music = Array.from({ length: 8 }, (_, i) => ev(`m${i}`));
    const tech = Array.from({ length: 8 }, (_, i) => ev(`t${i}`, { category: "tech", price_min: 3000, start_time: "2026-11-18T03:30:00Z" }));
    const out = rankForDeck([...tech, ...music], p, { now: NOW, random: () => 0 });
    expect(out).toHaveLength(16);
    expect(out[0].category).toBe("music");
    expect(out[4].category).toBe("tech");
  });
});

describe("tasteSummary", () => {
  it("lists top positive categories", () => {
    const p = applySignal(applySignal(EMPTY_PROFILE, ev("a"), "save"), ev("b", { category: "tech" }), "skip");
    const s = tasteSummary(p);
    expect(s.cats.map((c) => c.value)).toEqual(["music"]);
    expect(s.slot).toBe("evening");
  });
});
