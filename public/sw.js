const CACHE_NAME = 'vierra-v1';
const START_URL = '/';
const RUNTIME_CACHE = 'vierra-runtime-v1';

// Install event - cache essential resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        START_URL,
        '/favicon.ico',
      ]).catch((error) => {
        console.log('Cache addAll failed:', error);
      });
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              return cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE;
            })
            .map((cacheName) => caches.delete(cacheName))
        );
      }),
      self.clients.claim()
    ])
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  const url = new URL(event.request.url);
  const isStartUrl = url.pathname === '/' || url.pathname === '/index.html';

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // For start_url, always try to serve from cache first if available
      if (isStartUrl && cachedResponse) {
        // Update cache in background
        fetch(event.request).then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const responseToCache = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
        }).catch(() => {
          // Ignore fetch errors for background update
        });
        return cachedResponse;
      }

      // For other requests, try network first
      return fetch(event.request)
        .then((response) => {
          // Don't cache non-successful responses
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          const responseToCache = response.clone();

          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return response;
        })
        .catch(() => {
          // Return cached response if available, especially for start_url
          if (cachedResponse) {
            return cachedResponse;
          }
          // For navigation requests, try to return start_url from cache
          if (event.request.mode === 'navigate' || event.request.destination === 'document') {
            return caches.match(START_URL);
          }
        });
    })
  );
});

