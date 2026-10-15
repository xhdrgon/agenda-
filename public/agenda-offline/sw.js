'use strict';
const BASE = new URL('./', self.location.href);
const PREFIX = 'agenda-apuntes:' + BASE.pathname + ':';
const CACHE = PREFIX + '1.0.0';
const FILES = [
  './index.html', './styles.css', './core.js', './storage.js', './app.js',
  './manifest.webmanifest', './icons/icon.svg', './icons/icon-192.png',
  './icons/icon-512.png', './icons/apple-touch-icon.png'
];
const ASSETS = FILES.map(path => new URL(path, BASE).href);
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(ASSETS.map(url => new Request(url, { cache: 'reload' })));
    // No forced activation on updates: open pages keep their compatible version.
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'OFFLINE_STATUS' && event.ports[0]) {
    event.waitUntil((async () => {
      const cache = await caches.open(CACHE);
      const entries = await Promise.all(ASSETS.map(url => cache.match(url)));
      event.ports[0].postMessage({ ready: entries.every(Boolean), version: '1.0.0' });
    })());
  }
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== BASE.origin || !url.pathname.startsWith(BASE.pathname)) return;
  const isEntry = request.mode === 'navigate' &&
    (url.pathname === BASE.pathname || url.pathname === new URL('index.html', BASE).pathname);
  const assetKey = url.origin + url.pathname;
  if (!isEntry && !ASSETS.includes(assetKey)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(isEntry ? new URL('index.html', BASE).href : assetKey);
    if (hit) return hit;
    // A missing cache entry is repaired only with a successful same-origin response.
    try {
      const response = await fetch(request);
      if (response.ok && response.type !== 'opaque' && !response.redirected) {
        await cache.put(isEntry ? new URL('index.html', BASE).href : assetKey, response.clone());
      }
      return response;
    } catch (_) {
      return new Response('No disponible sin conexión. Abre la agenda con internet para prepararla.', {
        status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }
  })());
});
