import { NextResponse, type NextRequest } from "next/server";
import { rpc, supabaseConfigured } from "@/lib/supabaseServer";
import { CATEGORIES, EDGE_CACHE, bad, fromBackend, minuteIso, num, withDetails, type Row } from "@/lib/eventRoutes";

/**
 * Events inside a map box, answered here from the database (see the search
 * route for why). Same parameters and shape as GET /api/events/map on the
 * API: events that started up to 6 hours ago are included, so the map's
 * timeline can show what is on right now.
 */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const south = num(p.get("south"));
  const west = num(p.get("west"));
  const north = num(p.get("north"));
  const east = num(p.get("east"));
  const max = num(p.get("max_results")) ?? 200;
  const category = p.get("category");
  if (south == null || west == null || north == null || east == null) return bad("south, west, north and east are required");
  if (max < 1 || max > 500) return bad("max_results must be 1-500");
  if (category && !CATEGORIES.has(category)) return bad("unknown category");

  if (!supabaseConfigured()) return fromBackend(req, "/api/events/map");

  try {
    const rows = await rpc<Row[]>(
      "events_in_bounds",
      {
        south,
        west,
        north,
        east,
        from_time: p.get("from_time") || minuteIso(-6 * 3_600_000),
        category_filter: category || null,
        max_results: max,
      },
      8_000,
    );
    const data = await withDetails(rows, false);
    return NextResponse.json({ data, error: null, meta: null }, { headers: { "Cache-Control": EDGE_CACHE } });
  } catch (err) {
    console.warn("[map] database read failed, asking the API:", (err as Error).message);
    return fromBackend(req, "/api/events/map");
  }
}
