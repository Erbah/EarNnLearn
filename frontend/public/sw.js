// A simple service worker to satisfy PWA install requirements.
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Let the browser do its default thing
  // We can add offline caching later if needed
  event.respondWith(fetch(event.request));
});
