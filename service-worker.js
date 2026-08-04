const CACHE='aula-profe-jaime-v5-7-0';
const LOCAL=[
 './','./index.html','./styles.css','./app-v57.js?v=570',
 './manifest.webmanifest','./icon.svg','./avatar-profe-jaime.png','./icon-profe-jaime.png'
];
const OPTIONAL=[
 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
 'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js'
];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil((async()=>{const c=await caches.open(CACHE);await c.addAll(LOCAL);await Promise.allSettled(OPTIONAL.map(u=>c.add(u)))})())});
self.addEventListener('activate',e=>e.waitUntil((async()=>{const ks=await caches.keys();await Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)));await self.clients.claim()})()));
self.addEventListener('fetch',e=>{const r=e.request;if(r.mode==='navigate'){e.respondWith((async()=>{try{const f=await fetch(r,{cache:'no-store'}),c=await caches.open(CACHE);await c.put('./index.html',f.clone());return f}catch(_){return await caches.match('./index.html')||Response.error()}})());return}e.respondWith((async()=>{try{const f=await fetch(r,{cache:'no-store'});if(f?.ok){const c=await caches.open(CACHE);await c.put(r,f.clone())}return f}catch(_){return await caches.match(r)||Response.error()}})())});
