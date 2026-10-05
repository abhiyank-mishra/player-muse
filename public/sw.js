const CACHE_NAME = 'muse-v11';

const STATIC_ASSETS = [
  '/manifest.json',
  '/logo.png',
  '/og-image.png',
  '/placeholder.png',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.map((key) => {
        if (key !== CACHE_NAME) {
          return caches.delete(key);
        }
      })
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Only handle GET requests
  if (request.method !== 'GET') return;

  // 2. NEVER intercept localhost or 127.0.0.1 (prevents Turbopack dev server corruption)
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return;

  // 3. NEVER intercept any /api/ requests (always fetch fresh directly from network)
  if (url.pathname.startsWith('/api/')) return;

  // 4. NEVER intercept WebSocket / HMR requests
  if (
    request.headers.get('upgrade') === 'websocket' ||
    url.pathname.includes('/_next/webpack-hmr') ||
    url.pathname.includes('turbopack')
  ) {
    return;
  }

  // 5. CRITICAL: Never intercept audio/video streams or CDNs
  // Howler.js uses html5 audio under the hood. Intercepting these with SW
  // causes broken Range requests and stalls background playback.
  if (
    url.protocol === 'data:' ||
    url.protocol === 'blob:' ||
    request.destination === 'audio' ||
    request.destination === 'video' ||
    url.hostname.includes('saavncdn.com') ||
    url.hostname.includes('sndup.net') ||
    url.hostname.includes('soundcloud') ||
    url.pathname.endsWith('.mp3') ||
    url.pathname.endsWith('.m4a') ||
    url.pathname.endsWith('.mp4') ||
    url.pathname.endsWith('.aac') ||
    url.pathname.endsWith('.wav')
  ) {
    return;
  }

  // 6. Navigation requests — Network First with strict 3.5s timeout (prevents 1-2 min hang)
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const networkPromise = fetch(request);
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('SW navigation timeout')), 3500)
          );
          const response = await Promise.race([networkPromise, timeoutPromise]);
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        } catch {
          // If offline or timed out, try cache fallback
          const cached = await caches.match(request);
          if (cached) return cached;
          const rootCached = await caches.match('/');
          if (rootCached) return rootCached;
          const downloadsCached = await caches.match('/downloads');
          if (downloadsCached) return downloadsCached;
          return fetch(request);
        }
      })()
    );
    return;
  }

  // 7. Image assets — Cache First
  if (request.destination === 'image' || url.hostname === 'c.saavncdn.com') {
    event.respondWith(
      caches.match(request).then((cached) => {
        return (
          cached ||
          fetch(request)
            .then((res) => {
              if (res.ok || res.type === 'opaque') {
                const copy = res.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
              }
              return res;
            })
            .catch(() => caches.match('/logo.png'))
        );
      })
    );
    return;
  }

  // 8. Static hashed assets (/_next/static/) and static fonts/css — Cache First
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.woff') ||
    url.pathname.endsWith('.ttf')
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return res;
        });
      })
    );
    return;
  }

  // Any other request: browser default fetch (do not intercept)
});
