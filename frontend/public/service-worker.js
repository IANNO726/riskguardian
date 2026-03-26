/* RiskGuardian Service Worker v1.0.0
 * Handles offline caching + push notifications
 */

const CACHE_NAME    = 'riskguardian-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// ── Install: cache static assets ─────────────────────────────────────────────
self.addEventListener('install', event => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: clear old caches ────────────────────────────────────────────────
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: network first, cache fallback ──────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip API calls — always go to network for live data
  if (url.hostname === 'riskguardian.onrender.com' ||
      url.pathname.startsWith('/api/')) {
    return; // let it fall through to network
  }

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  event.respondWith(
    fetch(request)
      .then(response => {
        // Cache successful responses
        if (response && response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, responseClone));
        }
        return response;
      })
      .catch(() => {
        // Network failed — try cache
        return caches.match(request).then(cached => {
          if (cached) return cached;
          // Fallback to index.html for navigation requests
          if (request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
      })
  );
});

// ── Push Notifications ────────────────────────────────────────────────────────
self.addEventListener('push', event => {
  if (!event.data) return;

  let data = {};
  try { data = event.data.json(); } catch { data = { title: 'RiskGuardian', body: event.data.text() }; }

  const options = {
    body:    data.body    || 'You have a new risk alert',
    icon:    data.icon    || '/icons/icon-192x192.png',
    badge:   data.badge   || '/icons/icon-72x72.png',
    tag:     data.tag     || 'riskguardian-alert',
    data:    data.url     || '/#/app',
    vibrate: [200, 100, 200],
    actions: [
      { action: 'open',    title: '📊 Open Dashboard' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
    requireInteraction: data.urgent || false,
  };

  event.waitUntil(
    self.registration.showNotification(data.title || '🛡️ RiskGuardian Alert', options)
  );
});

// ── Notification Click ────────────────────────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const url = event.notification.data || '/#/app';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // Focus existing window if open
      for (const client of clientList) {
        if (client.url.includes('getriskguardian.com') && 'focus' in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      // Open new window
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// ── Background Sync (future use) ──────────────────────────────────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'sync-trades') {
    console.log('[SW] Background sync: sync-trades');
  }
});

console.log('[SW] Service worker loaded ✅');