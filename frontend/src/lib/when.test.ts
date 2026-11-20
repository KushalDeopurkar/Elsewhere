import { describe, expect, it } from "vitest";
import { inDays, inHours, inPriceCap, localDay, readDays, readHours, readPrice, zonedTime } from "./when";
import type { Event } from "./types";

// Friday 20 November 2026, 17:00 in Mumbai.
const NOW = Date.parse("2026-11-20T11:30:00Z");
const Z = "Asia/Kolkata";
const days = (q: string) => {
  const r = readDays(q, NOW, Z);
  return r ? [r.from, r.to] : null;
};

describe("reading dates", () => {
  it("a day of the month: this month, or next month once passed", () => {
    expect(days("events on 22nd")).toEqual(["2026-11-22", "2026-11-22"]);
    expect(days("on 22")).toEqual(["2026-11-22", "2026-11-22"]);
    expect(days("the 5th")).toEqual(["2026-12-05", "2026-12-05"]);
    expect(days("gigs 22nd")).toEqual(["2026-11-22", "2026-11-22"]);
  });
  it("day and month in any order, with or without a year", () => {
    expect(days("22 nov")).toEqual(["2026-11-22", "2026-11-22"]);
    expect(days("22nd of november")).toEqual(["2026-11-22", "2026-11-22"]);
    expect(days("nov 22")).toEqual(["2026-11-22", "2026-11-22"]);
    expect(days("december 31st")).toEqual(["2026-12-31", "2026-12-31"]);
    expect(days("3 jan")).toEqual(["2027-01-03", "2027-01-03"]);
    expect(days("22/11")).toEqual(["2026-11-22", "2026-11-22"]);
    expect(days("2026-12-01")).toEqual(["2026-12-01", "2026-12-01"]);
  });
  it("ranges", () => {
    expect(days("22-25 dec")).toEqual(["2026-12-22", "2026-12-25"]);
    expect(days("dec 22 to 25")).toEqual(["2026-12-22", "2026-12-25"]);
    expect(days("from 22nd to 25th")).toEqual(["2026-11-22", "2026-11-25"]);
  });
  it("relative days and weeks", () => {
    expect(days("today")).toEqual(["2026-11-20", "2026-11-20"]);
    expect(days("tomorrow")).toEqual(["2026-11-21", "2026-11-21"]);
    expect(days("day after tomorrow")).toEqual(["2026-11-22", "2026-11-22"]);
    expect(days("this weekend")).toEqual(["2026-11-21", "2026-11-22"]);
    expect(days("next weekend")).toEqual(["2026-11-28", "2026-11-29"]);
    expect(days("this week")).toEqual(["2026-11-20", "2026-11-22"]);
    expect(days("next week")).toEqual(["2026-11-23", "2026-11-29"]);
    expect(days("next 3 days")).toEqual(["2026-11-20", "2026-11-23"]);
  });
  it("weekdays", () => {
    expect(days("friday")).toEqual(["2026-11-20", "2026-11-20"]);
    expect(days("on monday")).toEqual(["2026-11-23", "2026-11-23"]);
    expect(days("next friday")).toEqual(["2026-11-27", "2026-11-27"]);
    expect(days("this sat")).toEqual(["2026-11-21", "2026-11-21"]);
    expect(days("sun")).toBeNull();
  });
  it("months and holidays", () => {
    expect(days("in december")).toEqual(["2026-12-01", "2026-12-31"]);
    expect(days("this month")).toEqual(["2026-11-20", "2026-11-30"]);
    expect(days("next month")).toEqual(["2026-12-01", "2026-12-31"]);
    expect(days("in january")).toEqual(["2027-01-01", "2027-01-31"]);
    expect(days("christmas")).toEqual(["2026-12-25", "2026-12-25"]);
    expect(days("new year's eve party")).toEqual(["2026-12-31", "2026-12-31"]);
  });
  it("leaves words that only look like dates alone", () => {
    expect(days("may the force")).toBeNull();
    expect(days("march for climate")).toBeNull();
    expect(days("under 500")).toBeNull();
    expect(days("top 10 gigs")).toBeNull();
    expect(days("comedy")).toBeNull();
  });
  it("says what it read", () => {
    expect(readDays("events on 22nd", NOW, Z)?.label).toBe("Sun 22 Nov");
    expect(readDays("tomorrow", NOW, Z)?.label).toBe("Tomorrow");
    expect(readDays("events on 22nd", NOW, Z)?.source).toBe("on 22nd");
  });
});

describe("times and prices", () => {
  it("times of day", () => {
    expect(readHours("after 7pm")).toMatchObject({ from: 19, to: 28 });
    expect(readHours("before 10:30")).toMatchObject({ from: 0, to: 10.5 });
    expect(readHours("morning yoga")).toMatchObject({ from: 5, to: 12 });
    expect(readHours("gigs tonight")?.label).toBe("Tonight");
    expect(readHours("after 22nd")).toBeNull();
  });
  it("prices", () => {
    expect(readPrice("under ₹500")).toMatchObject({ max: 500, min: null });
    expect(readPrice("below rs. 1,000")).toMatchObject({ max: 1000 });
    expect(readPrice("upto 2k")).toMatchObject({ max: 2000 });
    expect(readPrice("between 500 and 1500")).toMatchObject({ min: 500, max: 1500 });
    expect(readPrice("over $50")).toMatchObject({ min: 50, max: null });
    expect(readPrice("between 22 and 25")).toBeNull();
    expect(readPrice("over 18 years")).toBeNull();
  });
});

describe("matching events", () => {
  const ev = (start: string, extra: Partial<Event> = {}) =>
    ({ id: "1", title: "x", category: "music", start_time: start, end_time: null, city: "Mumbai", country: "IN", is_free: false, price_min: 499, ...extra }) as Event;
  it("by local day, including runs over several days", () => {
    const r = { from: "2026-11-22", to: "2026-11-22", label: "", source: "" };
    expect(inDays(ev("2026-11-22T14:00:00Z"), r)).toBe(true);
    expect(inDays(ev("2026-11-21T19:00:00Z"), r)).toBe(true); // 00:30 on the 22nd in Mumbai
    expect(inDays(ev("2026-11-21T10:00:00Z"), r)).toBe(false);
    expect(inDays(ev("2026-11-20T04:00:00Z", { end_time: "2026-11-25T12:00:00Z" }), r)).toBe(true);
  });
  it("by time of day and by price", () => {
    expect(inHours(ev("2026-11-22T14:00:00Z"), { from: 19, to: 28, label: "", source: "" })).toBe(true); // 19:30
    expect(inHours(ev("2026-11-22T04:00:00Z"), { from: 19, to: 28, label: "", source: "" })).toBe(false);
    expect(inPriceCap(ev("2026-11-22T14:00:00Z"), { min: null, max: 500, label: "", source: "" })).toBe(true);
    expect(inPriceCap(ev("2026-11-22T14:00:00Z", { price_min: null }), { min: null, max: 500, label: "", source: "" })).toBe(false);
    expect(inPriceCap(ev("2026-11-22T14:00:00Z", { is_free: true, price_min: null }), { min: null, max: 500, label: "", source: "" })).toBe(true);
  });
  it("zone helpers", () => {
    expect(localDay(NOW, Z)).toBe("2026-11-20");
    expect(new Date(zonedTime("2026-11-22", 0, Z)).toISOString()).toBe("2026-11-21T18:30:00.000Z");
    expect(new Date(zonedTime("2026-07-04", 12, "America/New_York")).toISOString()).toBe("2026-07-04T16:00:00.000Z");
  });
});
