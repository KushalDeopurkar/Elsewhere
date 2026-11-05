import { NextResponse } from "next/server";
import { embedQuery, matchEvents, dedupeListings } from "@/lib/semantic";
import { detectCity, cityByName, DEFAULT_CITY } from "@/lib/cities";
import { supabaseConfigured } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Measured on live data with gte-small (2,400 events): strong matches score
 * 0.84-0.90, useful looser ones 0.81-0.83, and unrelated events sit around
 * 0.80 and below. Tunable per deployment.
 */
function minSimilarity(): number {
  const v = Number(process.env.SEMANTIC_MIN_SIMILARITY);
  return Number.isFinite(v) && v >= 0 && v < 1 ? v : 0.81;
}

/**
 * GET /api/semantic?q=chill+sunday+thing+with+dogs&city=Mumbai
 * Upcoming events ranked by meaning. Responds 503 when meaning-based search
 * is not set up, so the client can stay on keyword search.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 300);
  if (q.length < 2) return NextResponse.json({ error: "Missing q" }, { status: 400 });
  if (!supabaseConfigured()) return NextResponse.json({ error: "Semantic search is not configured" }, { status: 503 });

  const cityParam = url.searchParams.get("city");
  const online = cityParam?.toLowerCase() === "online";
  const city = detectCity(q)?.city ?? (online ? null : cityByName(cityParam) ?? DEFAULT_CITY);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 24, 1), 60);

  try {
    const embedding = await embedQuery(q);
    const ranked = await matchEvents({
      embedding,
      lat: city?.lat ?? null,
      lng: city?.lng ?? null,
      radiusKm: 40,
      count: limit,
      minSimilarity: minSimilarity(),
    });
    // Keep the pack near the best hit: a long tail of weak matches reads as
    // noise. On live data, related results sit within about 0.04 of the top.
    const best = ranked[0]?.similarity ?? 0;
    const events = dedupeListings(ranked.filter((e) => e.similarity >= best - 0.04));
    return NextResponse.json({ data: events, city: city?.name ?? null });
  } catch (err) {
    console.error("[semantic]", (err as Error).message);
    return NextResponse.json({ error: "Semantic search is unavailable" }, { status: 503 });
  }
}
