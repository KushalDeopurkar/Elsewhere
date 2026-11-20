import { describe, expect, it } from "vitest";
import { nearbyCities } from "./cityGuess";
import { cityByName } from "./cities";

describe("nearbyCities", () => {
  it("offers the closest cities, not the city itself", () => {
    const near = nearbyCities(cityByName("Mumbai")!, 3).map((c) => c.name);
    expect(near).not.toContain("Mumbai");
    expect(near[0]).toBe("Pune");
    expect(near).toHaveLength(3);
  });
});
