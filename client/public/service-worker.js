/* ============================================================
   SERVICE WORKER — FoodBridge Push Notifications
   Place this file at: /public/service-worker.js
   Register it from your React app's index.js or App.jsx.

   Registration example (add once at app root):
   ─────────────────────────────────────────────
   if ("serviceWorker" in navigator) {
     navigator.serviceWorker
       .register("/service-worker.js")
       .then(reg => console.log("SW registered:", reg.scope))
       .catch(err => console.error("SW registration failed:", err));
   }
============================================================ */

const CACHE_NAME = "foodbridge-v1";

/* ============================================================
   INSTALL — pre-cache shell assets so the app works offline
============================================================ */
self.addEventListener("install", (event) => {
  // Skip waiting so the new SW activates immediately
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll([
        "/",
        "/index.html",
        // Add any other static shells you want available offline
      ])
    )
  );
});

/* ============================================================
   ACTIVATE — clean up stale caches from previous SW versions
============================================================ */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  // Take control of all open clients immediately
  self.clients.claim();
});

/* ============================================================
   FETCH — network-first strategy
   Try the network; fall back to cache only if offline.
   API calls (/api/*) are never cached.
============================================================ */
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never intercept non-GET or API requests
  if (request.method !== "GET" || url.pathname.startsWith("/api")) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Clone and cache successful responses for shell assets
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return response;
      })
      .catch(() => caches.match(request))
  );
});

/* ============================================================
   PUSH — receive a push event from the server
   Your backend sends a Web Push notification via the
   Web Push Protocol (e.g. using the `web-push` npm package).

   Payload shape expected from server:
   {
     "title":   "Food Reserved 📦",
     "body":    "Biryani reserved by GreenAid NGO",
     "icon":    "/icons/icon-192.png",
     "badge":   "/icons/badge-72.png",
     "tag":     "food-reserved",          // collapses duplicate notifs
     "data": {
       "url": "/restaurant"               // where to navigate on click
     }
   }
============================================================ */
self.addEventListener("push", (event) => {
  let payload = {
    title: "FoodBridge",
    body:  "You have a new notification.",
    icon:  "/icons/icon-192.png",
    badge: "/icons/badge-72.png",
    tag:   "foodbridge-default",
    data:  { url: "/" },
  };

  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch {
      payload.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body:    payload.body,
      icon:    payload.icon,
      badge:   payload.badge,
      tag:     payload.tag,       // replaces previous notif with same tag
      renotify: true,             // vibrate even if replacing same tag
      data:    payload.data,
    })
  );
});

/* ============================================================
   NOTIFICATION CLICK — focus existing tab or open new one
============================================================ */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        // If app is already open, focus the existing tab
        for (const client of clients) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        // Otherwise open a new tab
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});

/* ============================================================
   NOTIFICATION CLOSE — optional analytics hook
============================================================ */
self.addEventListener("notificationclose", (event) => {
  // You can log dismissed notifications here if needed
  console.log("[SW] Notification dismissed:", event.notification.tag);
});