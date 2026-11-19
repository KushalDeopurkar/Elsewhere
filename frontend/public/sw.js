/*
 * Elsewhere service worker: reminders only. It deliberately does not cache
 * pages or assets, so a deploy is never hidden behind a stale copy.
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let data = {};
  try {
    data = e.data ? e.data.json() : {};
  } catch {
    data = { title: "Elsewhere", body: e.data ? e.data.text() : "" };
  }
  const title = data.title || "Elsewhere";
  e.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/badge-96.png",
      tag: data.tag || undefined,
      data: { url: data.url || "/saved" },
    }),
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "/saved", self.location.origin).href;
  e.waitUntil(
    (async () => {
      const open = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of open) {
        if (new URL(c.url).origin === self.location.origin && "navigate" in c) {
          await c.focus();
          return c.navigate(url);
        }
      }
      return self.clients.openWindow(url);
    })(),
  );
});

// The browser rotated this device's push address: tell the server to move
// the reminders over, so they keep arriving.
self.addEventListener("pushsubscriptionchange", (e) => {
  e.waitUntil(
    (async () => {
      const old = e.oldSubscription;
      const opts = (old && old.options) || e.newSubscription?.options;
      const next = e.newSubscription || (opts ? await self.registration.pushManager.subscribe(opts) : null);
      if (!old || !next) return;
      await fetch("/api/reminders", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ old: old.endpoint, subscription: next.toJSON() }),
      });
    })(),
  );
});
