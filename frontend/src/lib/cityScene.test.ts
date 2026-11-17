import { describe, expect, it } from "vitest";
import { RADIUS_UNITS, beacons, cityLights, project, rng, seedOf } from "./cityScene";
import type { Event } from "./types";

const C = { lat: 19.076, lng: 72.8777 };
const ev = (id: string, lat: number | null, lng: number | null, start = "2026-11-17T10:00:00Z"): Event => ({
  id, title: id, description: null, category: "music", start_time: start, end_time: null, location_name: null,
  address: null, city: null, country: null, lat, lng, image_url: null, url: null, price_min: null, price_max: null,
  is_free: true, source: "t", distance_km: null, relevance: null,
});

describe("project", () => {
  it("puts the centre at the origin and north at -z", () => {
    const [x0, z0] = project(C.lat, C.lng, C);
    expect(Math.abs(x0) + Math.abs(z0)).toBe(0);
    const [, z] = project(C.lat + 0.1, C.lng, C);
    expect(z).toBeCloseTo(-5.53, 1); // ~11 km north = ~5.5 units
  });
});

describe("cityLights", () => {
  it("is deterministic per seed and stays inside the radius", () => {
    const a = cityLights(seedOf("Mumbai"), 500);
    const b = cityLights(seedOf("Mumbai"), 500);
    expect(Array.from(a.positions)).toEqual(Array.from(b.positions));
    for (let i = 0; i < 500; i++) expect(Math.hypot(a.positions[i * 3], a.positions[i * 3 + 2])).toBeLessThan(RADIUS_UNITS * 1.5);
    expect(rng(1)()).toBe(rng(1)());
  });
});

describe("beacons", () => {
  it("skips events without coordinates or far away, sizes by soonness", () => {
    const now = Date.parse("2026-11-17T09:00:00Z");
    const out = beacons(
      [ev("near", 19.08, 72.88), ev("none", null, null), ev("pune", 18.52, 73.85), ev("later", 19.1, 72.9, "2026-11-25T10:00:00Z")],
      C,
      now,
    );
    expect(out.map((b) => b.event.id)).toEqual(["near", "later"]);
    expect(out[0].h).toBeGreaterThan(out[1].h);
  });
  it("fans events at the same venue apart, all distinct", () => {
    const out = beacons(Array.from({ length: 12 }, (_, i) => ev(`e${i}`, 19.08, 72.88)), C, 0);
    const keys = new Set(out.map((b) => `${b.x.toFixed(3)},${b.z.toFixed(3)}`));
    expect(keys.size).toBe(12);
    for (const b of out) expect(Math.hypot(b.x - out[0].x, b.z - out[0].z)).toBeLessThan(1);
  });
});
