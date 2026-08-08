const CACHE='mi-espanol-v7-9';const FILES=['./','./index.html','./styles.css','./app.js','./manifest.webmanifest','./profe-jaime.png','./icon.png','../shared/data-contract.js','../shared/local-adapter.js','../shared/auth-utils.js'];self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES))));self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE).map(x=>caches.delete(x))))));self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));

self.addEventListener('push',event=>{
  let data={title:'Mi Español',body:'Tienes una actualización.',target:'home'};
  try{if(event.data)data={...data,...event.data.json()}}catch(_){try{data.body=event.data.text()}catch(__){}}
  event.waitUntil(self.registration.showNotification(data.title,{
    body:data.body,
    icon:'./icon.png',
    badge:'./icon.png',
    tag:'push-'+(data.event||Date.now()),
    data:{target:data.target||'home'}
  }));
});
self.addEventListener('notificationclick',event=>{
  const target=event.notification?.data?.target||'home';
  event.notification.close();
  event.waitUntil((async()=>{
    const wins=await clients.matchAll({type:'window',includeUncontrolled:true});
    if(wins.length){const w=wins[0];await w.focus();try{w.postMessage({type:'OPEN_PUSH_TARGET',target})}catch(_){}return}
    await clients.openWindow('./?push='+encodeURIComponent(target));
  })());
});
