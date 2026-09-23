(function(){
const URL="https://xqeyyjakmeiaahecfdmc.supabase.co",KEY="sb_publishable_GY2NGAigumnZw3rIJKU7LA_a2qigAEA",SESSION_KEY='profeJaimeSupabaseTeacherSession';
let session=null,refreshPromise=null,authRefreshBlockedUntil=0;
const SESSION_CHANNEL='profeJaimeSupabaseTeacherSessionChannel';
let sessionChannel=null;
try{
  sessionChannel=new BroadcastChannel(SESSION_CHANNEL);
  sessionChannel.onmessage=e=>{
    const incoming=e?.data?.session;
    if(Number(e?.data?.auth_pause_until||0)>Date.now()){
      authRefreshBlockedUntil=Math.max(authRefreshBlockedUntil,Number(e.data.auth_pause_until));
    }
    if(incoming?.access_token&&incoming?.refresh_token){
      session=incoming;
      authRefreshBlockedUntil=0;
      try{
        const remember=!!localStorage.getItem(SESSION_KEY);
        if(remember)localStorage.setItem(SESSION_KEY,JSON.stringify(session));
        else sessionStorage.setItem(SESSION_KEY,JSON.stringify(session));
      }catch(_){}
    }
  };
}catch(_){}
let apiActive=0,apiLastStart=0,apiCooldownUntil=0;
const apiQueue=[];
const API_MAX_CONCURRENT=2,API_MIN_GAP=180;

function apiSleep(ms){return new Promise(r=>setTimeout(r,ms))}
function apiPump(){
 if(!apiQueue.length||apiActive>=API_MAX_CONCURRENT)return;
 const now=Date.now();
 const wait=Math.max(0,apiCooldownUntil-now,API_MIN_GAP-(now-apiLastStart));
 if(wait>0){setTimeout(apiPump,wait);return}
 const job=apiQueue.shift();apiActive++;apiLastStart=Date.now();
 Promise.resolve().then(job.task).then(job.resolve,job.reject).finally(()=>{apiActive--;apiPump()});
 if(apiActive<API_MAX_CONCURRENT)setTimeout(apiPump,API_MIN_GAP);
}
function apiSchedule(task){
 return new Promise((resolve,reject)=>{apiQueue.push({task,resolve,reject});apiPump()});
}
function apiCooldown(ms=2500){
 apiCooldownUntil=Math.max(apiCooldownUntil,Date.now()+ms);
}
async function apiFetch(factory,{retry429=true}={}){
 return apiSchedule(async()=>{
   let r=await factory();
   if(r?.status===429&&retry429){
     const retryAfter=Number(r.headers?.get?.('retry-after')||0);
     const wait=retryAfter>0?retryAfter*1000:2500;
     apiCooldown(wait);
     await apiSleep(wait);
     r=await factory();
   }
   return r;
 });
}
function headers(token,extra={}){return {apikey:KEY,Authorization:`Bearer ${token||KEY}`,...extra}}
async function parse(r){let t=await r.text(),d=null;try{d=t?JSON.parse(t):null}catch{d=t}if(!r.ok)throw new Error(d?.message||d?.error_description||d?.hint||`Supabase ${r.status}`);return d}
async function refresh(){
 if(refreshPromise)return refreshPromise;
 if(!session?.refresh_token)return null;
 if(Date.now()<authRefreshBlockedUntil){
   throw new Error('Sesión de Supabase temporalmente bloqueada para evitar reintentos. Inicia sesión nuevamente una sola vez.');
 }

 const doRefresh=async()=>{
   // Antes de usar el refresh token, releer lo guardado: otra pestaña pudo renovarlo ya.
   let stored=null;
   try{stored=JSON.parse(localStorage.getItem(SESSION_KEY)||sessionStorage.getItem(SESSION_KEY)||'null')}catch(_){}
   const now=Date.now();
   if(stored?.access_token&&stored?.refresh_token){
     const storedExp=(stored.expires_at?stored.expires_at*1000:(stored.saved_at||0)+(stored.expires_in||3600)*1000);
     if(storedExp>now+120000){
       session=stored;
       return session;
     }
     if(session?.refresh_token&&stored.refresh_token!==session.refresh_token){
       session=stored;
       return session;
     }
   }

   const refreshToken=session?.refresh_token;
   if(!refreshToken)return null;
   const r=await fetch(URL+'/auth/v1/token?grant_type=refresh_token',{
     method:'POST',
     headers:{apikey:KEY,'Content-Type':'application/json'},
     body:JSON.stringify({refresh_token:refreshToken})
   });
   if(!r.ok){
     let raw='',data=null;
     try{raw=await r.text();data=raw?JSON.parse(raw):null}catch(_){data=null}
     const code=String(data?.error_code||data?.code||data?.error||'');
     if(r.status===429||code==='over_request_rate_limit'){
       authRefreshBlockedUntil=Date.now()+60000;
       try{sessionChannel?.postMessage({auth_pause_until:authRefreshBlockedUntil})}catch(_){}
       throw new Error('Supabase está limitando temporalmente la renovación de sesión. Espera un minuto o inicia sesión nuevamente.');
     }
     if(r.status===400&&(code==='refresh_token_already_used'||/already used/i.test(raw))){
       authRefreshBlockedUntil=Date.now()+5*60*1000;
       try{sessionChannel?.postMessage({auth_pause_until:authRefreshBlockedUntil})}catch(_){}
       throw new Error('La sesión de Supabase necesita renovarse. Inicia sesión nuevamente una sola vez.');
     }
     throw new Error(data?.message||data?.error_description||data?.hint||('Supabase '+r.status));
   }
   const next=await r.json();
   session=next;session.saved_at=Date.now();
   const remember=!!localStorage.getItem(SESSION_KEY);
   if(remember)localStorage.setItem(SESSION_KEY,JSON.stringify(session));
   else sessionStorage.setItem(SESSION_KEY,JSON.stringify(session));
   try{sessionChannel?.postMessage({session})}catch(_){}
   return session;
 };

 refreshPromise=(async()=>{
   try{
     // Web Locks serializa la renovación entre pestañas/ventanas del mismo navegador.
     if(navigator?.locks?.request){
       return await navigator.locks.request('profe-jaime-supabase-refresh',{mode:'exclusive'},doRefresh);
     }

     // Respaldo si Web Locks no existe: espera breve y vuelve a leer almacenamiento.
     await new Promise(r=>setTimeout(r,120+Math.random()*180));
     return await doRefresh();
   }finally{
     refreshPromise=null;
   }
 })();
 return refreshPromise;
}
async function token(){
 if(!session){try{session=JSON.parse(localStorage.getItem(SESSION_KEY)||sessionStorage.getItem(SESSION_KEY)||'null')}catch{}}
 if(!session)return null;

 // Siempre tomar la sesión más nueva del almacenamiento antes de decidir renovar.
 try{
   const stored=JSON.parse(localStorage.getItem(SESSION_KEY)||sessionStorage.getItem(SESSION_KEY)||'null');
   if(stored?.access_token&&stored?.refresh_token){
     const currentSaved=Number(session?.saved_at||0),storedSaved=Number(stored.saved_at||0);
     if(storedSaved>currentSaved)session=stored;
   }
 }catch(_){}

 const exp=(session.expires_at?session.expires_at*1000:(session.saved_at||0)+(session.expires_in||3600)*1000);
 // No renovar de forma preventiva: usar el access token hasta que realmente venza.
 // Esto evita que varias pestañas despierten a la vez antes de tiempo.
 if(Date.now()>exp)await refresh();
 return session?.access_token||null;
}
async function login(email,password,remember=true){
 const r=await fetch(URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify({email,password})});
 session=await parse(r);session.saved_at=Date.now();
 if(remember)localStorage.setItem(SESSION_KEY,JSON.stringify(session));else sessionStorage.setItem(SESSION_KEY,JSON.stringify(session));
 return session;
}
function restore(){try{session=JSON.parse(localStorage.getItem(SESSION_KEY)||sessionStorage.getItem(SESSION_KEY)||'null')}catch{session=null}return session}
async function logout(){const t=await token();if(t){try{await fetch(URL+'/auth/v1/logout',{method:'POST',headers:headers(t)})}catch{}}session=null;localStorage.removeItem(SESSION_KEY);sessionStorage.removeItem(SESSION_KEY)}
async function rest(path,{method='GET',body,prefer,onConflict}={}){
 let t=await token();if(!t)throw new Error('Inicia sesión de profesor para sincronizar.');
 let p=path;if(onConflict)p+=(p.includes('?')?'&':'?')+'on_conflict='+encodeURIComponent(onConflict);
 const doFetch=async(tokenValue)=>{
   const h=headers(tokenValue,body!==undefined?{'Content-Type':'application/json'}:{});if(prefer)h.Prefer=prefer;
   return apiFetch(()=>fetch(URL+'/rest/v1/'+p,{method,headers:h,body:body===undefined?undefined:JSON.stringify(body)}));
 };
 let r=await doFetch(t);
 if(r.status===401){
   await refresh();
   t=session?.access_token||null;
   if(t)r=await doFetch(t);
 }
 return parse(r);
}
async function rpc(name,args={}){return rest('rpc/'+name,{method:'POST',body:args})}
async function upsert(table,rows,onConflict){if(!Array.isArray(rows))rows=[rows];if(!rows.length)return;return rest(table,{method:'POST',body:rows,prefer:'resolution=merge-duplicates,return=minimal',onConflict})}
async function select(table,query=''){return rest(table+(query?('?'+query):''))}
async function remove(table,query){return rest(table+'?'+query,{method:'DELETE',prefer:'return=minimal'})}
async function uploadMaterial(path,data,mime='application/octet-stream'){const t=await token();if(!t)throw new Error('Sin sesión de profesor');const r=await apiFetch(()=>fetch(URL+'/storage/v1/object/materials/'+path.split('/').map(encodeURIComponent).join('/'),{method:'POST',headers:headers(t,{'Content-Type':mime,'x-upsert':'true'}),body:data}));return parse(r)}
async function edge(name,body={}){
 const t=await token();if(!t)throw new Error('Sin sesión de profesor');
 const r=await apiFetch(()=>fetch(URL+'/functions/v1/'+name,{method:'POST',headers:headers(t,{'Content-Type':'application/json'}),body:JSON.stringify(body)}));
 return parse(r);
}
window.ProfeSupabase={URL,KEY,login,logout,restore,token,rest,rpc,upsert,select,remove,uploadMaterial,edge,get session(){return session}};
})();
