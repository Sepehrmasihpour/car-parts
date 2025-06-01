const CACHE_NAME = "carparts-pwa-v1";
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/favicon.ico",
  "/manifest.json",
  "/icons/",
  "/icons/icons8-car-50.png",
  // Add any other static assets you want offline:
  "/global.css", // if you have a global CSS
  "/src/main.js", // or your compiled JS chunk names
  // Note: Vite will fingerprint your JS/CSS with hashes, so you may need a
  // more dynamic approach to precache. A Vite PWA plugin can help.
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
  );
});

self.addEventListener("fetch", (event) => {
  // “Cache-first” strategy: serve from cache if available, otherwise fetch
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return (
        cached ||
        fetch(event.request).then((networkResponse) => {
          // Optionally add new resources to the cache:
          return caches.open(CACHE_NAME).then((cache) => {
            // Don’t cache non-GET or cross-origin requests
            if (
              event.request.method === "GET" &&
              event.request.url.startsWith(self.location.origin)
            ) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          });
        })
      );
    })
  );
});
