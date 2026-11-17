import { describe, expect, it } from "vitest";
import { priceBadge, priceLine, realTiers } from "./money";

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
    expect(priceBadge({ is_free: false, price_min: null, price_max: null })).toBe("Tickets");
  });
  it("drops 'tiers' that are just the event name", () => {
    const tiers = [{ name: "India Finance &amp; Tech Summit 2026" }, { name: "VIP" }];
    expect(realTiers(tiers, "India Finance & Tech Summit 2026 (Finance Transformation Summit)").map((x) => x.name)).toEqual(["VIP"]);
  });
});
