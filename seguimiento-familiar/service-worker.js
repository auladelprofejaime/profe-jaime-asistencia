const CACHE='seguimiento-familiar-v7-9';const FILES=['./','./index.html','./styles.css','./app.js','./manifest.webmanifest','./profe-jaime.png','./icon.png','../shared/data-contract.js','../shared/local-adapter.js','../shared/auth-utils.js'];self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES))));self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE).map(x=>caches.delete(x))))));self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));
self.addEventListener("push", event => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "El Aula del Profe Jaime";
  const options = {
    body: data.body || "Tienes una nueva notificación.",
    icon: "./icon.png",
    badge: "./icon.png",
    data: { target: data.target || "home" }
    };
  event.waitUntil(self.registration.showNotification(title, options));
  });
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    if (list.length) return list[0].focus();
    return clients.openWindow("./");
    }));
  });
