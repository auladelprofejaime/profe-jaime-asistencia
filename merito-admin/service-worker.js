const CACHE="merito-admin-v1";
const ASSETS=[
 "./","./index.html","./app.js?v=1","./supabase-admin.js?v=1","./merit-staff-provision.js?v=1",
 "../styles.css?v=82380","../logo-merito-gabino-a-palma.jpeg",
 "../merit-movements-v82328.js?v=82328","../merit-corrections-v82329.js?v=82329",
 "../merit-ranking-v82330.js?v=82330","../merit-staff-period-v82334.js?v=82334",
 "../merit-tie-vote-v82325.js?v=82325","../merit-admin-v82335.js?v=82335","../merit-annual-v82335.js?v=82335"
];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith("merito-admin-")&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>{
 if(e.request.method!=="GET")return;
 const u=new URL(e.request.url);
 if(u.origin!==location.origin)return;
 e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy)).catch(()=>{});return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match("./index.html"))));
});