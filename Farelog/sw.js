// Cache name. Bumping it on a release isn't load-bearing for updates any more
// (the network-first fetch handler below is what keeps things current), but a
// fresh name still guarantees a clean slate per release, so keep it in step
// with APP_VERSION in index.html.
const CACHE_NAME = "farelog-shell-v3.2.0";
const SHELL_FILES = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png",
];

self.addEventListener("install", (event) => {
  // Prime the offline copy on first install. Failing here (e.g. installed
  // while offline) must not block activation — the fetch handler fills the
  // cache in as pages are used anyway.
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).catch(() => {})
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

// Network-first for the app's own files, falling back to the cached copy.
//
// The earlier version of this was cache-first, which meant a browser that had
// opened the app once would keep serving its saved copy and never notice a new
// release — the app had to be updated by hand (two reloads, or clearing site
// data) on every device, every time. Network-first flips that: with a
// connection, the live file always wins and the cache is refreshed behind it;
// with no connection, the last-known-good copy is served exactly as before, so
// offline use is unchanged.
//
// Cross-origin requests (Tesseract.js, Chart.js from their CDNs) aren't
// intercepted at all — they go straight to the network as normal.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        // Offline (or the request failed): fall back to whatever was saved.
        caches.match(event.request).then((cached) =>
          cached || caches.match("./index.html").then((shell) => shell || Response.error())
        )
      )
  );
});
