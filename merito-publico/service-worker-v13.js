const C='merito-publico-v1-3';
const A=['./','index.html','styles.css','app-v13.js','logo-merito.jpeg','icon-192.png','icon-512.png','manifest.webmanifest'];
self.addEventListener('install',e=>e.waitUntil(
  caches.open(C).then(c=>c.addAll(A)).then(()=>self.skipWaiting())
));
self.addEventListener('activate',e=>e.waitUntil(
  caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim())
));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  const u=new URL(e.request.url);
  const isShell = u.pathname.endsWith('/') || u.pathname.endsWith('/index.html') || u.pathname.endsWith('/app-v13.js');
  if(isShell){
    e.respondWith(
      fetch(e.request,{cache:'no-store'}).catch(()=>caches.match(e.request))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached=>cached||fetch(e.request).then(resp=>{
      const copy=resp.clone();
      caches.open(C).then(c=>c.put(e.request,copy));
      return resp;
    }))
  );
});
