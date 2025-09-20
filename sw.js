const CACHE_NAME = 'saga-tracker-cache-v2'; // Incrementa la versión del caché
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  '/images/icon-192.png',
  '/images/icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('Cache abierto y archivos añadidos');
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting(); // Fuerza al nuevo Service Worker a activarse
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName); // Elimina cachés antiguos
          }
        })
      );
    })
  );
  // Le dice al Service Worker que tome el control de la página
  // tan pronto como se active.
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // Usaremos la estrategia "Stale-While-Revalidate"
  event.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return cache.match(event.request).then(cachedResponse => {
        const fetchPromise = fetch(event.request).then(networkResponse => {
          // Si la petición a la red es exitosa, la guardamos en caché para la próxima vez
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        }).catch(() => {
          // Si la red falla, y no teníamos nada en caché, aquí podrías
          // devolver una respuesta genérica de "sin conexión".
          // Por ahora, si hay algo en caché, ya se habrá devuelto.
        });

        // Devolvemos la respuesta de la caché inmediatamente si existe,
        // mientras que la petición a la red se ejecuta en segundo plano.
        // Si no hay nada en caché, esperamos a la respuesta de la red.
        return cachedResponse || fetchPromise;
      });
    })
  );
});