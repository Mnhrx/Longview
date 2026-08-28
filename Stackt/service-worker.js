// ============================================
// Minimal offline cache — app shell + data, cache-first with network fallback.
// Bump CACHE_NAME whenever you deploy changes so old clients pick them up.
// ============================================

const CACHE_NAME = "stackt-v29";
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
  "./js/covers.js",
  "./js/stars.js",
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

  // SAME-ORIGIN ONLY. This worker exists to make the app shell work offline;
  // it has no business touching covers.openlibrary.org or coverartarchive.org.
  //
  // It used to intercept everything, and that quietly broke cross-origin
  // images: replaying a cached cross-origin response to a request that asked
  // for CORS fails with ERR_FAILED. Covers vanished from the list, canvas
  // reads were refused, and it all looked random because it depended on what
  // happened to already be cached. Cover images have their own store
  // (covers.js); letting these straight through is both correct and simpler.
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

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
