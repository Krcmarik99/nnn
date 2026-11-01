'use strict';
// Service worker: aplikácia sa dá nainštalovať a rýchlo sa načíta.
// Stratégia „najprv sieť“ – po novom nasadení hráč hneď dostane najnovšiu verziu;
// bez siete sa použije uložená kópia (hra samotná však potrebuje pripojenie k serveru).
const CACHE = 'suostrovie-v1';
const SHELL = ['/', '/style.css', '/client.js', '/fx.js', '/textures.js', '/sprites.js', '/particles.js',
  '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.pathname === '/healthz') return;
  const isFont = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (url.origin !== self.location.origin && !isFont) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await fetch(req);
      if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
      return res;
    } catch {
      const hit = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
      return hit || (req.mode === 'navigate' ? cache.match('/') : Response.error());
    }
  })());
});
