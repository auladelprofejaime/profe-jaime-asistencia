const CACHE='mi-espanol-v7-8';const FILES=['./','./index.html','./styles.css','./app.js','./manifest.webmanifest','./profe-jaime.png','./icon.png','../shared/data-contract.js','../shared/local-adapter.js','../shared/auth-utils.js'];self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES))));self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE).map(x=>caches.delete(x))))));self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const wins=await clients.matchAll({type:'window',includeUncontrolled:true});
    if(wins.length){await wins[0].focus();return}
    await clients.openWindow('./');
  })());
});
