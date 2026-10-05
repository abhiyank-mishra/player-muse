// Firebase Messaging Service Worker
// This runs in the background and handles push notifications when the app is not in focus
//
// NOTE: Service workers cannot access process.env.
// The Firebase config is injected at build time via next.config.ts
// which generates /firebase-config.js from environment variables.

// Import the generated config from API route
importScripts('/api/firebase-config');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Force immediate activation of the service worker
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// self.__FIREBASE_CONFIG is set by /api/firebase-config
if (self.__FIREBASE_CONFIG && self.__FIREBASE_CONFIG.apiKey) {
  try {
    firebase.initializeApp(self.__FIREBASE_CONFIG);
    const messaging = firebase.messaging();

    // Handle background push notifications
    messaging.onBackgroundMessage((payload) => {
      console.log('[FCM SW] Background message received:', payload);

      const notificationTitle = payload.notification?.title || payload.data?.title || 'Muse Music';
      const notificationOptions = {
        body: payload.notification?.body || payload.data?.body || '',
        icon: '/android-chrome-192x192.png',
        badge: '/favicon-32x32.png',
        tag: payload.data?.tag || 'muse-notification',
        data: {
          url: payload.data?.url || '/',
          ...payload.data,
        },
        actions: [
          { action: 'open', title: 'Open Muse' },
        ],
        vibrate: [100, 50, 100],
        renotify: true,
      };

      self.registration.showNotification(notificationTitle, notificationOptions);
    });
  } catch (err) {
    console.error('[FCM SW] Firebase messaging initialization error:', err);
  }
}

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[FCM SW] Notification clicked:', event);
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If already open, focus that tab
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      // Otherwise open new tab
      return clients.openWindow(urlToOpen);
    })
  );
});
