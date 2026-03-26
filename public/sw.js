// Oli Service Worker — PWA install + push notifications
const CACHE_NAME = 'oli-v3';

// Install: skip waiting immediately, no pre-caching
self.addEventListener('install', () => {
  self.skipWaiting();
});

// Activate: delete ALL old caches to prevent stale assets
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

// Do NOT intercept fetch — let the browser handle all requests normally.
// This prevents stale HTML/JS/CSS from being served after deploys.

// ── PUSH NOTIFICATIONS ──
self.addEventListener('push', (event) => {
  let data = { title: 'Oli', body: 'You have a new update', url: '/chat' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // fallback to defaults
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/favicon-180.png',
      badge: '/favicon-48.png',
      tag: data.tag || 'oli-notification',
      data: { url: data.url || '/chat' },
      vibrate: [100, 50, 100],
    })
  );
});

// When user clicks the notification, open/focus the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/chat';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus existing tab if open
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Otherwise open new window
      return self.clients.openWindow(url);
    })
  );
});
