import { NextResponse } from "next/server";
import { supabaseConfigured } from "@/lib/supabaseServer";
import { cleanReminders, forgetDevice, moveDevice, parseSub, PushInputError, syncReminders } from "@/lib/pushServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PUT    { subscription, reminders }  turn reminders on / re-sync this device
 * DELETE { endpoint }                 turn them off
 * PATCH  { old, subscription }        the browser rotated the push address
 */
async function body(req: Request): Promise<Record<string, unknown>> {
  if (Number(req.headers.get("content-length") || 0) > 64_000) throw new PushInputError("Too large");
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    throw new PushInputError("Bad JSON");
  }
}

async function guard(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  if (!supabaseConfigured()) return NextResponse.json({ error: "Reminders are not configured" }, { status: 503 });
  try {
    return await fn();
  } catch (err) {
    if (err instanceof PushInputError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error("[reminders]", (err as Error).message);
    return NextResponse.json({ error: "Could not save reminders" }, { status: 500 });
  }
}

export const PUT = (req: Request) =>
  guard(async () => {
    const b = await body(req);
    const sub = parseSub(b.subscription);
    return NextResponse.json(await syncReminders(sub, cleanReminders(b.reminders)));
  });

export const DELETE = (req: Request) =>
  guard(async () => {
    const b = await body(req);
    const { endpoint } = parseSub({ endpoint: b.endpoint, keys: { p256dh: "x".repeat(20), auth: "x".repeat(8) } });
    await forgetDevice(endpoint);
    return NextResponse.json({ ok: true });
  });

export const PATCH = (req: Request) =>
  guard(async () => {
    const b = await body(req);
    const old = parseSub({ endpoint: b.old, keys: { p256dh: "x".repeat(20), auth: "x".repeat(8) } }).endpoint;
    await moveDevice(old, parseSub(b.subscription));
    return NextResponse.json({ ok: true });
  });
