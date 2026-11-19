/**
 * Reminders for saved events, sent as Web Push notifications (server only).
 *
 * A device that turns reminders on sends its push subscription plus the
 * reminders worked out from its saved events (lib/reminders). runReminders()
 * is called every 15 minutes and sends whatever has come due. Each reminder is
 * claimed (sent_at set) before it is sent, so overlapping runs never send
 * the same one twice.
 */

import { sendNotification, WebPushError } from "web-push";
import { rest, NotConfiguredError } from "./supabaseServer";
import { CONTACT_EMAIL } from "./site";
import { MAX_REMINDERS, HORIZON_MS, Reminder } from "./reminders";

export class PushInputError extends Error {}

export interface DeviceSub {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** Browser push services. Only these are ever contacted. */
const PUSH_HOSTS = [
  "fcm.googleapis.com",
  "android.googleapis.com",
  "updates.push.services.mozilla.com",
  "push.services.mozilla.com",
  "push.apple.com",
  "notify.windows.com",
];

function allowedHost(host: string): boolean {
  const extra = (process.env.PUSH_TEST_HOSTS || "").split(",").map((h) => h.trim()).filter(Boolean);
  return [...PUSH_HOSTS, ...extra].some((h) => host === h || host.endsWith(`.${h}`));
}

const B64URL = /^[A-Za-z0-9_-]+={0,2}$/;

export function parseSub(raw: unknown): DeviceSub {
  const s = raw as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | null;
  const endpoint = typeof s?.endpoint === "string" ? s.endpoint : "";
  const p256dh = typeof s?.keys?.p256dh === "string" ? s.keys.p256dh : "";
  const auth = typeof s?.keys?.auth === "string" ? s.keys.auth : "";
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new PushInputError("Bad push subscription");
  }
  if (url.protocol !== "https:" || !allowedHost(url.hostname) || endpoint.length > 1000) {
    throw new PushInputError("Unsupported push service");
  }
  if (!B64URL.test(p256dh) || p256dh.length < 20 || p256dh.length > 200) throw new PushInputError("Bad push key");
  if (!B64URL.test(auth) || auth.length < 8 || auth.length > 100) throw new PushInputError("Bad push key");
  return { endpoint, keys: { p256dh, auth } };
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

/** Keep only well-formed reminders inside the horizon. */
export function cleanReminders(raw: unknown, now = Date.now()): Reminder[] {
  if (!Array.isArray(raw)) throw new PushInputError("reminders must be a list");
  const seen = new Set<string>();
  const out: Reminder[] = [];
  for (const r of raw.slice(0, MAX_REMINDERS * 2)) {
    const x = r as Record<string, unknown>;
    const event_id = str(x?.event_id, 100);
    const at = Date.parse(str(x?.remind_at, 40));
    const title = str(x?.title, 120).trim();
    const url = str(x?.url, 300);
    if (!event_id || seen.has(event_id) || !title) continue;
    if (!Number.isFinite(at) || at < now - 5 * 60_000 || at - now > HORIZON_MS) continue;
    // Notifications only ever open a page on this site.
    if (!url.startsWith("/") || url.startsWith("//")) continue;
    seen.add(event_id);
    out.push({ event_id, remind_at: new Date(at).toISOString(), title, body: str(x?.body, 200), url });
    if (out.length >= MAX_REMINDERS) break;
  }
  return out;
}

const enc = encodeURIComponent;

/** Register a device and replace its pending reminders with this list. */
export async function syncReminders(sub: DeviceSub, reminders: Reminder[]): Promise<{ pending: number }> {
  await rest("push_devices?on_conflict=endpoint", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=minimal",
    body: { endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, seen_at: new Date().toISOString() },
  });
  // Unsent reminders are rebuilt from the list; sent ones stay so an event
  // is never announced twice.
  await rest(`push_reminders?endpoint=eq.${enc(sub.endpoint)}&sent_at=is.null`, {
    method: "DELETE",
    prefer: "return=minimal",
  });
  if (reminders.length) {
    await rest("push_reminders?on_conflict=endpoint,event_id", {
      method: "POST",
      prefer: "resolution=ignore-duplicates,return=minimal",
      body: reminders.map((r) => ({ ...r, endpoint: sub.endpoint })),
    });
  }
  return { pending: reminders.length };
}

export async function forgetDevice(endpoint: string): Promise<void> {
  await rest(`push_devices?endpoint=eq.${enc(endpoint)}`, { method: "DELETE", prefer: "return=minimal" });
}

/** The browser rotated a device's push address: move its reminders over. */
export async function moveDevice(oldEndpoint: string, next: DeviceSub): Promise<void> {
  await rest(`push_devices?endpoint=eq.${enc(oldEndpoint)}`, {
    method: "PATCH",
    prefer: "return=minimal",
    body: { endpoint: next.endpoint, p256dh: next.keys.p256dh, auth: next.keys.auth, seen_at: new Date().toISOString() },
  });
}

function vapid() {
  const publicKey = (process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "").trim();
  const privateKey = (process.env.VAPID_PRIVATE_KEY || "").trim();
  if (!publicKey) throw new NotConfiguredError("NEXT_PUBLIC_VAPID_PUBLIC_KEY");
  if (!privateKey) throw new NotConfiguredError("VAPID_PRIVATE_KEY");
  const subject = (process.env.VAPID_SUBJECT || `mailto:${CONTACT_EMAIL}`).trim();
  return { subject, publicKey, privateKey };
}

export function pushConfigured(): boolean {
  return Boolean(
    (process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)?.trim() && process.env.VAPID_PRIVATE_KEY?.trim(),
  );
}

interface DueRow extends Reminder {
  endpoint: string;
}
interface DeviceRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Reminders more than this late are dropped rather than sent. */
const STALE_MS = 3 * 60 * 60 * 1000;

export async function runReminders(now = Date.now()): Promise<{ sent: number; failed: number; gone: number }> {
  const vapidDetails = vapid();
  const nowIso = new Date(now).toISOString();
  const staleIso = new Date(now - STALE_MS).toISOString();

  // Claim everything due in one statement, so a parallel run gets nothing.
  const due = await rest<DueRow[]>(
    `push_reminders?sent_at=is.null&remind_at=lte.${enc(nowIso)}&remind_at=gte.${enc(staleIso)}` +
      "&select=endpoint,event_id,remind_at,title,body,url",
    { method: "PATCH", prefer: "return=representation", body: { sent_at: nowIso } },
  );

  // Housekeeping: late leftovers and old history.
  await rest(`push_reminders?sent_at=is.null&remind_at=lt.${enc(staleIso)}`, {
    method: "DELETE",
    prefer: "return=minimal",
  }).catch(() => {});
  await rest(`push_reminders?remind_at=lt.${enc(new Date(now - 7 * 86_400_000).toISOString())}`, {
    method: "DELETE",
    prefer: "return=minimal",
  }).catch(() => {});

  const devices = new Map<string, DeviceRow | null>();
  let sent = 0;
  let failed = 0;
  let gone = 0;
  for (const r of due ?? []) {
    if (!devices.has(r.endpoint)) {
      const rows = await rest<DeviceRow[]>(`push_devices?endpoint=eq.${enc(r.endpoint)}&select=endpoint,p256dh,auth`);
      devices.set(r.endpoint, rows?.[0] ?? null);
    }
    const d = devices.get(r.endpoint);
    if (!d) continue;
    const payload = JSON.stringify({ title: r.title, body: r.body, url: r.url, tag: `ev-${r.event_id}` });
    try {
      await sendNotification({ endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } }, payload, {
        vapidDetails,
        TTL: 2 * 60 * 60,
        urgency: "high",
        timeout: 10_000,
      });
      sent++;
    } catch (err) {
      const code = (err as WebPushError).statusCode;
      if (code === 404 || code === 410) {
        // The device unsubscribed or the app was removed: forget it.
        devices.set(r.endpoint, null);
        await forgetDevice(r.endpoint).catch(() => {});
        gone++;
      } else {
        failed++;
        console.error("[reminders] push failed", code, (err as Error).message.slice(0, 200));
      }
    }
  }
  return { sent, failed, gone };
}
