const CACHE='aula-profe-jaime-v4-0-0';
const LOCAL=[
 './',
 './index.html',
 './styles.css',
 './app-v40.js?v=400',
 './manifest.webmanifest',
 './icon.svg',
 './avatar-profe-jaime.png',
 './icon-profe-jaime.png'
];
const OPTIONAL=[
 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
 'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(LOCAL);
    await Promise.allSettled(OPTIONAL.map(url => cache.add(url)));
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;

  // index.html: buscar primero en internet para impedir retrocesos de versión.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request, {cache: 'no-store'});
        const cache = await caches.open(CACHE);
        await cache.put('./index.html', fresh.clone());
        return fresh;
      } catch (error) {
        return (await caches.match('./index.html')) || Response.error();
      }
    })());
    return;
  }

  // Archivos: red primero y caché como respaldo offline.
  event.respondWith((async () => {
    try {
      const fresh = await fetch(request, {cache: 'no-store'});
      if (fresh && fresh.ok) {
        const cache = await caches.open(CACHE);
        await cache.put(request, fresh.clone());
      }
      return fresh;
    } catch (error) {
      return (await caches.match(request)) || Response.error();
    }
  })());
});
