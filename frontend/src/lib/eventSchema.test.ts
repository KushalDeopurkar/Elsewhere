/* eslint-disable @typescript-eslint/no-explicit-any -- reading back loose JSON-LD in tests */
import { describe, expect, it } from "vitest";
import type { Event } from "./types";
import { eventJsonLd, jsonLdHtml } from "./eventSchema";

const base: Event = {
  id: "e1", title: "Jazz </script> Night", description: "Live", category: "music", start_time: "2026-12-05T15:30:00Z",
  end_time: null, location_name: "Blue Frog", address: null, city: "Mumbai", country: "IN", lat: 19, lng: 72.8,
  image_url: null, url: "https://tix.example/e1", price_min: 499, price_max: null, is_free: false, source: "district",
  distance_km: null, relevance: null,
};

describe("event structured data", () => {
  it("describes the event with only the facts we have", () => {
    const ld = eventJsonLd(base) as Record<string, any>;
    expect(ld["@type"]).toBe("Event");
    expect(ld.location.name).toBe("Blue Frog");
    expect(ld.location.address).toEqual({ "@type": "PostalAddress", addressLocality: "Mumbai", addressCountry: "IN" });
    expect(ld.offers).toEqual({ "@type": "Offer", url: "https://tix.example/e1", price: 499, priceCurrency: "INR" });
    expect(ld.endDate).toBeUndefined();
    expect(ld.image).toBeUndefined();
  });
  it("marks free events and skips offers with no price or link", () => {
    expect((eventJsonLd({ ...base, is_free: true, price_min: null }) as any).isAccessibleForFree).toBe(true);
    expect((eventJsonLd({ ...base, price_min: null }) as any).offers).toBeUndefined();
    expect((eventJsonLd({ ...base, country: "US", price_min: 45 }) as any).offers.priceCurrency).toBe("USD");
  });
  it("can't break out of its script tag", () => {
    expect(jsonLdHtml(eventJsonLd(base))).not.toContain("</script>");
  });
});
