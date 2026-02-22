const CACHE_NAME = 'heretochat-v5';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(
      names.map((n) => caches.delete(n))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Always fetch from network first, never serve stale cache
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
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
