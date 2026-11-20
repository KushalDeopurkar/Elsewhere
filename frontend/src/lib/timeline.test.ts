import { describe, expect, it } from "vitest";
import { busyness, eventsAt, momentLabel, statusAt, timelineStart } from "./timeline";
import type { Event } from "./types";

const NOW = Date.parse("2026-11-17T06:20:00Z"); // Tue 11:50 IST
const ev = (id: string, start: string, end: string | null = null): Event => ({
  id, title: id, description: null, category: "music", start_time: start, end_time: end, location_name: null,
  address: null, city: null, country: null, lat: 19, lng: 72, image_url: null, url: null, price_min: null,
  price_max: null, is_free: true, source: "t", distance_km: null, relevance: null,
});

describe("statusAt", () => {
  it("live during, soon within 3h, otherwise null", () => {
    const e = ev("a", "2026-11-17T08:00:00Z");
    expect(statusAt(e, Date.parse("2026-11-17T08:30:00Z"))).toBe("live");
    expect(statusAt(e, Date.parse("2026-11-17T06:00:00Z"))).toBe("soon");
    expect(statusAt(e, Date.parse("2026-11-17T04:00:00Z"))).toBeNull();
    expect(statusAt(e, Date.parse("2026-11-17T10:30:00Z"))).toBeNull(); // default 2h length over
  });
  it("caps very long listings at 12h", () => {
    const fest = ev("f", "2026-11-17T04:00:00Z", "2026-11-20T04:00:00Z");
    expect(statusAt(fest, Date.parse("2026-11-17T15:00:00Z"))).toBe("live");
    expect(statusAt(fest, Date.parse("2026-11-18T15:00:00Z"))).toBeNull();
  });
});

describe("eventsAt", () => {
  it("returns on and upcoming events and marks live ones", () => {
    const r = eventsAt([ev("a", "2026-11-17T06:00:00Z"), ev("b", "2026-11-17T08:00:00Z"), ev("c", "2026-11-19T08:00:00Z")], NOW);
    expect(r.events.map((e) => e.id)).toEqual(["a", "b"]);
    expect([...r.live]).toEqual(["a"]);
  });
});

describe("busyness", () => {
  it("buckets starts by 3h across the week", () => {
    const start = timelineStart(NOW);
    const b = busyness([ev("a", "2026-11-17T07:00:00Z"), ev("b", "2026-11-17T07:30:00Z"), ev("c", "2026-11-17T12:00:00Z"), ev("old", "2026-11-16T07:00:00Z")], start);
    expect(b).toHaveLength(56);
    expect(b[0]).toBe(2);
    expect(b[2]).toBe(1);
    expect(b.reduce((x, y) => x + y)).toBe(3);
  });
});

describe("timelineStart", () => {
  it("floors to the India-time hour", () => {
    expect(new Date(timelineStart(NOW)).toISOString()).toBe("2026-11-17T05:30:00.000Z"); // 11:00 IST
  });
});

describe("momentLabel", () => {
  it("reads naturally", () => {
    expect(momentLabel(timelineStart(NOW), NOW)).toBe("Now");
    expect(momentLabel(Date.parse("2026-11-17T15:30:00Z"), NOW)).toBe("Today 9 pm");
    expect(momentLabel(Date.parse("2026-11-18T05:30:00Z"), NOW)).toBe("Tomorrow 11 am");
    expect(momentLabel(Date.parse("2026-11-21T05:30:00Z"), NOW)).toBe("Sat 11 am");
  });
});
