const CACHE_NAME = 'vierra-v3';
const START_URL = '/';
const RUNTIME_CACHE = 'vierra-runtime-v3';

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
  const isNextAsset = url.pathname.startsWith('/_next/');
  const isApiRoute = url.pathname.startsWith('/api/');
  const isDocumentRequest = event.request.mode === 'navigate' || event.request.destination === 'document';

  // Never cache Next.js build assets or API responses to avoid stale chunk errors
  if (isNextAsset || isApiRoute) {
    event.respondWith(fetch(event.request));
    return;
  }

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
          // Only fallback to start_url for the homepage itself.
          // Avoid forcing deep links (e.g. /set-password/:token) to "/".
          if (isDocumentRequest) {
            if (isStartUrl) {
              return caches.match(START_URL);
            }
            // Show a retry preloader for deep-link document requests
            // instead of a hard browser ERR_FAILED page.
            return new Response(`
              <!doctype html>
              <html lang="en">
                <head>
                  <meta charset="utf-8" />
                  <meta name="viewport" content="width=device-width, initial-scale=1" />
                  <title>Vierra | Loading</title>
                  <style>
                    body {
                      margin: 0;
                      font-family: Arial, sans-serif;
                      background: linear-gradient(135deg, #4F1488 0%, #2E0A4F 50%, #18042A 100%);
                    }
                    .wrap {
                      min-height: 100vh;
                      display: flex;
                      flex-direction: column;
                      align-items: center;
                      justify-content: center;
                      gap: 24px;
                      padding: 24px;
                    }
                    .logo {
                      width: auto;
                      height: 40px;
                      opacity: 0.8;
                    }
                    .dots {
                      display: flex;
                      align-items: center;
                      gap: 6px;
                    }
                    .dot {
                      width: 8px;
                      height: 8px;
                      border-radius: 999px;
                      background: rgba(255, 255, 255, 0.7);
                      animation: bounce 1s infinite;
                    }
                    .dot:nth-child(1) { animation-delay: 0ms; }
                    .dot:nth-child(2) { animation-delay: 150ms; }
                    .dot:nth-child(3) { animation-delay: 300ms; }
                    @keyframes bounce {
                      0%, 80%, 100% { transform: translateY(0); opacity: 0.7; }
                      40% { transform: translateY(-6px); opacity: 1; }
                    }
                  </style>
                </head>
                <body>
                  <div class="wrap">
                    <img class="logo" src="/assets/vierra-logo.png" alt="Vierra" />
                    <div class="dots">
                      <span class="dot"></span>
                      <span class="dot"></span>
                      <span class="dot"></span>
                    </div>
                  </div>
                  <script>
                    setTimeout(function () {
                      window.location.replace(${JSON.stringify(url.pathname + url.search + url.hash)});
                    }, 1200);
                  </script>
                </body>
              </html>
            `, {
              status: 200,
              headers: {
                'Content-Type': 'text/html; charset=UTF-8',
                'Cache-Control': 'no-store',
              },
            });
          }
        });
    })
  );
});

