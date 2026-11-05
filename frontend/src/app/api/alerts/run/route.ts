import { NextResponse } from "next/server";
import { runAlerts } from "@/lib/alerts";
import { supabaseConfigured } from "@/lib/supabaseServer";
import { telegramConfigured } from "@/lib/telegram";
import { siteOrigin } from "@/lib/siteOrigin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Send newly listed matches for every active alert. Called after each
 * scrape. Needs no secret: it only ever sends people events they asked for
 * and have not been sent before, so an extra call changes nothing.
 */
async function handle(req: Request) {
  if (!supabaseConfigured() || !telegramConfigured()) {
    return NextResponse.json({ error: "Alerts are not configured" }, { status: 503 });
  }
  try {
    return NextResponse.json(await runAlerts(siteOrigin(req)));
  } catch (err) {
    console.error("[alerts/run]", (err as Error).message);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
