const CACHE='app-padres-v8-12-0';
const FILES=['./','./index.html','./styles.css','./app.js','./manifest.webmanifest','./profe-jaime.png','./icon-app-padres-v821.png','../shared/data-contract.js','../shared/supabase-adapter.js'];

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


self.addEventListener('push',event=>{
 let data={title:'Seguimiento Familiar',body:'Hay una actualización escolar.',target:'home'};
 try{if(event.data)data={...data,...event.data.json()}}catch(e){try{data.body=event.data.text()}catch(_){}}
 event.waitUntil(self.registration.showNotification(data.title,{
   body:data.body,
   icon:'./icon-app-padres-v821.png',
   badge:'./icon-app-padres-v821.png',
   tag:'family-'+(data.event||Date.now()),
   data:{target:data.target||'home'}
 }));
});

self.addEventListener('notificationclick',event=>{
 const target=event.notification?.data?.target||'home';
 event.notification.close();
 event.waitUntil((async()=>{
   const wins=await clients.matchAll({type:'window',includeUncontrolled:true});
   if(wins.length){
     const win=wins[0];await win.focus();
     try{win.postMessage({type:'OPEN_PUSH_TARGET',target})}catch(e){}
     return;
   }
   await clients.openWindow('./?push='+encodeURIComponent(target));
 })());
});
