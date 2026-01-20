// sw.js
const CACHE_NAME = 'weep-v1';
const urlsToCache = [
  '/',
  '/index.html',
  // Imágenes importantes (agregá las que más uses)
  'https://i.postimg.cc/7PpF3zRP/Chat-GPT-Image-Jan-3-2026-01-27-57-AM-(1).png', // logo
  'https://i.postimg.cc/vBY0wJNq/18611-(1).jpg', // carrito
  'https://i.postimg.cc/ZnBXJHJC/web-app-manifest-192x192.png', // icono
  'https://i.postimg.cc/V6N3V1py/web-app-manifest-512x512.png',
  // Agregá más imágenes de categorías o platos si querés offline
  'https://i.postimg.cc/wxrb5Vt2/hamburguesa-sencilla.jpg',
  'https://i.postimg.cc/4nC5DWt0/pizza-Mh3H4eany-BKEs-Stv1Ycl-PWTf9OUq-Ii.jpg',
  // etc...
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cacheando archivos iniciales');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Si está en cache → lo devuelve
        if (response) {
          return response;
        }
        // Sino → va a la red y cachea la respuesta para la próxima
        return fetch(event.request).then(networkResponse => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }
          // Clonamos la respuesta porque se puede usar solo una vez
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });
          return networkResponse;
        });
      })
  );
});
