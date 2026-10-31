// Service worker: guarda os arquivos do app para abrir offline. Aumente VERSAO ao publicar uma atualizacao.
const VERSAO = 'tl-otimizador-v9';
const ARQUIVOS = ['./', './img/muu-chan.webp','./index.html', './css/app.css', './js/engine.js', './js/app.js', './js/ocr.js', './manifest.webmanifest', './icons/favicon-64.png','./icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', e => { e.waitUntil(caches.open(VERSAO).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // Rede primeiro (sempre pega a versao nova quando online); cache so quando estiver offline.
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(res => {
    if (res && res.ok && (res.type === 'basic' || /fonts\.(googleapis|gstatic)\.com/.test(e.request.url))) { const copia = res.clone(); caches.open(VERSAO).then(c => c.put(e.request, copia)); }
    return res;
  }).catch(() => caches.match(e.request).then(hit => hit || caches.match('./index.html'))));
});
