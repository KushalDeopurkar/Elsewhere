import { NextResponse } from "next/server";
import { syncEmbeddings } from "@/lib/semantic";
import { supabaseConfigured } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Embed upcoming events that are new or changed since the last run.
 * Called after every scrape; idempotent, so repeated calls only finish the
 * remaining work. Returns { embedded, remaining }.
 */
async function handle() {
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 503 });
  }
  try {
    return NextResponse.json(await syncEmbeddings(45_000));
  } catch (err) {
    console.error("[embed/sync]", (err as Error).message);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
