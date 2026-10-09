const fs=require('fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
(async()=>{
 const dom=new JSDOM(fs.readFileSync('merit-confirm/index.html','utf8'),{url:'https://test.invalid/merito-docentes/',runScripts:'outside-only'}),w=dom.window,d=w.document;
 w.localStorage.setItem('meritInstallationTokenV1','token-cached');
 w.localStorage.setItem('meritStaffCacheV16',JSON.stringify({staff_code:'700036',display_name:'Karen',confirmed:true,is_placeholder:false,subject_area:'Inglés'}));
 w.fetch=()=>new Promise(()=>{});w.setInterval=()=>0;w.setTimeout=()=>0;w.clearTimeout=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};
 for(const el of d.querySelectorAll('dialog')){el.showModal=function(){this.setAttribute('open','')};el.close=function(){this.removeAttribute('open')}};
 w.eval(fs.readFileSync('merit-confirm/app.js','utf8'));
 assert.equal(d.getElementById('capture').classList.contains('hidden'),false);
 assert.equal(d.getElementById('staffName').textContent,'Karen');
 assert.equal(w.__meritStartupComplete,true);
 dom.window.close();

 const handlers={},scope='https://test.invalid/merito-docentes/',page=new Response('CACHED APP'),cache=new Map([[scope+'index.html',page],[scope,page.clone()]]);
 const context={URL,Request,Response,AbortController,Promise,setTimeout:(fn)=>0,clearTimeout:()=>{},fetch:()=>new Promise(()=>{}),self:{location:{origin:'https://test.invalid'},registration:{scope},skipWaiting:async()=>{},clients:{claim:async()=>{},matchAll:async()=>[]},addEventListener:(n,f)=>handlers[n]=f},caches:{open:async()=>({match:async u=>cache.get(typeof u==='string'?u:u.url),put:async(u,r)=>cache.set(typeof u==='string'?u:u.url,r)}),match:async(u,o)=>{const url=typeof u==='string'?u:u.url;if(o?.ignoreSearch){const bare=url.split('?')[0];for(const [k,v] of cache)if(k.split('?')[0]===bare)return v}return cache.get(url)},keys:async()=>[],delete:async()=>true}};
 vm.runInNewContext(fs.readFileSync('merit-confirm/service-worker.js','utf8'),context);
 let response;handlers.fetch({request:{url:scope+'?cellular=1',method:'GET',mode:'navigate'},respondWith:p=>response=p,waitUntil:()=>{}});
 assert.equal(await (await response).text(),'CACHED APP');
 console.log('PASS cellular startup uses the verified cached session immediately; cached app shell opens without waiting for a stalled network.');
})().catch(e=>{console.error(e);process.exitCode=1});

