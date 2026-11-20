import { describe, expect, it } from "vitest";
import { paletteOf, resolveTheme, themeAt, themeBootScript } from "./theme";

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

  it("vivid is night at any hour, in its own palette", () => {
    const noon = at("2026-11-20T06:30:00Z");
    expect(resolveTheme("vivid", noon, "Asia/Kolkata")).toBe("night");
    expect(paletteOf("vivid")).toBe("vivid");
    expect(paletteOf("night")).toBe("board");
    expect(paletteOf("auto")).toBe("board");
  });

  it("the boot script paints vivid before first paint", () => {
    const store: Record<string, string> = { "ee.theme.v1": JSON.stringify("vivid") };
    const root = { dataset: {} as Record<string, string> };
    const run = new Function("document", "localStorage", themeBootScript());
    run({ documentElement: root }, { getItem: (k: string) => store[k] ?? null });
    expect(root.dataset).toEqual({ palette: "vivid", theme: "night" });
  });
});

