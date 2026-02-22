const CACHE_NAME = 'heretochat-v2';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});

// Push notification handler
self.addEventListener('push', (event) => {
  let data = { title: 'HereToChat', body: 'Nouveau message' };
  try {
    data = event.data.json();
  } catch {}

  const options = {
    body: data.body || 'Nouveau message',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    tag: data.tag || 'message',
    renotify: true,
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
