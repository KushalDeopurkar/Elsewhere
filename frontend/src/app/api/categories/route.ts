import { NextResponse } from "next/server";
import { searchEvents } from "@/lib/api";
import { CATEGORIES, type EventCategory } from "@/lib/types";
import { cityByName, DEFAULT_CITY } from "@/lib/cities";

export const runtime = "nodejs";
// Counts change only when the scraper runs (every 6 hours).
export const revalidate = 600;

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";
const CACHE = "public, s-maxage=600, stale-while-revalidate=3600";

interface Stat {
  value: EventCategory;
  count: number;
  capped: boolean;
  image: string | null;
}

/** The last good answer per city, so a slow or failed refresh never shows blanks. */
const lastGood = new Map<string, { total: number; data: Stat[] }>();

/** One request to the backend's counts endpoint (one database query). */
async function fromCounts(lat: number, lng: number): Promise<{ total: number; data: Stat[] } | null> {
  const res = await fetch(`${BACKEND_URL}/api/events/counts?lat=${lat}&lng=${lng}&radius_km=40`, {
    next: { revalidate: 600 },
    signal: AbortSignal.timeout(8000),
  });
  if (res.status === 404) return null; // backend not updated yet
  if (!res.ok) throw new Error(`counts ${res.status}`);
  const j = (await res.json()).data as {
    total: number;
    capped: boolean;
    categories: { value: EventCategory; count: number; image: string | null }[];
  };
  const byValue = new Map(j.categories.map((c) => [c.value, c]));
  return {
    total: j.total,
    data: CATEGORIES.map((c) => ({
      value: c.value,
      count: byValue.get(c.value)?.count ?? 0,
      capped: j.capped,
      image: byValue.get(c.value)?.image ?? null,
    })),
  };
}

/** Older backends: one search per category, a few at a time rather than all at once. */
async function fromSearches(lat: number, lng: number): Promise<{ total: number; data: Stat[] }> {
  const data: Stat[] = [];
  for (let i = 0; i < CATEGORIES.length; i += 4) {
    const batch = await Promise.all(
      CATEGORIES.slice(i, i + 4).map(async (c) => {
        const { events, more } = await searchEvents({ category: c.value, lat, lng, radius_km: 40, limit: 100 });
        return { value: c.value, count: events.length, capped: Boolean(more), image: events.find((e) => e.image_url)?.image_url ?? null };
      }),
    );
    data.push(...batch);
  }
  return { total: data.reduce((n, s) => n + s.count, 0), data };
}

/**
 * GET /api/categories?city=Mumbai
 * Upcoming events per category within 40 km of the city (starting from
 * now), the total, and one real picture per category for its tile. Every
 * count is a number: if a refresh fails, the last good answer is served.
 */
export async function GET(req: Request) {
  const city = cityByName(new URL(req.url).searchParams.get("city")) ?? DEFAULT_CITY;
  try {
    const got = (await fromCounts(city.lat, city.lng)) ?? (await fromSearches(city.lat, city.lng));
    lastGood.set(city.name, got);
    return NextResponse.json({ city: city.name, ...got }, { headers: { "Cache-Control": CACHE } });
  } catch {
    const prev = lastGood.get(city.name);
    if (prev) return NextResponse.json({ city: city.name, ...prev, stale: true }, { headers: { "Cache-Control": "public, s-maxage=60" } });
    return NextResponse.json({ city: city.name, error: "Counts are being refreshed" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
