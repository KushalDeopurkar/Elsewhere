import { NextResponse } from "next/server";
import { searchEvents } from "@/lib/api";
import { CATEGORIES } from "@/lib/types";
import { cityByName, DEFAULT_CITY } from "@/lib/cities";
import { hasTime } from "@/lib/formatDate";

export const runtime = "nodejs";
// Counts change only when the scraper runs (every 6 hours).
export const revalidate = 600;

/**
 * GET /api/categories?city=Mumbai
 * Upcoming events per category within 40 km of the city, plus one real event
 * picture per category for its tile. Counts are capped at the search page
 * size (100) and reported as such.
 */
export async function GET(req: Request) {
  const city = cityByName(new URL(req.url).searchParams.get("city")) ?? DEFAULT_CITY;
  const results = await Promise.all(
    CATEGORIES.map(async (c) => {
      const { events, isSample } = await searchEvents({
        category: c.value,
        lat: city.lat,
        lng: city.lng,
        radius_km: 40,
        limit: 100,
      });
      if (isSample) return { value: c.value, count: null, capped: false, image: null };
      const pic =
        events.find((e) => e.image_url && hasTime(e.start_time))?.image_url ??
        events.find((e) => e.image_url)?.image_url ??
        null;
      return { value: c.value, count: events.length, capped: events.length >= 100, image: pic };
    }),
  );
  return NextResponse.json({ city: city.name, data: results });
}
