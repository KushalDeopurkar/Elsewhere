import { NextResponse } from "next/server";
import { supabaseConfigured } from "@/lib/supabaseServer";
import { pushConfigured, runReminders } from "@/lib/pushServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Send every reminder that has come due. Called every 15 minutes by the
 * "Send reminders" GitHub Action. Needs no secret: it only sends reminders
 * people asked for, each once, so an extra call changes nothing.
 */
async function handle() {
  if (!supabaseConfigured() || !pushConfigured()) {
    return NextResponse.json({ error: "Reminders are not configured" }, { status: 503 });
  }
  try {
    return NextResponse.json(await runReminders());
  } catch (err) {
    console.error("[reminders/run]", (err as Error).message);
    return NextResponse.json({ error: (err as Error).message.slice(0, 300) }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
