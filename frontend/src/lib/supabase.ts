"use client";

/**
 * Browser Supabase client for accounts and the social layer. Signed-in
 * requests carry the person's session, and row level security in the
 * database (migration 009) decides what they can see and change. When the
 * public key isn't configured, social features stay hidden and the rest of
 * the site works as before.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const socialConfigured = Boolean(URL && KEY);

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient | null {
  if (!socialConfigured || typeof window === "undefined") return null;
  client ??= createClient(URL, KEY, {
    auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: "ee.auth.v1" },
  });
  return client;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Only real (database) events can be marked going, saved to an account or listed. */
// Local testing only: lets the bundled sample events use social features.
const ALLOW_SAMPLES = process.env.NEXT_PUBLIC_SOCIAL_SAMPLES === "1";
export function isRealEvent(e: { id: string; source: string }): boolean {
  return (ALLOW_SAMPLES || e.source !== "sample") && UUID.test(e.id);
}
