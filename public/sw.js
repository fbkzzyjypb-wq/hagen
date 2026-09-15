/* Service worker for Hagen: enkel offline-cache og push-varsler. */
const CACHE = "hagen-v1";
const SCOPE = new URL(self.registration.scope).pathname;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Bygde filer med hash i navnet: cache først.
  if (url.pathname.includes("/_next/static/") || url.pathname.includes("/icons/")) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      })
    );
    return;
  }

  // Sider og øvrig: nett først, cache som reserve når du er offline.
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      try {
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      } catch {
        const hit = await cache.match(req);
        if (hit) return hit;
        if (req.mode === "navigate") {
          const fallback = await cache.match(SCOPE);
          if (fallback) return fallback;
        }
        throw new Error("offline");
      }
    })
  );
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Hagen", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Hagen";
  const url = data.url ? SCOPE.replace(/\/$/, "") + data.url : SCOPE;
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: SCOPE.replace(/\/$/, "") + "/icons/icon-192.png",
      badge: SCOPE.replace(/\/$/, "") + "/icons/icon-192.png",
      tag: data.tag || "hagen-" + (data.date || ""),
      data: { url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || SCOPE;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(target).catch(() => undefined);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
