// Service Worker for Push Notifications
// This service worker handles push notification events and app focus

// Install event - cache resources when service worker is installed
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  
  // Skip waiting to activate immediately
  self.skipWaiting();
});

// Activate event - clean up old caches when service worker is activated
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  
  // Take control of all pages immediately
  event.waitUntil(self.clients.claim());
});

// Handle push events (for future implementation with push messaging)
self.addEventListener('push', (event) => {
  console.log('Push event received:', event);
  
  // For now, we're using in-app notifications instead of push messages
  // This could be extended in the future to handle server-sent push messages
});

// Handle notification click events
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  
  event.notification.close();

  // Focus or open the app window
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // If app is already open, focus it
      for (const client of clients) {
        if (client.url === self.location.origin && 'focus' in client) {
          return client.focus();
        }
      }
      
      // If app is not open, open it
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});

// Handle notification close events
self.addEventListener('notificationclose', (event) => {
  console.log('Notification closed:', event);
});
