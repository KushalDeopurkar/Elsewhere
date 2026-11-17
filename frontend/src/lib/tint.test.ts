import { describe, expect, it } from "vitest";
import { contrast, fromHsl, tintPalette, toHsl } from "./tint";

const BG = { r: 14, g: 16, b: 21 };
const parse = (h: string) => ({ r: parseInt(h.slice(1, 3), 16), g: parseInt(h.slice(3, 5), 16), b: parseInt(h.slice(5, 7), 16) });

describe("hsl round trip", () => {
  it("is close", () => {
    const c = { r: 200, g: 40, b: 120 };
    const [h, s, l] = toHsl(c);
    const back = fromHsl(h, s, l);
    expect(Math.abs(back.r - c.r) + Math.abs(back.g - c.g) + Math.abs(back.b - c.b)).toBeLessThan(4);
  });
});

describe("tintPalette", () => {
  it("returns null for grey posters", () => {
    expect(tintPalette({ r: 120, g: 122, b: 125 })).toBeNull();
  });
  it("accent always clears 4.5:1 on the page, even for dark posters", () => {
    for (const c of [{ r: 20, g: 10, b: 90 }, { r: 120, g: 0, b: 10 }, { r: 10, g: 60, b: 20 }, { r: 250, g: 200, b: 0 }]) {
      const t = tintPalette(c)!;
      expect(t).not.toBeNull();
      expect(contrast(parse(t.accent), BG)).toBeGreaterThanOrEqual(4.5);
      expect(t.glow).toMatch(/^rgb\(\d+ \d+ \d+ \/ 0\.3\)$/);
    }
  });
});
