import { NextResponse, type NextRequest } from "next/server";
import { rest } from "@/lib/supabaseServer";

/** Shared by the event list routes that answer from the database directly. */

export const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";
export const CATEGORIES = new Set([
  "tech", "business", "education", "arts", "sports", "music", "community",
  "food", "health", "outdoor", "family", "nightlife", "other",
]);
export const EDGE_CACHE = "public, s-maxage=60, stale-while-revalidate=600, stale-if-error=86400";

const DETAIL_COLUMNS = "id,image_url,end_time,price_min,price_max,is_free,url,address,city,country,source";
// The fields the API's EventResponse returns; anything else stays out.
const FIELDS = [
  "id", "title", "description", "category", "start_time", "end_time", "location_name", "address",
  "city", "country", "lat", "lng", "image_url", "url", "price_min", "price_max", "is_free", "source",
  "distance_km", "relevance", "tickets",
];

export type Row = Record<string, unknown> & { id: string; description?: string | null };

export function num(v: string | null): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function bad(message: string) {
  return NextResponse.json({ detail: message }, { status: 422 });
}

/** Minute-rounded time, so requests in the same minute share a cache entry. */
export function minuteIso(offsetMs = 0): string {
  return new Date(Math.floor((Date.now() + offsetMs) / 60_000) * 60_000).toISOString();
}

/**
 * Add the columns the database functions don't return (pictures, prices,
 * ticket tiers), merged by id in one query, as the API does; then keep only
 * the API's response fields.
 */
export async function withDetails(rows: Row[], tickets: boolean): Promise<Row[]> {
  let merged = rows;
  if (rows.length) {
    const ids = rows.map((r) => r.id).join(",");
    // Extras only (pictures' details, tickets): never worth a long wait. One
    // short try; without them the list still has everything it needs.
    const cols = tickets ? `${DETAIL_COLUMNS},tickets` : DETAIL_COLUMNS;
    const extra = await rest<Row[]>(`events?select=${cols}&id=in.(${ids})`, { timeoutMs: 4_000 }).catch(() => [] as Row[]);
    const byId = new Map(extra.map((e) => [e.id, e]));
    merged = rows.map((r) => {
      const out: Row = { ...r };
      for (const [k, v] of Object.entries(byId.get(r.id) ?? {})) if (v != null) out[k] = v;
      return out;
    });
  }
  return merged.map((r) => {
    const out = { id: r.id } as Row;
    for (const k of FIELDS) out[k] = r[k] ?? (k === "is_free" ? false : null);
    return out;
  });
}

/** Ask the API on Render instead (database unreachable or not configured). */
export async function fromBackend(req: NextRequest, path: string) {
  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}${path}${req.nextUrl.search}`, {
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ detail: "Listings are unavailable right now" }, { status: 503 });
  }
  return new NextResponse(await res.text(), {
    status: res.status,
    headers: { "Content-Type": "application/json", "Cache-Control": res.ok ? EDGE_CACHE : "no-store" },
  });
}
