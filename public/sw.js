// Service worker for installability.
//
// DELIBERATELY does not cache pages or API responses. This app shows money
// owed, overdue invoices and cash position — serving a stale cached figure
// would be worse than showing nothing, so every navigation and every /api
// request goes to the network, always. Only content-hashed immutable build
// assets and icons are cached, which changes nothing about correctness.

const STATIC_CACHE = "static-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isImmutableAsset(url) {
  // /_next/static/* filenames contain a content hash, so a cached copy can
  // never be stale. Icons are versioned by redeploy and are not data.
  return url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (!isImmutableAsset(url)) {
    // Pages and API calls: straight to the network, never cached.
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
    )
  );
});
