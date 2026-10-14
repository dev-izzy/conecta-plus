// Cacheia apenas recursos estaticos do proprio site. Dados do Supabase e
// scripts de terceiros continuam indo direto para a rede.
const CACHE_NAME = 'conecta-plus-v16';
const APP_SHELL = [
    './index.html',
    './amigos.html',
    './usuario.html',
    './css/style.css',
    './css/amigos.css',
    './js/storage.js',
    './js/loading.js',
    './js/backend-config.js',
    './js/backend.js',
    './js/theme.js',
    './js/mural.js',
    './js/amigos.js',
    './js/usuario.js',
    './js/pwa.js',
    './manifest.json',
    './img/download.jpg',
    './ico/download.ico'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(APP_SHELL))
            .catch(() => {})
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(names =>
            Promise.all(names.filter(name => name !== CACHE_NAME).map(name => caches.delete(name)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    const isSameOrigin = url.origin === self.location.origin;
    const isStaticAsset = request.mode === 'navigate'
        || ['script', 'style', 'image', 'font', 'manifest'].includes(request.destination);
    if (!isSameOrigin || !isStaticAsset) return;

    event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);
        const cacheKey = request.mode === 'navigate'
            ? new Request(`${url.origin}${url.pathname}`)
            : request;
        const cached = await cache.match(cacheKey);

        const networkUpdate = fetch(request).then(async response => {
            if (response.ok && response.type === 'basic') {
                await cache.put(cacheKey, response.clone());
            }
            return response;
        }).catch(() => null);

        if (cached) {
            event.waitUntil(networkUpdate.then(() => {}));
            return cached;
        }

        const response = await networkUpdate;
        if (response) return response;
        if (request.mode === 'navigate') {
            return (await cache.match('./index.html')) || Response.error();
        }
        return Response.error();
    })());
});
