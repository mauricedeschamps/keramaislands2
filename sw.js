// sw.js - サービスワーカー（オフラインキャッシュ + インストール対応）
const CACHE_NAME = 'kerama-pwa-v1';
const urlsToCache = [
  '/',
  'index.html',
  'manifest.jdon',
  'icons/icon-192.jpg',
  'icons/icon-512.jpg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('キャッシュを開きました');
        return cache.addAll(urlsToCache);
      })
      .catch(err => console.warn('キャッシュ追加失敗:', err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('古いキャッシュを削除:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);

  if (!event.request.url.startsWith('http')) return;

  const isStaticAsset = /\.(jpg|jpeg|png|gif|svg|webp|ico|css|js)$/i.test(requestUrl.pathname);
  const isHtml = requestUrl.pathname === '/' || requestUrl.pathname.endsWith('.html');

  if (isHtml) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then(cached => {
            if (cached) return cached;
            return caches.match('./index.html');
          });
        })
    );
    return;
  }

  if (isStaticAsset) {
    event.respondWith(
      caches.match(event.request)
        .then(cached => {
          if (cached) {
            fetch(event.request).then(response => {
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, response));
            });
            return cached;
          }
          return fetch(event.request).then(response => {
            if (response.status === 200) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
            }
            return response;
          });
        })
    );
    return;
  }

  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});