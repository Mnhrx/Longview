/* Home Time offline helper.
   Keeps a copy of the app and its libraries on the phone so it opens with no signal.
   The app page itself is always fetched fresh when there is signal (so updates show up),
   and falls back to the saved copy when there isn't. */
const V = 'home-time-27';
const CORE = [
  './', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => Promise.all(CORE.map(u => {
    const req = new Request(u, { mode: u.startsWith('http') ? 'no-cors' : 'same-origin' });
    return fetch(req).then(r => (r.ok || r.type === 'opaque') ? c.put(u, r) : null).catch(() => null);
  }))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('home-time-') && k !== V && k !== 'home-time-ocr').map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// the text-recognition files are big and never change, so they live in their own cache that survives updates
const OCR = /cdn\.jsdelivr\.net\/npm\/(tesseract|@tesseract|pdfjs-dist)|tessdata/;
const LIBS = /cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net|unpkg\.com/;

function put(cacheName, req, res) {
  if (res && (res.ok || res.type === 'opaque')) caches.open(cacheName).then(c => c.put(req, res.clone())).catch(() => {});
  return res;
}
function cacheFirst(req, cacheName) {
  return caches.match(req).then(hit => hit || fetch(req).then(r => put(cacheName, req, r)));
}
function networkFirst(req, cacheName, ms) {
  return new Promise(resolve => {
    let done = false;
    const fallback = () => caches.match(req, { ignoreSearch: req.mode === 'navigate' }).then(hit => {
      if (done) return; if (hit) { done = true; resolve(hit); }
    });
    const t = setTimeout(fallback, ms);
    fetch(req).then(r => { clearTimeout(t); put(cacheName, req, r); if (!done) { done = true; resolve(r); } })
      .catch(() => { clearTimeout(t); caches.match(req, { ignoreSearch: true })
        .then(hit => hit || caches.match('./index.html'))
        .then(hit => { if (!done) { done = true; resolve(hit || Response.error()); } }); });
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = req.url;
  if (req.mode === 'navigate') { e.respondWith(networkFirst(req, V, 4000)); return; }
  if (OCR.test(url)) { e.respondWith(cacheFirst(req, 'home-time-ocr')); return; }
  if (LIBS.test(url)) { e.respondWith(cacheFirst(req, V)); return; }
  if (/api\.nusmods\.com/.test(url)) { e.respondWith(networkFirst(req, V, 6000)); return; }
  if (new URL(url).origin === self.location.origin) { e.respondWith(networkFirst(req, V, 4000)); return; }
});
