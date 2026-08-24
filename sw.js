// Service worker que s'autodestrueix per netejar caché antiga
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
// No fa caché de res — sempre carrega la versió més nova
self.addEventListener('fetch', e => e.respondWith(fetch(e.request)));
