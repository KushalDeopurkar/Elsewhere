import { describe, expect, it } from "vitest";

import { upcoming as upcoming2, listingStatus } from "./eventFilters";
import type { Event as Ev } from "./types";

const ev = (over: Partial<Ev>): Ev =>
  ({
    id: Math.random().toString(36),
    title: "Talk",
    start_time: "2099-01-01T12:00:00Z",
    city: "Mumbai",
    category: "tech",
    is_free: false,
    source: "x",
    ...over,
  }) as Ev;

describe("upcoming() data hygiene", () => {
  it("drops the same listing posted on two sites", () => {
    const a = ev({ id: "a", title: "AI Meetup: Agents!", source: "allevents" });
    const b = ev({ id: "b", title: "ai meetup agents", source: "meetup" });
    expect(upcoming2([a, b], 0).map((e) => e.id)).toEqual(["a"]);
  });
  it("drops listings marked cancelled and unreadable dates", () => {
    expect(upcoming2([ev({ title: "CANCELLED: Jazz night" }), ev({ start_time: "not a date" })], 0)).toHaveLength(0);
  });
  it("reads status only from explicit words", () => {
    expect(listingStatus({ title: "Postponed - Book fair" })).toBe("postponed");
    expect(listingStatus({ title: "Sold-out comedy night" })).toBe("sold out");
    expect(listingStatus({ title: "Cancel culture debate" })).toBeNull();
  });
});
