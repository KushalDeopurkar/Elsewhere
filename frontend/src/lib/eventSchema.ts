import type { Event } from "./types";
import { currencyOf } from "./money";
import { SITE_URL } from "./site";

/**
 * schema.org Event markup for an event page, so search engines can show it
 * as an event (date, place, price) in results. Only facts we actually have:
 * nothing is invented to fill the shape.
 */
export function eventJsonLd(e: Event, about?: string | null, organizer?: string | null): Record<string, unknown> {
  const online = e.format === "online";
  const place = {
    "@type": "Place",
    name: e.location_name || e.city || undefined,
    address: {
      "@type": "PostalAddress",
      streetAddress: e.address || undefined,
      addressLocality: e.city || undefined,
      addressCountry: e.country || undefined,
    },
    geo: e.lat != null && e.lng != null ? { "@type": "GeoCoordinates", latitude: e.lat, longitude: e.lng } : undefined,
  };
  const free = e.is_free || e.price_min === 0;
  const offers =
    e.url && (free || e.price_min != null)
      ? {
          "@type": "Offer",
          url: e.url,
          price: free ? 0 : e.price_min,
          priceCurrency: currencyOf(e),
        }
      : undefined;
  return strip({
    "@context": "https://schema.org",
    "@type": "Event",
    name: e.title,
    description: (about || e.description || "").slice(0, 500) || undefined,
    startDate: e.start_time,
    endDate: e.end_time || undefined,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: online ? "https://schema.org/OnlineEventAttendanceMode" : "https://schema.org/OfflineEventAttendanceMode",
    location: online ? { "@type": "VirtualLocation", url: e.url || `${SITE_URL}/events/${e.id}` } : place,
    image: e.image_url ? [e.image_url] : undefined,
    url: `${SITE_URL}/events/${e.id}`,
    isAccessibleForFree: free || undefined,
    offers,
    organizer: organizer ? { "@type": "Organization", name: organizer } : undefined,
  });
}

/** Drop undefined fields (and empty objects they leave behind). */
function strip<T>(v: T): T {
  if (Array.isArray(v)) return v.map(strip) as T;
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) {
      if (x === undefined) continue;
      const s = strip(x);
      if (s && typeof s === "object" && !Array.isArray(s) && Object.keys(s).filter((key) => key !== "@type").length === 0) continue;
      out[k] = s;
    }
    return out as T;
  }
  return v;
}

/** Safe to drop into a <script> tag. */
export const jsonLdHtml = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");
