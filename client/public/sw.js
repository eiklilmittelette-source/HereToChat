const CACHE_NAME = 'heretochat-v9';

// Fichiers à pré-cacher au moment de l'installation
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/dragon-logo.svg',
  '/manifest.json',
  '/notif.wav'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(
      names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API, socket.io, uploads : network only, fallback offline
  if (url.pathname.startsWith('/api') ||
      url.pathname.startsWith('/socket.io') ||
      url.pathname.startsWith('/uploads')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ error: 'offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // Network first, fallback to cache, et on met en cache la réponse
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cloner la réponse pour la mettre en cache
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Push notification handler
self.addEventListener('push', (event) => {
  let data = { title: 'HereToChat', body: 'Nouveau message' };
  try {
    data = event.data.json();
  } catch {}

  const options = {
    body: data.body || 'Nouveau message',
    icon: '/dragon-logo.svg',
    badge: '/dragon-logo.svg',
    vibrate: [300, 100, 300, 100, 300],
    tag: data.tag || 'message',
    renotify: true,
    silent: false,
    requireInteraction: true,
    data: { url: '/' }
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'HereToChat', options)
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then(windowClients => {
        windowClients.forEach(client => client.postMessage({ type: 'PLAY_NOTIF_SOUND' }));
      })
  );
});

// Click on notification -> open app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow('/');
    })
  );
});
