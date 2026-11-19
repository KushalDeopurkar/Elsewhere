import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/whereami
 * The visitor's rough location from Vercel's IP lookup (city level), used
 * once to pick a sensible starting city. Nothing is stored or logged here.
 * Off Vercel these headers don't exist and the answer is null.
 */
export function GET(req: Request) {
  const h = req.headers;
  const lat = Number(h.get("x-vercel-ip-latitude"));
  const lng = Number(h.get("x-vercel-ip-longitude"));
  const body =
    Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)
      ? { lat, lng, country: h.get("x-vercel-ip-country") }
      : null;
  return NextResponse.json(body, { headers: { "Cache-Control": "private, no-store" } });
}
