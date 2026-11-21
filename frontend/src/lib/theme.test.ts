import { describe, expect, it } from "vitest";
import { paletteOf, resolveTheme, themeBootScript } from "./theme";

function boot(stored: string | null, dark: boolean) {
  const root = { dataset: {} as Record<string, string> };
  const run = new Function("document", "localStorage", "window", themeBootScript());
  run(
    { documentElement: root },
    { getItem: (k: string) => (k === "ee.theme.v1" ? stored : null) },
    { matchMedia: (q: string) => ({ matches: dark && q === "(prefers-color-scheme: dark)" }) },
  );
  return root.dataset;
}

describe("theme", () => {
  it("automatic follows the device", () => {
    expect(resolveTheme("auto", true)).toBe("night");
    expect(resolveTheme("auto", false)).toBe("day");
  });

  it("a pinned setting wins over the device", () => {
    expect(resolveTheme("night", false)).toBe("night");
    expect(resolveTheme("day", true)).toBe("day");
  });

  it("vivid is night in its own palette", () => {
    expect(resolveTheme("vivid", false)).toBe("night");
    expect(paletteOf("vivid")).toBe("vivid");
    expect(paletteOf("night")).toBe("board");
    expect(paletteOf("auto")).toBe("board");
  });

  it("the boot script sets the theme before first paint", () => {
    expect(boot(null, true)).toEqual({ theme: "night" });
    expect(boot(null, false)).toEqual({ theme: "day" });
    expect(boot(JSON.stringify("day"), true)).toEqual({ theme: "day" });
    expect(boot(JSON.stringify("vivid"), false)).toEqual({ palette: "vivid", theme: "night" });
  });
});
