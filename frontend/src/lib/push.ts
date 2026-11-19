"use client";

/**
 * Reminders on this device: the service worker, the push subscription, and
 * keeping the server's copy in step with the saved list.
 */

import { useSyncExternalStore } from "react";
import { createStore } from "./clientStore";
import { Event } from "./types";
import { remindersFor, reminderKey } from "./reminders";

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() || "";

interface State {
  on: boolean;
  /** Fingerprint of the last list the server accepted. */
  key?: string;
}
const store = createStore<State>("ee.reminders.v1", { on: false });
export const useReminders = () => store.useValue();

export type Support = "ok" | "install-first" | "blocked" | "unsupported";

const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
export const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

export function pushSupport(): Support {
  if (!VAPID || !("serviceWorker" in navigator)) return "unsupported";
  // iPhones only offer notifications to sites added to the Home Screen.
  if (isIOS() && !isStandalone()) return "install-first";
  if (!("PushManager" in window) || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  return "ok";
}

export function registerWorker(): Promise<ServiceWorkerRegistration> | null {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

function keyBytes(b64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function subscription(create: boolean): Promise<PushSubscription | null> {
  const reg = await (registerWorker() ?? Promise.reject(new Error("Service workers are off")));
  await navigator.serviceWorker.ready;
  const have = await reg.pushManager.getSubscription();
  if (have || !create) return have;
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID) });
}

async function send(method: "PUT" | "DELETE", body: unknown): Promise<void> {
  const res = await fetch("/api/reminders", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(j?.error || "Couldn't reach the server.");
  }
}

async function push(sub: PushSubscription, events: Event[]): Promise<void> {
  const reminders = remindersFor(events);
  const key = `${sub.endpoint}#${reminderKey(reminders)}`;
  if (store.read().key === key) return;
  await send("PUT", { subscription: sub.toJSON(), reminders });
  store.write({ on: true, key });
}

/** Ask for permission, subscribe and send the reminders. Throws with a readable message. */
export async function turnOn(events: Event[]): Promise<void> {
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Notifications weren't allowed, so reminders can't arrive.");
  const sub = await subscription(true);
  if (!sub) throw new Error("This browser didn't give a push address.");
  store.write({ on: true });
  await push(sub, events);
}

export async function turnOff(): Promise<void> {
  store.write({ on: false });
  const sub = await subscription(false).catch(() => null);
  if (!sub) return;
  await send("DELETE", { endpoint: sub.endpoint }).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}

/** Re-send the list when saves change (no-op when nothing changed or reminders are off). */
export async function syncReminders(events: Event[]): Promise<void> {
  if (!store.read().on || pushSupport() !== "ok" || Notification.permission !== "granted") return;
  const sub = await subscription(false);
  if (!sub) {
    // The browser dropped the subscription (site data cleared): start again.
    const fresh = await subscription(true);
    if (fresh) await push(fresh, events);
    return;
  }
  await push(sub, events);
}

// Install prompt (Chrome/Edge/Android). Captured once, offered by the UI.
type InstallEvent = globalThis.Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let deferred: InstallEvent | null = null;
const installListeners = new Set<() => void>();
export function captureInstallPrompt(): () => void {
  const onPrompt = (e: globalThis.Event) => {
    e.preventDefault();
    deferred = e as unknown as InstallEvent;
    installListeners.forEach((l) => l());
  };
  const onInstalled = () => {
    deferred = null;
    installListeners.forEach((l) => l());
  };
  window.addEventListener("beforeinstallprompt", onPrompt);
  window.addEventListener("appinstalled", onInstalled);
  return () => {
    window.removeEventListener("beforeinstallprompt", onPrompt);
    window.removeEventListener("appinstalled", onInstalled);
  };
}
export const useCanInstall = () =>
  useSyncExternalStore(
    (l) => {
      installListeners.add(l);
      return () => installListeners.delete(l);
    },
    () => deferred !== null,
    () => false,
  );
export async function promptInstall(): Promise<boolean> {
  const d = deferred;
  if (!d) return false;
  deferred = null;
  installListeners.forEach((l) => l());
  await d.prompt();
  return (await d.userChoice).outcome === "accepted";
}
