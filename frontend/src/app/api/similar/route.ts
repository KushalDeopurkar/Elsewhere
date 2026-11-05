import { NextResponse } from "next/server";
import { similarEvents } from "@/lib/semantic";
import { supabaseConfigured } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A query parameter, not /api/similar/[id]: the /api/* rewrite to the
// backend runs before dynamic routes, so a dynamic segment would never match.
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id) || !supabaseConfigured()) return NextResponse.json({ data: [] });
  try {
    return NextResponse.json({ data: await similarEvents(id, 6) });
  } catch (err) {
    console.error("[similar]", (err as Error).message);
    return NextResponse.json({ data: [] });
  }
}
