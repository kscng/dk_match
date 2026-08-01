// Bump this on any deploy that changes cached files — it's the only way old
// clients pick up new assets, since everything below is otherwise cache-forever.
const CACHE = 'dk-match-v1';

// Just the app shell up front. The character/face/texture files under Tusks/ and
// models/ (150+ of them, plus whatever three.js's addon modules import internally)
// are cached lazily on first fetch instead of hand-listed here — simpler, and it
// naturally covers new bosses or files without editing this list. First page load
// is always uncontrolled (the browser spec doesn't let a SW intercept the load that
// installs it), so those fetches land in cache the moment the second load happens.
const SHELL = [
  './',
  'demo.html',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  'node_modules/three/build/three.module.js',
  'node_modules/three/examples/jsm/loaders/ColladaLoader.js',
  'node_modules/three/examples/jsm/controls/OrbitControls.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

// Cache-first, falling back to network — and caching whatever the network returns
// so the next load (even offline) has it. Only same-origin GETs are handled; anything
// else (there shouldn't be any — no CDN, no API calls) passes straight through untouched.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cached = await caches.match(e.request);
    if (cached) return cached;
    try {
      const res = await fetch(e.request);
      if (res.ok) (await caches.open(CACHE)).put(e.request, res.clone());
      return res;
    } catch (err) {
      if (e.request.mode === 'navigate') return caches.match('demo.html');
      throw err;
    }
  })());
});
