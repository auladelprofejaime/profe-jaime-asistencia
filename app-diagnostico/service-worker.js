const CACHE="diagnostico-v0110";
const ASSETS=["./","index.html","styles.css","app-v0110.js","manifest.webmanifest","icon-192.png","icon-512.png","icon-original.jpg"];

self.addEventListener("install",event=>{
  event.waitUntil(
    caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())
  );
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);
  const shell=url.pathname.endsWith("/")||
              url.pathname.endsWith("/index.html")||
              url.pathname.endsWith("/app-v0110.js");
  if(shell){
    event.respondWith(
      fetch(event.request,{cache:"no-store"}).catch(()=>caches.match(event.request))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then(cached=>cached||fetch(event.request))
  );
});
