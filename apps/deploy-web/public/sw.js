self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(retireServiceWorker());
});

/** Browsers that installed the former offline worker re-check this URL, so it must stay served until they have all dropped it. */
async function retireServiceWorker() {
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
  await self.clients.claim();
  await self.registration.unregister();
}
