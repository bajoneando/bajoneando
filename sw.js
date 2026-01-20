// sw.js
const CACHE_NAME = 'weep-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/styles.css',          // cambia por tus archivos reales
  '/script.js',           // si tenés JS
  '/icon-192x192.png',
  '/icon-512x512.png'
  // Agregá acá todas las páginas, CSS, JS e imágenes importantes
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Devuelve del cache si existe, sino va a la red
        return response || fetch(event.request);
      })
  );
});
