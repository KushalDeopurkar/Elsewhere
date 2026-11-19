import { describe, expect, it } from "vitest";
import { twoWheelerFromCar } from "./travelModel";

describe("two-wheeler estimate", () => {
  it("loses only part of the drive's traffic delay", () => {
    // 40 min drive, 25 of it free-flowing: 15 min of jam, a bike loses ~6.
    expect(twoWheelerFromCar(40 * 60, 25 * 60) / 60).toBeCloseTo(31);
  });
  it("matches the drive when there's no traffic, and never beats free flow", () => {
    expect(twoWheelerFromCar(1200, 1200)).toBe(1200);
    expect(twoWheelerFromCar(1200, 1500)).toBe(1200);
  });
});
