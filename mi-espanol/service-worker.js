const CACHE='app-estudiante-v8-12-4';
const FILES=[
  './',
  './index.html',
  './styles.css',
  './app.js?v=8124',
  './manifest.webmanifest',
  './profe-jaime.png',
  './icon-app-estudiante-v821.png',
  '../shared/supabase-adapter.js?v=899'
];

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
  const request=event.request;
  const url=new URL(request.url);

  if(request.method!=='GET' || url.origin!==self.location.origin) return;

  if(request.mode==='navigate'){
    event.respondWith((async()=>{
      try{
        const response=await fetch(request,{cache:'no-store'});
        if(response && response.ok){
          const cache=await caches.open(CACHE);
          await cache.put('./index.html',response.clone());
        }
        return response;
      }catch(e){
        return (await caches.match('./index.html')) || new Response(
          '<!doctype html><html><body><h2>Mi Español</h2><p>No fue posible cargar la aplicación. Revisa tu conexión e intenta nuevamente.</p></body></html>',
          {headers:{'Content-Type':'text/html; charset=utf-8'}}
        );
      }
    })());
    return;
  }

  event.respondWith((async()=>{
    try{
      const response=await fetch(request,{cache:'no-store'});
      if(response && response.ok){
        const cache=await caches.open(CACHE);
        await cache.put(request,response.clone());
      }
      return response;
    }catch(e){
      return (await caches.match(request)) || Response.error();
    }
  })());
});

self.addEventListener('push',event=>{
  let data={title:'App estudiante',body:'Tienes una actualización.',target:'home'};
  try{
    if(event.data) data={...data,...event.data.json()};
  }catch(e){
    try{data.body=event.data.text()}catch(_){}
  }

  event.waitUntil(self.registration.showNotification(data.title,{
    body:data.body,
    icon:'./icon-app-estudiante-v821.png',
    badge:'./icon-app-estudiante-v821.png',
    tag:'push-'+(data.event||Date.now()),
    data:{target:data.target||'home'}
  }));
});

self.addEventListener('notificationclick',event=>{
  const target=event.notification?.data?.target||'home';
  event.notification.close();
  event.waitUntil((async()=>{
    const windows=await clients.matchAll({type:'window',includeUncontrolled:true});
    if(windows.length){
      const win=windows[0];
      await win.focus();
      try{win.postMessage({type:'OPEN_PUSH_TARGET',target})}catch(e){}
      return;
    }
    await clients.openWindow('./?push='+encodeURIComponent(target));
  })());
});
