import { describe, expect, it } from "vitest";
import { priceBadge, priceLine, realTiers, ticketState } from "./money";

const t = (price: number | null, available: boolean | null = true) => ({ name: "x", price, currency: "INR", available });

describe("prices with ticket tiers", () => {
  it("uses the tier range over a single listing price", () => {
    const e = { is_free: false, price_min: 3398, price_max: null, tickets: [t(3398), t(5044)] };
    expect(priceLine(e)).toBe("₹3,398 to ₹5,044");
    expect(priceBadge(e)).toBe("₹3,398+");
  });
  it("ignores sold-out tiers for the range, and falls back without tiers", () => {
    expect(priceLine({ is_free: false, price_min: 499, price_max: null, tickets: [t(299, false), t(499)] })).toBe("₹499");
    expect(priceLine({ is_free: false, price_min: 499, price_max: null })).toBe("₹499");
    expect(priceBadge({ is_free: false, price_min: null, price_max: null })).toBe("Check price");
  });
  it("drops 'tiers' that are just the event name", () => {
    const tiers = [{ name: "India Finance &amp; Tech Summit 2026" }, { name: "VIP" }];
    expect(realTiers(tiers, "India Finance & Tech Summit 2026 (Finance Transformation Summit)").map((x) => x.name)).toEqual(["VIP"]);
  });
});

describe("ticketState", () => {
  const now = Date.parse("2026-11-20T12:00:00Z");
  it("sold out only when every tier says so, or the title does", () => {
    expect(ticketState({ title: "Gig", tickets: [{ available: false }, { available: false }] }, now)).toBe("sold_out");
    expect(ticketState({ title: "Gig (SOLD OUT)", tickets: [] }, now)).toBe("sold_out");
    expect(ticketState({ title: "Gig", tickets: [{ available: false }, { available: true }] }, now)).toBe("on_sale");
  });
  it("closed when sales have ended; unknown when nothing is said", () => {
    expect(ticketState({ title: "Gig", tickets: [{ available: null, sales_end: "2026-11-19T00:00:00Z" }] }, now)).toBe("closed");
    expect(ticketState({ title: "Gig", tickets: [] }, now)).toBe("unknown");
    expect(ticketState({ title: "Gig", tickets: [{ available: null }] }, now)).toBe("unknown");
  });
});
