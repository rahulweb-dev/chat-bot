/* Convo360 service worker: shows push notifications for new chats, leads and
   bookings, and opens the right dashboard page when one is tapped.
   Deliberately no offline caching: the dashboard is live data. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) { data = { title: "Convo360", body: event.data && event.data.text() }; }
  const title = data.title || "Convo360";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/app_icon.png",
      badge: "/app_icon.png",
      // Same tag replaces the previous notification (e.g. several messages in one chat).
      tag: data.tag || undefined,
      renotify: !!data.tag,
      data: { url: data.url || "/dashboard/chat" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/dashboard/chat", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.startsWith(self.location.origin) && "focus" in w) {
          w.navigate(url);
          return w.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
