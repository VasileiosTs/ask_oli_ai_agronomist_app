// Oli Service Worker — minimal for PWA install + offline fallback
const CACHE_NAME = 'oli-v1';
const OFFLINE_URL = '/offline.html';

// Pre-cache the offline page on install
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        OFFLINE_URL,
        '/favicon.svg',
        '/favicon-180.png',
        '/favicon-512.png',
      ]);
    })
  );
  // Activate immediately — don't wait for old SW to die
  self.skipWaiting();
});

// Clean up old caches on activate
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );
  // Take control of all pages immediately
  self.clients.claim();
});

// Network-first strategy: try network, fall back to offline page for navigations
self.addEventListener('fetch', (event) => {
  // Only handle navigation requests (HTML pages)
  if (event.request.mode !== 'navigate') return;

  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(OFFLINE_URL);
    })
  );
});
