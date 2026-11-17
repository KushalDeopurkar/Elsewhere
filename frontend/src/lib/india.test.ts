import { describe, expect, it } from "vitest";
import { indiaDots, insideIndia } from "./india";

describe("india outline", () => {
  it("contains the big cities and not the neighbours", () => {
    for (const [lng, lat] of [[72.88, 19.08], [77.21, 28.61], [77.59, 12.97], [88.36, 22.57], [80.27, 13.08], [78.49, 17.39]]) {
      expect(insideIndia(lng, lat)).toBe(true);
    }
    expect(insideIndia(79.86, 6.93)).toBe(false); // Colombo
    expect(insideIndia(85.3, 27.9)).toBe(false); // Kathmandu side of the border
    expect(insideIndia(67.0, 24.86)).toBe(false); // Karachi
  });
  it("makes a few thousand dots at most", () => {
    const { fill, edge } = indiaDots();
    expect(fill.length).toBeGreaterThan(300);
    expect(fill.length + edge.length).toBeLessThan(5000);
  });
});
