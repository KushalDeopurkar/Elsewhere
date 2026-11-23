import { describe, expect, it } from "vitest";
import { cityFromZone, nearestCity } from "./cityGuess";
import { CITY_LIST } from "./cities";

describe("first-visit city guess", () => {
  it("snaps a location to the nearest city we cover, within 150 km", () => {
    expect(nearestCity(18.52, 73.86)?.name).toBe("Pune");
    expect(nearestCity(51.48, -0.0)?.name).toBe("London");
    expect(nearestCity(40.73, -73.93)?.name).toBe("New York");
    expect(nearestCity(64.1, -21.9, 150)).toBeNull(); // Reykjavik, with a limit: nothing near
  });
  it("with no limit, still finds the nearest city we cover", () => {
    // Nagpur isn't a picker city: start in the closest one instead of Mumbai.
    expect(nearestCity(21.15, 79.09)?.name).toBe("Indore");
    expect(nearestCity(64.1, -21.9)?.name).toBe("Glasgow");
  });
  it("can look only at cities that have events", () => {
    const pool = CITY_LIST.filter((c) => c.name === "Mumbai" || c.name === "Pune");
    expect(nearestCity(19.99, 73.79, Infinity, pool)?.name).toBe("Mumbai"); // Nashik
  });
  it("uses the time zone only when it names one city", () => {
    expect(cityFromZone("Europe/London")).toBe("London");
    expect(cityFromZone("Asia/Kolkata")).toBeNull();
    expect(cityFromZone(undefined)).toBeNull();
  });
});
