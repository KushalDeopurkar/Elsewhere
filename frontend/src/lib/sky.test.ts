import { describe, expect, it } from "vitest";
import { istHour, skyPhase } from "./sky";

const ist = (h: number, m = 0) => Date.UTC(2026, 10, 20, h, m) - 5.5 * 3_600_000;

describe("skyPhase", () => {
  it("reads IST", () => {
    expect(istHour(ist(9, 30))).toBeCloseTo(9.5);
  });
  it("maps the day", () => {
    expect(skyPhase(ist(6))).toBe("dawn");
    expect(skyPhase(ist(12))).toBe("day");
    expect(skyPhase(ist(18))).toBe("dusk");
    expect(skyPhase(ist(19, 45))).toBe("night");
    expect(skyPhase(ist(2))).toBe("night");
  });
});
