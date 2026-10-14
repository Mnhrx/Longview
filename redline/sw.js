/* Redline offline cache. Bump VERSION whenever you upload new files. */
const VERSION = 'redline-v5.5.0';
const CORE = ['./', 'index.html', 'js/sound.js', 'js/data.js', 'js/map.js', 'js/parts.js', 'js/wrap.js', 'js/radar.js', 'js/app.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => Promise.all(CORE.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== VERSION).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url); if (e.request.method !== 'GET') return;
  if (/osrm|data\.gov\.sg/.test(u.host)) return; // live routing always goes to the network
  if (e.request.mode === 'navigate') { e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(VERSION).then(x => x.put('index.html', c)); return r; }).catch(() => caches.match('index.html'))); return; }
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => { if (r.ok || r.type === 'opaque') { const c = r.clone(); caches.open(VERSION).then(x => x.put(e.request, c)); } return r; })));
});
