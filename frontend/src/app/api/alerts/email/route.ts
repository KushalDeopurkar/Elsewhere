import { NextResponse } from "next/server";
import { createEmailAlert, AlertInputError } from "@/lib/alerts";
import { supabaseConfigured } from "@/lib/supabaseServer";
import { emailConfigured } from "@/lib/email";
import { siteOrigin } from "@/lib/siteOrigin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { query, email, city? }: sends a confirmation email; nothing else until confirmed. */
export async function POST(req: Request) {
  if (!supabaseConfigured() || !emailConfigured()) {
    return NextResponse.json({ error: "Email alerts are not set up yet." }, { status: 503 });
  }
  let body: { query?: unknown; email?: unknown; city?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Send JSON: { query, email, city? }" }, { status: 400 });
  }
  const query = typeof body.query === "string" ? body.query : "";
  const email = typeof body.email === "string" ? body.email : "";
  if (query.trim().length < 3) {
    return NextResponse.json({ error: "Describe what to watch for first." }, { status: 400 });
  }
  try {
    await createEmailAlert({ query, email, city: typeof body.city === "string" ? body.city : null }, siteOrigin(req));
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AlertInputError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[alerts/email]", (err as Error).message);
    return NextResponse.json({ error: "Could not send the confirmation email. Try again in a moment." }, { status: 500 });
  }
}
