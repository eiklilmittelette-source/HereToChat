const CACHE_NAME = 'heretochat-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());

self.addEventListener('fetch', (event) => {
  // Let all requests pass through to network (real-time app)
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
