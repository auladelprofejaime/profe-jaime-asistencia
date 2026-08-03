const CACHE='profe-jaime-v3-5-0';
const LOCAL=['./','index.html','styles.css','app-v35.js?v=340','manifest.webmanifest','icon.svg','avatar-profe-jaime.png','icon-profe-jaime.png'];
const OPTIONAL=[
 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
 'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js'
];
self.addEventListener('install',event=>{
 self.skipWaiting();
 event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  await cache.addAll(LOCAL);
  await Promise.allSettled(OPTIONAL.map(url=>cache.add(url)));
 })());
});
self.addEventListener('activate',event=>event.waitUntil(
 caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())
));
self.addEventListener('fetch',event=>{
 event.respondWith((async()=>{
  try{
   const response=await fetch(event.request);
   if(response && response.ok){
    const cache=await caches.open(CACHE);
    cache.put(event.request,response.clone());
   }
   return response;
  }catch(error){
   return (await caches.match(event.request)) || (await caches.match('./index.html'));
  }
 })());
});
