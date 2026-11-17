import { describe, expect, it } from "vitest";
import { formatSpan, salesCountdown, startCountdown } from "./countdown";

const NOW = Date.parse("2026-11-20T10:00:00Z");
const at = (mins: number) => new Date(NOW + mins * 60_000).toISOString();

describe("formatSpan", () => {
  it("formats minutes, hours and days", () => {
    expect(formatSpan(45 * 60_000)).toBe("45m");
    expect(formatSpan(134 * 60_000)).toBe("2h 14m");
    expect(formatSpan(120 * 60_000)).toBe("2h");
    expect(formatSpan(27 * 60 * 60_000)).toBe("1d 3h");
    expect(formatSpan(10)).toBe("1m");
  });
});

describe("startCountdown", () => {
  it("counts down inside the window", () => {
    expect(startCountdown(at(134), null, NOW)).toEqual({ label: "Starts in 2h 14m", tone: "soon" });
  });
  it("says on now while running", () => {
    expect(startCountdown(at(-30), at(60), NOW)?.label).toBe("On now");
  });
  it("is silent for far, past, or date-only events", () => {
    expect(startCountdown(at(60 * 72), null, NOW)).toBeNull();
    expect(startCountdown(at(-300), at(-100), NOW)).toBeNull();
    expect(startCountdown(at(60), null, NOW, { hasTime: false })).toBeNull();
  });
  it("does not call a multi-day run 'on now'", () => {
    expect(startCountdown(at(-60), at(60 * 48), NOW)).toBeNull();
  });
});

describe("salesCountdown", () => {
  it("uses the soonest open tier", () => {
    const tickets = [
      { sales_end: at(300), available: true },
      { sales_end: at(185), available: null },
      { sales_end: at(60), available: false },
    ];
    expect(salesCountdown(tickets, NOW)).toBe("Sales end in 3h 5m");
  });
  it("ignores past, far and missing cut-offs", () => {
    expect(salesCountdown([{ sales_end: at(-5), available: true }], NOW)).toBeNull();
    expect(salesCountdown([{ sales_end: at(60 * 24 * 10), available: true }], NOW)).toBeNull();
    expect(salesCountdown([{ sales_end: null, available: true }], NOW)).toBeNull();
    expect(salesCountdown(null, NOW)).toBeNull();
  });
});
