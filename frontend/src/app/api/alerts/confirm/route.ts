import { NextResponse } from "next/server";
import { confirmEmailAlert } from "@/lib/alerts";
import { supabaseConfigured } from "@/lib/supabaseServer";
import { emailConfigured } from "@/lib/email";
import { siteOrigin } from "@/lib/siteOrigin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST { token }. A POST, not the emailed GET link itself: mail scanners
 * fetch links automatically, and a GET must never turn alerts on.
 */
export async function POST(req: Request) {
  if (!supabaseConfigured() || !emailConfigured()) {
    return NextResponse.json({ error: "Email alerts are not set up yet." }, { status: 503 });
  }
  const body = (await req.json().catch(() => ({}))) as { token?: unknown };
  const token = typeof body.token === "string" ? body.token : "";
  try {
    const result = await confirmEmailAlert(token, siteOrigin(req));
    if (!result) return NextResponse.json({ error: "This link is invalid or has expired." }, { status: 404 });
    return NextResponse.json({ data: result });
  } catch (err) {
    console.error("[alerts/confirm]", (err as Error).message);
    return NextResponse.json({ error: "Could not turn on the alert. Try again in a moment." }, { status: 500 });
  }
}
