// Service Worker — JMS Gestão Empresarial (cache mínimo para PWA)
const CACHE_NAME = 'jms-gestao-v1';
const CORE_FILES = [
  './sistema-gestao.html',
  './manifest.json'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(CORE_FILES)).catch(()=>{}));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
  );
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  // Network first, cache fallback (mantém atualizado)
  if(e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(r => {
        if(r && r.status === 200 && (e.request.url.endsWith('.html') || e.request.url.endsWith('.json'))){
          const copy = r.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, copy));
        }
        return r;
      })
      .catch(() => caches.match(e.request))
  );
});
