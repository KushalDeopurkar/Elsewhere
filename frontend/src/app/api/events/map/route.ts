import { NextResponse, type NextRequest } from "next/server";
import { unstable_cache } from "next/cache";
import { rpc, supabaseConfigured } from "@/lib/supabaseServer";
import { CATEGORIES, EDGE_CACHE, bad, fromBackend, minuteIso, num, withDetails, type Row } from "@/lib/eventRoutes";

type MapArgs = {
  south: number;
  west: number;
  north: number;
  east: number;
  from_time: string;
  category_filter: string | null;
  max_results: number;
};

async function runMap(args: MapArgs): Promise<Row[]> {
  const rows = await rpc<Row[]>("events_in_bounds", args, 6_000);
  return withDetails(rows, false);
}

/**
 * Stored on the server and refreshed in the background every two minutes,
 * like search: a crowd panning the same city reads one stored answer, and
 * if the database is slow the last good copy is served instead of nothing.
 */
const cachedMap = unstable_cache(runMap, ["map-in-bounds-v2"], { revalidate: 120 });

/** Boxes snapped outward to a 0.02° grid (about 2 km), so nearby views share an answer. */
const GRID = 0.02;
const down = (v: number) => Math.floor(v / GRID) * GRID;
const up = (v: number) => Math.ceil(v / GRID) * GRID;
const fix = (v: number) => Math.round(v * 1e4) / 1e4;
/** Start times rounded down to 10 minutes. */
const tenMin = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? iso : new Date(Math.floor(t / 600_000) * 600_000).toISOString();
};

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
    const data = await cachedMap({
      south: fix(down(south)),
      west: fix(down(west)),
      north: fix(up(north)),
      east: fix(up(east)),
      from_time: tenMin(p.get("from_time") || minuteIso(-6 * 3_600_000)),
      category_filter: category || null,
      max_results: max,
    });
    return NextResponse.json({ data, error: null, meta: null }, { headers: { "Cache-Control": EDGE_CACHE } });
  } catch (err) {
    // No second try through the API: it reads the same database.
    console.warn("[map] database read failed:", (err as Error).message);
    return NextResponse.json(
      { data: null, error: "The map is slow to answer right now", meta: null },
      { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "10" } },
    );
  }
}
