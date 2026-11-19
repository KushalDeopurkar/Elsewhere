import { NextResponse } from "next/server";
import { WORLD_LIST } from "@/lib/cities";
import { count, supabaseConfigured } from "@/lib/supabaseServer";

export const runtime = "nodejs";
// Listings change when the scrapers run (every 6 hours).
export const revalidate = 3600;

/**
 * GET /api/cities
 * Which cities outside India have upcoming events right now, so the city
 * picker doesn't offer places that would open empty. `active: null` means
 * "couldn't tell": the picker then shows every city.
 */
export async function GET() {
  if (!supabaseConfigured()) return NextResponse.json({ active: null });
  const now = new Date().toISOString();
  try {
    const counts = await Promise.all(
      WORLD_LIST.map(async (c) => [c.name, await count(`events?city=eq.${encodeURIComponent(c.name)}&start_time=gte.${now}`)] as const),
    );
    return NextResponse.json({
      active: counts.filter(([, n]) => n > 0).map(([name]) => name),
      counts: Object.fromEntries(counts),
    });
  } catch {
    return NextResponse.json({ active: null });
  }
}
