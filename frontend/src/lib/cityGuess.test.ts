import { describe, expect, it } from "vitest";
import { cityFromZone, nearestCity } from "./cityGuess";

describe("first-visit city guess", () => {
  it("snaps a location to the nearest city we cover, within 150 km", () => {
    expect(nearestCity(18.52, 73.86)?.name).toBe("Pune");
    expect(nearestCity(51.48, -0.0)?.name).toBe("London");
    expect(nearestCity(40.73, -73.93)?.name).toBe("New York");
    expect(nearestCity(64.1, -21.9)).toBeNull(); // Reykjavik: nothing near
  });
  it("uses the time zone only when it names one city", () => {
    expect(cityFromZone("Europe/London")).toBe("London");
    expect(cityFromZone("Asia/Kolkata")).toBeNull();
    expect(cityFromZone(undefined)).toBeNull();
  });
});
