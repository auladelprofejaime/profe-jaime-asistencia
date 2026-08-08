const CACHE='aula-profe-jaime-v7-8';
const LOCAL=[
 './','./index.html','./styles.css','./app-v78.js?v=780',
 './manifest.webmanifest','./icon.svg','./avatar-profe-jaime.png','./icon-profe-jaime.png',
 './shared/supabase-teacher.js?v=780'
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

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const wins=await clients.matchAll({type:'window',includeUncontrolled:true});
    if(wins.length){await wins[0].focus();return}
    await clients.openWindow('./');
  })());
});
