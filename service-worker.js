// ============================================================================
// Service worker — NETWORK FIRST untuk file aplikasi.
//
// Versi lama memakai cache-first: sekali index.html/app.js/style.css masuk
// cache, file itu dipakai selamanya. Akibatnya HP bisa tertinggal versi lama
// (atau lebih buruk: campur — HTML baru + JS lama) sementara browser desktop
// yang di-hard refresh sudah dapat versi baru.
//
// Sekarang: selalu ambil dari jaringan dulu, cache hanya dipakai kalau offline.
// Jadi aplikasi tidak pernah "nyangkut" di versi lama, tapi tetap bisa dibuka
// tanpa internet.
// ============================================================================
const CACHE_NAME = 'sales-dashboard-v17';
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
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Data & library eksternal diurus aplikasi sendiri, jangan disentuh
  if (url.hostname.includes('script.google.com') ||
      url.hostname.includes('googleusercontent.com') ||
      url.hostname.includes('cdn.jsdelivr.net')) return;
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    // cache: 'reload' -> lewati juga cache HTTP browser, supaya benar-benar versi terbaru
    fetch(url.href, { cache: 'reload', credentials: 'same-origin' })
      .then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, clone)).catch(() => {});
        }
        return res;
      })
      // Offline / jaringan gagal -> pakai cache terakhir
      .catch(() => caches.match(req).then(cached => {
        if (cached) return cached;
        if (req.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      }))
  );
});
