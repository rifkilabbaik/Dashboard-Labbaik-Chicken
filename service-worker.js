const CACHE_NAME = 'sales-dashboard-v12';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/config.js',
  './js/sheets.js',
  './js/upload.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(APP_SHELL)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.hostname.includes('script.google.com') || url.hostname.includes('googleusercontent.com') || url.hostname.includes('cdn.jsdelivr.net')) return;
  e.respondWith(caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
    if (res && res.status === 200 && e.request.method === 'GET') {
      const clone = res.clone();
      caches.open(CACHE_NAME).then(c => c.put(e.request, clone)).catch(() => {});
    }
    return res;
  }).catch(() => cached)));
});
