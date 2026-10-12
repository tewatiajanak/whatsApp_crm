// Service worker: makes the app installable and shows push notifications.
// It never caches API calls or pages, so nobody is ever shown stale data.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let note = {};
  try { note = e.data ? e.data.json() : {}; } catch { note = { title: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(note.title || "CRM", { body: note.body || "", icon: "/apple-touch-icon.png", badge: "/favicon-64.png", data: { url: note.url || "/crm" } }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/crm";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((tabs) => {
      for (const tab of tabs) if ("focus" in tab) { tab.navigate(url); return tab.focus(); }
      return self.clients.openWindow(url);
    })
  );
});
