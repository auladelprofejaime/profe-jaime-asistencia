const CACHE="merito-admin-v3";
const ASSETS=[
 "./","./index.html","./styles.css?v=2","./app.js?v=2","./supabase-admin.js?v=1",
 "./merit-staff-provision.js?v=2","./merit-movements.js?v=2","./merit-corrections.js?v=2",
 "./merit-ranking.js?v=2","./merit-staff-period.js?v=2","./merit-tie-vote.js?v=2",
 "./merit-admin.js?v=2","./merit-annual.js?v=2","./manifest.webmanifest?v=3",
 "./icon-192.png","./icon-512.png"
];
self.addEventListener("install",event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith("merito-admin-")&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch",event=>{
 if(event.request.method!=="GET")return;
 const url=new URL(event.request.url);
 if(url.origin!==location.origin)return;
 const shell=url.pathname.endsWith("/")||url.pathname.endsWith("/index.html")||url.pathname.includes("/merito-admin/");
 if(shell){
  event.respondWith(fetch(event.request,{cache:"no-store"}).catch(()=>caches.match(event.request).then(r=>r||caches.match("./index.html"))));
  return;
 }
 event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
});