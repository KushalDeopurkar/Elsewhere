import { describe, expect, it } from "vitest";
import { pathTo, pointAt, stopIndexAt, type LngLat } from "./route";

const P: LngLat[] = [[0, 0], [10, 0], [10, 10]];

describe("route", () => {
  it("interpolates along legs", () => {
    expect(pointAt(P, 0)).toEqual([0, 0]);
    expect(pointAt(P, 0.5)).toEqual([5, 0]);
    expect(pointAt(P, 1.5)).toEqual([10, 5]);
    expect(pointAt(P, 9)).toEqual([10, 10]);
    expect(pointAt([], 1)).toBeNull();
  });
  it("draws the path so far", () => {
    expect(pathTo(P, 0)).toEqual([[0, 0]]);
    expect(pathTo(P, 0.5)).toEqual([[0, 0], [5, 0]]);
    expect(pathTo(P, 1)).toEqual([[0, 0], [10, 0]]);
    expect(pathTo(P, 2)).toEqual(P);
  });
  it("names the nearest stop", () => {
    expect(stopIndexAt(0.4, 3)).toBe(0);
    expect(stopIndexAt(0.6, 3)).toBe(1);
    expect(stopIndexAt(5, 3)).toBe(2);
  });
});
