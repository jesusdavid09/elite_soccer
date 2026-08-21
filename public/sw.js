// ========================================
// ELITE SOCCER - SERVICE WORKER
// ========================================

const CACHE_NAME = 'elite-soccer-v3';

const STATIC_ASSETS = [
    '/',
    '/css/app.css',
    '/js/app.js',
    '/images/elite-soccer-logo.png',
    '/manifest.json'
];


// ========================================
// INSTALL
// ========================================

self.addEventListener('install', (event) => {

    event.waitUntil(

        caches.open(CACHE_NAME)
            .then((cache) => {

                return cache.addAll(STATIC_ASSETS);

            })
            .then(() => {

                // Activar inmediatamente
                return self.skipWaiting();

            })

    );

});


// ========================================
// ACTIVATE
// ========================================

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
            .then(() => {

                // Tomar control inmediatamente
                return self.clients.claim();

            })

    );

});


// ========================================
// FETCH
// ========================================

self.addEventListener('fetch', (event) => {

    if (event.request.method !== 'GET') {
        return;
    }


    const requestURL = new URL(event.request.url);


    // ========================================
    // ARCHIVOS DE DESARROLLO
    // CSS / JS
    //
    // SIEMPRE INTENTAR RED
    // ========================================

    if (
        requestURL.pathname.endsWith('.css') ||
        requestURL.pathname.endsWith('.js')
    ) {

        event.respondWith(

            fetch(event.request)
                .then((networkResponse) => {

                    if (
                        networkResponse &&
                        networkResponse.status === 200
                    ) {

                        const responseToCache =
                            networkResponse.clone();

                        caches.open(CACHE_NAME)
                            .then((cache) => {

                                cache.put(
                                    event.request,
                                    responseToCache
                                );

                            });

                    }

                    return networkResponse;

                })
                .catch(() => {

                    // Si no hay internet,
                    // utilizar la versión guardada.

                    return caches.match(event.request);

                })

        );

        return;
    }


    // ========================================
    // HTML
    //
    // PRIMERO RED
    // DESPUÉS CACHÉ
    // ========================================

    if (
        event.request.mode === 'navigate' ||
        requestURL.pathname.endsWith('.html') ||
        requestURL.pathname === '/'
    ) {

        event.respondWith(

            fetch(event.request)
                .then((networkResponse) => {

                    if (
                        networkResponse &&
                        networkResponse.status === 200
                    ) {

                        const responseToCache =
                            networkResponse.clone();

                        caches.open(CACHE_NAME)
                            .then((cache) => {

                                cache.put(
                                    event.request,
                                    responseToCache
                                );

                            });

                    }

                    return networkResponse;

                })
                .catch(() => {

                    return caches.match(event.request);

                })

        );

        return;
    }


    // ========================================
    // IMÁGENES Y OTROS RECURSOS
    //
    // CACHE FIRST
    // ========================================

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

                        return cachedResponse;

                    });

            })

    );

});