import { describe, expect, it } from "vitest";
import { INDIA_RINGS, indiaDots, insideIndia } from "./india";

describe("india outline", () => {
  it("contains the big cities", () => {
    for (const [lng, lat] of [[72.88, 19.08], [77.21, 28.61], [77.59, 12.97], [88.36, 22.57], [80.27, 13.08], [78.49, 17.39], [73.86, 18.52], [91.74, 26.14], [74.8, 34.08]]) {
      expect(insideIndia(lng, lat)).toBe(true);
    }
  });
  it("shows India's official borders and leaves the neighbours out", () => {
    expect(insideIndia(74.3, 35.9)).toBe(true); // Gilgit, part of J&K on India's map
    expect(insideIndia(79.5, 35.0)).toBe(true); // Aksai Chin
    expect(insideIndia(92.7, 11.6)).toBe(true); // Port Blair
    expect(insideIndia(79.86, 6.93)).toBe(false); // Colombo
    expect(insideIndia(85.32, 27.7)).toBe(false); // Kathmandu
    expect(insideIndia(90.41, 23.81)).toBe(false); // Dhaka
    expect(insideIndia(67.0, 24.86)).toBe(false); // Karachi
    expect(insideIndia(74.35, 31.55)).toBe(false); // Lahore
  });
  it("is detailed but light", () => {
    expect(INDIA_RINGS[0].length).toBeGreaterThan(500);
    const { fill, edge } = indiaDots();
    expect(fill.length).toBeGreaterThan(900);
    expect(fill.length + edge.length).toBeLessThan(8000);
  });
});
