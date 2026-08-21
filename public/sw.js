const CACHE_NAME = 'elite-soccer-v2';

const STATIC_ASSETS = [
    '/',
    '/css/app.css',
    '/js/app.js',
    '/images/elite-soccer-logo.png',
    '/manifest.json'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(STATIC_ASSETS))
            .then(() => self.skipWaiting())
    );
});


self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name !== CACHE_NAME)
                        .map((name) => caches.delete(name))
                );
            })
            .then(() => self.clients.claim())
    );
});


self.addEventListener('fetch', (event) => {

    if (event.request.method !== 'GET') {
        return;
    }

    event.respondWith(

        caches.match(event.request)
            .then((cachedResponse) => {

                if (cachedResponse) {
                    return cachedResponse;
                }

                return fetch(event.request)
                    .then((networkResponse) => {

                        if (
                            !networkResponse ||
                            networkResponse.status !== 200 ||
                            networkResponse.type === 'opaque'
                        ) {
                            return networkResponse;
                        }

                        const responseToCache =
                            networkResponse.clone();

                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(
                                    event.request,
                                    responseToCache
                                );
                            });

                        return networkResponse;
                    })
                    .catch(() => {

                        // Si no hay internet y no existe caché,
                        // simplemente dejamos que falle normalmente.
                        return cachedResponse;
                    });

            })

    );
});