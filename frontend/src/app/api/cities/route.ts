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
/** Served from memory for an hour, and from the edge cache for longer. */
let memo: { at: number; body: { active: string[]; counts: Record<string, number> } } | null = null;
const HEADERS = { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" };

export async function GET() {
  if (!supabaseConfigured()) return NextResponse.json({ active: null });
  if (memo && Date.now() - memo.at < 3_600_000) return NextResponse.json(memo.body, { headers: HEADERS });
  const now = new Date().toISOString();
  try {
    const counts = await Promise.all(
      WORLD_LIST.map(async (c) => [c.name, await count(`events?city=eq.${encodeURIComponent(c.name)}&start_time=gte.${now}`)] as const),
    );
    const body = {
      active: counts.filter(([, n]) => n > 0).map(([name]) => name),
      counts: Object.fromEntries(counts),
    };
    memo = { at: Date.now(), body };
    return NextResponse.json(body, { headers: HEADERS });
  } catch {
    if (memo) return NextResponse.json(memo.body, { headers: { "Cache-Control": "public, s-maxage=60" } });
    return NextResponse.json({ active: null }, { headers: { "Cache-Control": "no-store" } });
  }
}
