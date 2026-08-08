const CACHE='seguimiento-familiar-v8-0';
const FILES=['./','./index.html','./styles.css','./app.js','./manifest.webmanifest','./profe-jaime.png','./icon.png','../shared/data-contract.js','../shared/supabase-adapter.js'];

self.addEventListener('install',event=>{
 self.skipWaiting();
 event.waitUntil((async()=>{
   const cache=await caches.open(CACHE);
   await Promise.allSettled(FILES.map(url=>cache.add(url)));
 })());
});

self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
   const keys=await caches.keys();
   await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));
   await self.clients.claim();
 })());
});

self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==self.location.origin)return;
 if(req.mode==='navigate'){
   event.respondWith((async()=>{
     try{
       const res=await fetch(req,{cache:'no-store'});
       if(res?.ok){const c=await caches.open(CACHE);await c.put('./index.html',res.clone())}
       return res;
     }catch(e){return (await caches.match('./index.html'))||Response.error()}
   })());
   return;
 }
 event.respondWith((async()=>{
   try{
     const res=await fetch(req,{cache:'no-store'});
     if(res?.ok){const c=await caches.open(CACHE);await c.put(req,res.clone())}
     return res;
   }catch(e){return (await caches.match(req))||Response.error()}
 })());
});
