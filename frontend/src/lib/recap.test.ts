import { describe, expect, it } from "vitest";
import { buildRecap } from "./recap";
import { EMPTY_PASSPORT } from "./passportCore";

const NOW = Date.parse("2026-11-18T12:00:00Z");
const label = (c: string) => c.toUpperCase();

describe("buildRecap", () => {
  it("counts only this month and picks a persona from saves", () => {
    const r = buildRecap({
      now: NOW,
      saved: [
        { savedAt: "2026-11-02T10:00:00Z", category: "music" },
        { savedAt: "2026-11-10T10:00:00Z", category: "music" },
        { savedAt: "2026-11-11T10:00:00Z", category: "tech" },
        { savedAt: "2026-10-20T10:00:00Z", category: "food" },
      ],
      passport: { ...EMPTY_PASSPORT, cats: { music: "2026-11-02T10:00:00Z", food: "2026-10-20T10:00:00Z" }, cities: { Mumbai: "2026-11-02T10:00:00Z" } },
      topCategories: [{ value: "food", label: "Food" }],
      streak: 2,
      going: 1,
      labelOf: label,
    });
    expect(r.month).toBe("November");
    expect(r.saved).toBe(3);
    expect(r.stamps.map((s) => s.value)).toEqual(["music"]);
    expect(r.top?.value).toBe("music");
    expect(r.persona.title).toBe("Front Row Regular");
    expect(r.cities).toEqual(["Mumbai"]);
    expect(r.empty).toBe(false);
  });
  it("prefers Night Owl for late plans and reports empty months", () => {
    const r = buildRecap({ now: NOW, saved: [], passport: { ...EMPTY_PASSPORT, night: ["1", "2", "3", "4", "5"] }, topCategories: [], streak: 0, going: null, labelOf: label });
    expect(r.persona.title).toBe("Night Owl");
    expect(r.empty).toBe(true);
  });
});
