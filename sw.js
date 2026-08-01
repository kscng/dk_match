// Bump this on any deploy that changes cached files — it's the only way old
// clients pick up new assets, since everything below is otherwise cache-forever.
const CACHE = 'dk-match-v3';

// Just the app shell up front. The character/face/texture files under Tusks/ and
// models/ (150+ of them, plus whatever three.js's addon modules import internally)
// are cached lazily on first fetch instead of hand-listed here — simpler, and it
// naturally covers new bosses or files without editing this list. First page load
// is always uncontrolled (the browser spec doesn't let a SW intercept the load that
// installs it), so those fetches land in cache the moment the second load happens.
const SHELL = [
  // No index.html in this project (demo.html is the real entry point), so './'
  // 404s here — and one failing URL fails cache.addAll() for the *entire* install,
  // silently discarding the whole registration. Learned that the hard way: it
  // passed locally because Python's http.server shows a directory listing for '/'
  // instead of 404ing, masking the bug until it hit the real GitHub Pages host.
  'demo.html',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  'vendor/three/build/three.module.js',
  'vendor/three/build/three.core.js',
  'vendor/three/examples/jsm/loaders/ColladaLoader.js',
  'vendor/three/examples/jsm/loaders/TGALoader.js',
  'vendor/three/examples/jsm/loaders/collada/ColladaParser.js',
  'vendor/three/examples/jsm/loaders/collada/ColladaComposer.js',
  'vendor/three/examples/jsm/controls/OrbitControls.js',
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
