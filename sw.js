const CACHE_NAME = 'calc-native-v2';

// Instal·lació immediata
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Força l'activació sense esperar
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.add('/');
    })
  );
});

// Prendre el control immediatament
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Estratègia de xarxa primer, després caché (per a actualitzacions ràpides)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .catch(() => caches.match(event.request))
  );
});
