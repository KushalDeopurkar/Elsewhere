import { NextResponse } from "next/server";
import { deleteUser, supabaseConfigured, userFromToken } from "@/lib/supabaseServer";

export const runtime = "nodejs";

/**
 * DELETE /api/account  (Authorization: Bearer <the person's access token>)
 * Deletes the caller's own account and everything tied to it: profile,
 * follows, plans, saved events, lists, passport and polls.
 */
export async function DELETE(req: Request) {
  if (!supabaseConfigured()) return NextResponse.json({ error: "Accounts aren't set up on this server." }, { status: 503 });
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const user = await userFromToken(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "Your session has expired. Sign in again." }, { status: 401 });
  try {
    await deleteUser(user.id);
  } catch {
    return NextResponse.json({ error: "Couldn't delete the account. Try again in a minute." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
