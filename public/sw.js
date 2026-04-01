// Oli Service Worker — PWA install + push notifications + smart caching
// CACHE_NAME token is replaced at build time by vite.config.ts swVersionPlugin
const CACHE_NAME = '__SW_CACHE_VERSION__';
// Cache both the app shell (/) and the offline fallback
const SHELL_URLS = ['/', '/offline.html'];

// Install: cache app shell + offline fallback, then activate immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS))
  );
  self.skipWaiting();
});

// Activate: delete old versioned caches, keep current
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch strategy:
// - HTML navigations: network-first, fall back to offline page
// - Hashed assets (/assets/*): cache-first (immutable, content-hashed by Vite)
// - Everything else: network-only (API calls, etc.)
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // HTML navigation requests — network first, fall back to cached app shell.
  // This lets the SPA router handle all routes offline once the shell is cached.
  // Falls back to offline.html only if the shell itself isn't cached yet.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache the freshest index.html so future offline loads are up to date
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/', clone));
          }
          return response;
        })
        .catch(() => caches.match('/') || caches.match('/offline.html'))
    );
    return;
  }

  // Vite hashed assets (e.g. /assets/index-abc123.js) — cache-first
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Everything else (API calls, etc.) — network only, no interception
});

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
