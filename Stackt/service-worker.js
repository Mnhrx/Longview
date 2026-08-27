// ============================================
// Minimal offline cache — app shell + data, cache-first with network fallback.
// Bump CACHE_NAME whenever you deploy changes so old clients pick them up.
// ============================================

const CACHE_NAME = "stackt-v24";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/styles.css",
  "./js/main.js",
  "./js/core.js",
  "./js/ui.js",
  "./js/animations.js",
  "./js/home.js",
  "./js/settings.js",
  "./js/share.js",
  "./js/icons.js",
  "./js/sorting.js",
  "./js/books.js",
  "./js/lps.js",
  "./js/music.js",
  "./js/barcode.js",
  "./js/placeholder.js",
  "./js/vendor/html5-qrcode.min.js",
  "./data/seed.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => cached);
    })
  );
});
