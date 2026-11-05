import { NextResponse } from "next/server";
import { createAlert, alertLink } from "@/lib/alerts";
import { supabaseConfigured } from "@/lib/supabaseServer";
import { telegramConfigured } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { query, city? } -> { link } : a t.me link that turns the alert on. */
export async function POST(req: Request) {
  if (!supabaseConfigured() || !telegramConfigured()) {
    return NextResponse.json({ error: "Telegram alerts are not set up yet." }, { status: 503 });
  }
  let body: { query?: unknown; city?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Send JSON: { query, city? }" }, { status: 400 });
  }
  const query = typeof body.query === "string" ? body.query : "";
  if (query.trim().length < 3) {
    return NextResponse.json({ error: "Describe what to watch for first." }, { status: 400 });
  }
  try {
    const alert = await createAlert({
      query,
      city: typeof body.city === "string" ? body.city : null,
    });
    return NextResponse.json({ link: await alertLink(alert) });
  } catch (err) {
    console.error("[alerts]", (err as Error).message);
    return NextResponse.json({ error: "Could not create the alert. Try again in a moment." }, { status: 500 });
  }
}
