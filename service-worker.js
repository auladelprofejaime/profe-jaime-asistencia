const CACHE='app-docente-v8-14-1';
const LOCAL=[
 './','./index.html','./styles.css','./app-v8162.js?v=8162',
 './manifest.webmanifest','./icon.svg','./avatar-profe-jaime.png','./icon-app-docente-v821.png',
 './shared/supabase-teacher.js?v=790'
];
const OPTIONAL=[
 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
 'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js'
];

self.addEventListener('install',e=>{
  self.skipWaiting();
  e.waitUntil((async()=>{
    const c=await caches.open(CACHE);
    await Promise.allSettled(LOCAL.map(u=>c.add(u)));
    await Promise.allSettled(OPTIONAL.map(u=>c.add(u)));
  })());
});

self.addEventListener('activate',e=>e.waitUntil((async()=>{
  const ks=await caches.keys();
  await Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)));
  await self.clients.claim();
})()));

self.addEventListener('fetch',e=>{
  const r=e.request;
  const u=new URL(r.url);

  // Supabase, APIs, POST/PUT/PATCH/DELETE and other external requests
  // must go directly to the network.
  if(r.method!=='GET' || u.origin!==self.location.origin){
    return;
  }

  if(r.mode==='navigate'){
    e.respondWith((async()=>{
      try{
        const f=await fetch(r,{cache:'no-store'});
        const c=await caches.open(CACHE);
        if(f && f.ok) await c.put('./index.html',f.clone());
        return f;
      }catch(_){
        return await caches.match('./index.html') || Response.error();
      }
    })());
    return;
  }

  e.respondWith((async()=>{
    try{
      const f=await fetch(r,{cache:'no-store'});
      if(f && f.ok){
        const c=await caches.open(CACHE);
        await c.put(r,f.clone());
      }
      return f;
    }catch(_){
      return await caches.match(r) || Response.error();
    }
  })());
});


self.addEventListener('push',event=>{
  let data={title:'App docente',body:'Tienes una actualización.',target:'home'};
  try{if(event.data)data={...data,...event.data.json()}}catch(_){try{data.body=event.data.text()}catch(__){}}
  event.waitUntil(self.registration.showNotification(data.title,{
    body:data.body,
    icon:'./icon-app-docente-v821.png',
    badge:'./icon-app-docente-v821.png',
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
