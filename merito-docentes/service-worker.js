const C='merito-docentes-v1-66-bounded-start';
const A=['./','index.html','styles.css?v=32','app.js?v=66','logo-merito.jpeg','icon-192.png','icon-512.png','manifest.webmanifest','version.json','layout-v52.css?v=62'];
async function boundedFetch(request){
 const controller=new AbortController();let timer;
 try{return await Promise.race([fetch(request,{cache:'no-store',signal:controller.signal}),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('network_timeout'))},7000)})])}finally{clearTimeout(timer)}
}
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil((async()=>{
 const c=await caches.open(C);
 await Promise.allSettled(A.map(async path=>{const r=await boundedFetch(new Request(new URL(path,self.registration.scope)));if(r.ok)await c.put(new URL(path,self.registration.scope).href,r)}));
})())});
self.addEventListener('activate',e=>e.waitUntil((async()=>{
 const c=await caches.open(C);
 if(await c.match(new URL('index.html',self.registration.scope).href)&&await c.match(new URL('app.js?v=66',self.registration.scope).href)){
  const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith('merito-docentes-')&&k!==C).map(k=>caches.delete(k)));
 }
 await self.clients.claim();
})()));
self.addEventListener('fetch',e=>{
 const request=e.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin)return;
 e.respondWith((async()=>{
  try{
   const r=await boundedFetch(request);
   if(!r.ok)throw new Error('HTTP '+r.status);
   e.waitUntil(caches.open(C).then(c=>c.put(request,r.clone())).catch(()=>{}));
   return r;
  }catch(_){
   const cached=await caches.match(request,{ignoreSearch:true});
   if(cached)return cached;
   if(request.mode==='navigate'){
    const page=await caches.match(new URL('index.html',self.registration.scope).href,{ignoreSearch:true});
    if(page)return page;
    return new Response('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mérito Docentes</title><body style="font-family:system-ui;padding:24px"><h1>No se pudo cargar Mérito</h1><p>Revisa la conexión y vuelve a intentar.</p><button onclick="location.reload()">Volver a intentar</button></body></html>',{headers:{'Content-Type':'text/html; charset=utf-8'},status:503});
   }
   return Response.error();
  }
 })());
});
self.addEventListener('push',e=>{let d={};try{d=e.data?e.data.json():{}}catch{};if(!['merit_period_started','merit_vote_open','merit_results_published'].includes(d.event))return;const opts={body:d.body||'',icon:'icon-192.png',badge:'icon-192.png',data:{url:d.url||'./',target:d.target||''},tag:'merit-'+d.event+'-'+(d.created||'')};e.waitUntil(self.registration.showNotification(d.title||'Mérito Gabino A. Palma',opts))});
self.addEventListener('notificationclick',e=>{e.notification.close();const url=e.notification.data?.url||'./';e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(ws=>{for(const w of ws){if('focus'in w){w.navigate(url);return w.focus()}}return clients.openWindow?clients.openWindow(url):null}))});
