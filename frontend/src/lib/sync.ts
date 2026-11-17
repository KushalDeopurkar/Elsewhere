"use client";

/**
 * Keeps this device and the account in step once someone signs in:
 * - saved events: device saves go up, account saves come down, and every
 *   later save or unsave is mirrored;
 * - passport: merged both ways (union of stamps), then mirrored.
 * Sample events never leave the device. Failures are quiet: the device copy
 * stays the source of truth for the UI.
 */
import { onSignIn, currentUserId } from "./auth";
import { supabase, isRealEvent } from "./supabase";
import { mergeSaved, readSaved, setSavedSink } from "./saved";
import { mergePassports, readPassport, setPassportSink, writePassport, type Passport } from "./passport";
import { eventsByIds } from "./social";

let installed = false;
let pushTimer = 0;

export function installSync(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  setSavedSink((event, saved) => {
    const sb = supabase();
    const me = currentUserId();
    if (!sb || !me || !isRealEvent(event)) return;
    const q = saved
      ? sb.from("saved_events").upsert({ user_id: me, event_id: event.id }, { onConflict: "user_id,event_id", ignoreDuplicates: true })
      : sb.from("saved_events").delete().eq("user_id", me).eq("event_id", event.id);
    void q.then(() => undefined);
  });

  setPassportSink((p: Passport) => {
    window.clearTimeout(pushTimer);
    pushTimer = window.setTimeout(() => {
      const sb = supabase();
      const me = currentUserId();
      if (sb && me) void sb.from("passports").upsert({ user_id: me, data: p }, { onConflict: "user_id" }).then(() => undefined);
    }, 1500);
  });

  onSignIn(async (uid) => {
    const sb = supabase();
    if (!sb) return;
    try {
      // Saved: push the device's real saves, then pull the account's.
      const local = readSaved().filter((s) => isRealEvent(s.event));
      if (local.length) {
        await sb.from("saved_events").upsert(
          local.map((s) => ({ user_id: uid, event_id: s.event.id, saved_at: s.savedAt })),
          { onConflict: "user_id,event_id", ignoreDuplicates: true },
        );
      }
      const { data } = await sb.from("saved_events").select("event_id, saved_at").eq("user_id", uid).order("saved_at", { ascending: false }).limit(200);
      const rows = (data ?? []) as { event_id: string; saved_at: string }[];
      const have = new Set(readSaved().map((s) => s.event.id));
      const missing = rows.filter((r) => !have.has(r.event_id));
      if (missing.length) {
        const events = await eventsByIds(missing.map((r) => r.event_id));
        const at = new Map(missing.map((r) => [r.event_id, r.saved_at]));
        mergeSaved(events.map((event) => ({ event, savedAt: at.get(event.id) ?? new Date().toISOString() })));
      }

      // Passport: merge both ways.
      const pp = await sb.from("passports").select("data").eq("user_id", uid).maybeSingle();
      const merged = mergePassports(readPassport(), (pp.data?.data ?? null) as Partial<Passport> | null);
      writePassport(merged);
    } catch {
      /* offline or not migrated yet: keep the device copy */
    }
  });
}
