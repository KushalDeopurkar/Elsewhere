import { describe, expect, it } from "vitest";
import { resolveTheme, themeAt, themeBootScript } from "./theme";

const at = (iso: string) => Date.parse(iso);

describe("theme follows the sun in the chosen city", () => {
  it("is day at noon and night after 18:00 in Mumbai", () => {
    expect(themeAt(at("2026-11-20T06:30:00Z"), "Asia/Kolkata")).toBe("day"); // 12:00 IST
    expect(themeAt(at("2026-11-20T12:45:00Z"), "Asia/Kolkata")).toBe("night"); // 18:15 IST
    expect(themeAt(at("2026-11-20T00:15:00Z"), "Asia/Kolkata")).toBe("night"); // 05:45 IST
    expect(themeAt(at("2026-11-20T00:45:00Z"), "Asia/Kolkata")).toBe("day"); // 06:15 IST
  });

  it("uses the city's own clock, not the visitor's", () => {
    const t = at("2026-11-20T20:00:00Z"); // 01:30 IST, 15:00 in New York
    expect(themeAt(t, "Asia/Kolkata")).toBe("night");
    expect(themeAt(t, "America/New_York")).toBe("day");
  });

  it("a pinned setting wins over the sun", () => {
    const noon = at("2026-11-20T06:30:00Z");
    expect(resolveTheme("night", noon, "Asia/Kolkata")).toBe("night");
    expect(resolveTheme("day", at("2026-11-20T16:00:00Z"), "Asia/Kolkata")).toBe("day");
    expect(resolveTheme("auto", noon, "Asia/Kolkata")).toBe("day");
  });

  it("the boot script is self-contained and sets data-theme", () => {
    const js = themeBootScript();
    expect(js).toContain("dataset.theme");
    expect(js).toContain("ee.theme.v1");
    expect(() => new Function(js)).not.toThrow();
  });
});
