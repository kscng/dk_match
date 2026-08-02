// Bump this on any deploy that changes cached files. Necessary but no longer sufficient on
// its own for demo.html/sw.js themselves — see the network-first note below; this still
// matters for forcing model/texture assets to refresh if one of those ever changes.
const CACHE = 'dk-match-v4';

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

// Navigations (i.e. demo.html itself) are network-first: cache-first here was the actual
// bug behind "it still flashes after the fix ships" — once demo.html was cached, this SW
// would keep serving that exact copy forever and never notice a new deploy existed, no
// matter how many times the file changed on the server. Model/texture assets stay
// cache-first below: they never change once ripped, and cache-first is what makes them
// load instantly offline instead of round-tripping the network on every visit.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;

  if (e.request.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const res = await fetch(e.request);
        if (res.ok) (await caches.open(CACHE)).put(e.request, res.clone());
        return res;
      } catch (err) {
        return (await caches.match(e.request)) || caches.match('demo.html');
      }
    })());
    return;
  }

  e.respondWith((async () => {
    const cached = await caches.match(e.request);
    if (cached) return cached;
    const res = await fetch(e.request);
    if (res.ok) (await caches.open(CACHE)).put(e.request, res.clone());
    return res;
  })());
});
