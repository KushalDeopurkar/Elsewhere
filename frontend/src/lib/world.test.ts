import { describe, expect, it } from "vitest";
import { zoneOf, cityByName } from "./cities";
import { formatWhen, hasTime, whenOf } from "./formatDate";
import { priceBadge, priceLine } from "./money";
import { skyPhase } from "./sky";
import { timelineStart, zoneOffset } from "./timeline";

describe("world cities", () => {
  it("picks each event's zone from its country and nearest city", () => {
    expect(zoneOf({ country: "IN", lat: 19, lng: 72 })).toBe("Asia/Kolkata");
    expect(zoneOf({ country: "GB", lat: 51.5, lng: -0.1 })).toBe("Europe/London");
    expect(zoneOf({ country: "US", lat: 34.05, lng: -118.25 })).toBe("America/Los_Angeles");
    expect(zoneOf({ country: "US", lat: 40.7, lng: -74 })).toBe("America/New_York");
    expect(zoneOf({ country: "AU", lat: -31.95, lng: 115.86 })).toBe("Australia/Perth");
    expect(zoneOf({ country: null })).toBe("Asia/Kolkata");
    expect(cityByName("NYC")?.name).toBe("New York");
  });

  it("formats a London gig in London time, not IST", () => {
    const now = new Date("2026-11-19T12:00:00Z");
    // 20:00 UTC on 19 Nov = 8 pm in London (GMT), 1:30 am next day in India.
    const ev = { start_time: "2026-11-19T20:00:00Z", country: "GB", lat: 51.5, lng: -0.12 };
    expect(whenOf(ev, now)).toBe("Today, 8:00 pm");
    expect(formatWhen(ev.start_time, now)).toBe("Tomorrow, 1:30 am");
    // Local midnight is "time on listing" in the event's own zone.
    expect(hasTime("2026-11-20T00:00:00Z", "Europe/London")).toBe(false);
    expect(hasTime("2026-11-20T00:00:00Z")).toBe(true);
  });

  it("prices in the event's currency", () => {
    const base = { is_free: false, price_max: null };
    expect(priceBadge({ ...base, price_min: 45, country: "US" })).toBe("$45");
    expect(priceBadge({ ...base, price_min: 20, country: "GB" })).toBe("£20");
    expect(priceLine({ ...base, price_min: 12, price_max: 30, country: "FR" })).toBe("€12 to €30");
    expect(priceBadge({ ...base, price_min: 499, country: "IN" })).toBe("₹499");
  });

  it("follows the city's clock for the sky and the map timeline", () => {
    const t = Date.parse("2026-11-19T12:00:00Z"); // 5:30 pm IST, noon London
    expect(skyPhase(t)).toBe("dusk");
    expect(skyPhase(t, "Europe/London")).toBe("day");
    expect(skyPhase(t - 3_600_000, "America/New_York")).toBe("dawn"); // 6 am
    expect(zoneOffset("America/New_York", t)).toBe(-5 * 3_600_000);
    expect(timelineStart(Date.parse("2026-11-19T12:34:00Z"), "Europe/London")).toBe(Date.parse("2026-11-19T12:00:00Z"));
  });
});
