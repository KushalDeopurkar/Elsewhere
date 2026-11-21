import { NextResponse, type NextRequest } from "next/server";
import { rpc, supabaseConfigured } from "@/lib/supabaseServer";
import { CATEGORIES, EDGE_CACHE, bad, fromBackend, minuteIso, num, withDetails, type Row } from "@/lib/eventRoutes";

/**
 * Event search, answered here instead of by the API on Render.
 *
 * The Render API sleeps when idle, so the first visit of the day waited for
 * it to wake (seconds). This handler runs on Vercel next to the site, calls
 * the same search_events database function the API calls, and is cached at
 * the edge for a minute, so most visits get the list straight from the
 * cache. Same parameters and response shape as GET /api/events/search on
 * the API; if the database can't be reached it asks the API instead.
 */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const limit = num(p.get("limit")) ?? 50;
  const offset = num(p.get("offset")) ?? 0;
  const radius = num(p.get("radius_km")) ?? 25;
  const descChars = num(p.get("desc_chars"));
  const category = p.get("category");
  if (limit < 1 || limit > 100 || !Number.isInteger(limit)) return bad("limit must be 1-100");
  if (offset < 0 || !Number.isInteger(offset)) return bad("offset must be 0 or more");
  if (category && !CATEGORIES.has(category)) return bad("unknown category");
  if (descChars != null && (descChars < 0 || descChars > 2000)) return bad("desc_chars must be 0-2000");

  if (!supabaseConfigured()) return fromBackend(req, "/api/events/search");

  try {
    const rows = await rpc<Row[]>(
      "search_events",
      {
        query: p.get("q") || null,
        category_filter: category || null,
        p_lat: num(p.get("lat")),
        p_lng: num(p.get("lng")),
        radius_km: radius,
        from_time: p.get("from_time") || minuteIso(),
        to_time: p.get("to_time") || null,
        page_limit: limit,
        page_offset: offset,
      },
      8_000,
    );
    const data = await withDetails(rows, true);
    if (descChars != null) {
      for (const r of data) {
        if (r.description && r.description.length > descChars) {
          r.description = `${r.description.slice(0, descChars).trimEnd()}…`;
        }
      }
    }
    return NextResponse.json({ data, error: null, meta: { limit, offset } }, { headers: { "Cache-Control": EDGE_CACHE } });
  } catch (err) {
    console.warn("[search] database search failed, asking the API:", (err as Error).message);
    return fromBackend(req, "/api/events/search");
  }
}
