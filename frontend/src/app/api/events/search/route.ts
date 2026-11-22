import { NextResponse, type NextRequest } from "next/server";
import { unstable_cache } from "next/cache";
import { rpc, supabaseConfigured } from "@/lib/supabaseServer";
import { CATEGORIES, EDGE_CACHE, bad, fromBackend, num, withDetails, type Row } from "@/lib/eventRoutes";

type SearchArgs = {
  query: string | null;
  category_filter: string | null;
  p_lat: number | null;
  p_lng: number | null;
  radius_km: number;
  from_time: string;
  to_time: string | null;
  page_limit: number;
  page_offset: number;
};

async function runSearch(args: SearchArgs): Promise<Row[]> {
  const rows = await rpc<Row[]>("search_events", args, 6_000);
  return withDetails(rows, true);
}

/**
 * Answers kept on the server and refreshed in the background every two
 * minutes (stale-while-revalidate). A visitor gets the stored copy at once;
 * if the database is slow or down, the refresh fails quietly and the last
 * good copy keeps being served instead of a spinner.
 */
const cachedSearch = unstable_cache(runSearch, ["search-events-v2"], { revalidate: 120 });

/**
 * Times rounded to 10 minutes, so nearby visits share one stored answer:
 * the start down and the end up, so the window only ever grows.
 */
const BUCKET = 10 * 60_000;
function bucket(iso: string | null, up = false): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  return new Date((up ? Math.ceil(t / BUCKET) : Math.floor(t / BUCKET)) * BUCKET).toISOString();
}

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
    const data = await cachedSearch({
      query: p.get("q") || null,
      category_filter: category || null,
      p_lat: num(p.get("lat")),
      p_lng: num(p.get("lng")),
      radius_km: radius,
      from_time: bucket(p.get("from_time")) ?? bucket(new Date().toISOString())!,
      to_time: bucket(p.get("to_time"), true),
      page_limit: limit,
      page_offset: offset,
    });
    // Copies: the stored answer is shared between requests.
    const out = data.map((r) =>
      descChars != null && typeof r.description === "string" && r.description.length > descChars
        ? { ...r, description: `${r.description.slice(0, descChars).trimEnd()}…` }
        : r,
    );
    return NextResponse.json({ data: out, error: null, meta: { limit, offset } }, { headers: { "Cache-Control": EDGE_CACHE } });
  } catch (err) {
    console.warn("[search] database search failed:", (err as Error).message);
    return NextResponse.json(
      { data: null, error: "Listings are slow to answer right now", meta: { limit, offset } },
      { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "10" } },
    );
  }
}
