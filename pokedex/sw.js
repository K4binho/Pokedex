'use strict';

/* Same-origin static app shell only. API calls and art remain network requests. */
const CACHE_NAME = 'k4-pokedex-android-v1';
const SHELL = [
  './', './index.html', './style.css?v=5', './layout-fixes.css?v=1',
  './android.css?v=1', './android.js?v=1', './guide.js?v=3',
  './ability-names.js?v=4', './catalog.js?v=5', './i18n.js?v=5',
  './enhancements.js?v=4', './script.js?v=5', './tabs.js?v=4',
  './search.js?v=5', './manifest.webmanifest', './app-icon.svg',
  './icons/icon-192.png', './icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(names => Promise.all(
    names.filter(name => name.startsWith('k4-pokedex-android-') && name !== CACHE_NAME)
      .map(name => caches.delete(name))
  )).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(self.registration.scope.replace(url.origin, ''))) {
    return; // Live Pokémon data and sprites must not be represented as offline data.
  }
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(request, copy)));
      }
      return response;
    }).catch(async () => (await caches.match(request)) || (await caches.match('./index.html')) || Response.error()));
    return;
  }
  event.respondWith((async () => {
    const cached = await caches.match(request);
    const fresh = fetch(request).then(async response => {
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    }).catch(() => null);
    if (cached) {
      event.waitUntil(fresh);
      return cached;
    }
    return (await fresh) || Response.error();
  })());
});
