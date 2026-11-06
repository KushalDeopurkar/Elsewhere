import { NextResponse } from "next/server";
import { unsubscribeAlert } from "@/lib/alerts";
import { supabaseConfigured } from "@/lib/supabaseServer";
import { siteOrigin } from "@/lib/siteOrigin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST ?token=... turns an alert off. This is also the RFC 8058 one-click
 * target mail apps call from their own "Unsubscribe" button.
 * GET only shows the confirmation page, so link scanners change nothing.
 */
export async function POST(req: Request) {
  if (!supabaseConfigured()) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const url = new URL(req.url);
  let token = url.searchParams.get("token") ?? "";
  if (!token) {
    const body = (await req.json().catch(() => ({}))) as { token?: unknown };
    token = typeof body.token === "string" ? body.token : "";
  }
  try {
    const result = await unsubscribeAlert(token);
    if (!result) return NextResponse.json({ error: "This link is invalid or has expired." }, { status: 404 });
    return NextResponse.json({ data: result });
  } catch (err) {
    console.error("[alerts/unsubscribe]", (err as Error).message);
    return NextResponse.json({ error: "Could not turn off the alert. Try again in a moment." }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  return NextResponse.redirect(`${siteOrigin(req)}/alert?action=unsubscribe&token=${encodeURIComponent(token)}`, 303);
}
