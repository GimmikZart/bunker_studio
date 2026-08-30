/* global self, caches, fetch, clients */
const CACHE = 'bunker-studio-v1';
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(['/'])));
});
self.addEventListener('fetch', (event) => {
  if (event.request.method === 'GET') {
    event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
  }
});
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : { title: 'Bunker Studio' };
  event.waitUntil(self.registration.showNotification(data.title, data));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const deepLink = event.notification.data && event.notification.data.deepLink;
  if (deepLink) event.waitUntil(clients.openWindow(deepLink));
});
