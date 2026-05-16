// Smart Biz AI — Service Worker
// Strategy: Cache First for static assets, Network First for API calls

const CACHE_NAME = 'smartbiz-v1';
const STATIC_CACHE = 'smartbiz-static-v1';

// Assets to pre-cache on install
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// Install: pre-cache shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(k => k !== CACHE_NAME && k !== STATIC_CACHE)
        .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: cache-first for static, network-first for data
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET, browser extensions, supabase API, external
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin && !url.hostname.endsWith('supabase.co')) return;

  // Supabase API: network first, no cache
  if (url.hostname.endsWith('supabase.co')) {
    event.respondWith(
      fetch(request).catch(() => new Response(JSON.stringify({ error: 'offline' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 503,
      }))
    );
    return;
  }

  // JS/CSS/image assets: cache first
  if (/\.(js|css|woff2?|png|jpg|svg|ico)$/.test(url.pathname)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(cache =>
        cache.match(request).then(cached => {
          if (cached) return cached;
          return fetch(request).then(res => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          });
        })
      )
    );
    return;
  }

  // HTML pages: network first, fall back to cache, then offline page
  event.respondWith(
    fetch(request)
      .then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(STATIC_CACHE).then(c => c.put(request, clone));
        }
        return res;
      })
      .catch(() =>
        caches.match(request).then(cached =>
          cached || caches.match('/') || new Response('Offline — please check your connection.', {
            status: 503,
            headers: { 'Content-Type': 'text/html' },
          })
        )
      )
  );
});

// Background sync placeholder (for future offline sale recording)
self.addEventListener('sync', event => {
  if (event.tag === 'sync-pending-sales') {
    // TODO: flush IndexedDB pending sales to Supabase
    console.log('[SW] Background sync: pending sales');
  }
});
