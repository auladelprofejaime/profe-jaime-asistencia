(function(){
const URL="https://xqeyyjakmeiaahecfdmc.supabase.co";
const KEY="sb_publishable_GY2NGAigumnZw3rIJKU7LA_a2qigAEA";
const SESSION_KEY="meritoAdminSupabaseSessionV1";
let session=null,refreshPromise=null;
function headers(token,extra={}){return {apikey:KEY,Authorization:"Bearer "+(token||KEY),...extra}}
async function parse(r){const t=await r.text();let d=null;try{d=t?JSON.parse(t):null}catch{d=t}if(!r.ok)throw new Error(d?.message||d?.error_description||d?.hint||("Supabase "+r.status));return d}
async function login(email,password,remember=true){
 const r=await fetch(URL+"/auth/v1/token?grant_type=password",{method:"POST",headers:{apikey:KEY,"Content-Type":"application/json"},body:JSON.stringify({email,password})});
 session=await parse(r);session.saved_at=Date.now();
 (remember?localStorage:sessionStorage).setItem(SESSION_KEY,JSON.stringify(session));
 (remember?sessionStorage:localStorage).removeItem(SESSION_KEY);
 return session;
}
function restore(){try{session=JSON.parse(localStorage.getItem(SESSION_KEY)||sessionStorage.getItem(SESSION_KEY)||"null")}catch{session=null}return session}
async function refresh(){
 if(refreshPromise)return refreshPromise;
 if(!session?.refresh_token)return null;
 refreshPromise=(async()=>{
  const r=await fetch(URL+"/auth/v1/token?grant_type=refresh_token",{method:"POST",headers:{apikey:KEY,"Content-Type":"application/json"},body:JSON.stringify({refresh_token:session.refresh_token})});
  const next=await parse(r);next.saved_at=Date.now();session=next;
  const remember=!!localStorage.getItem(SESSION_KEY);
  (remember?localStorage:sessionStorage).setItem(SESSION_KEY,JSON.stringify(session));
  return session;
 })().finally(()=>{refreshPromise=null});
 return refreshPromise;
}
async function token(){
 if(!session)restore();
 if(!session)return null;
 const exp=(session.expires_at?session.expires_at*1000:(session.saved_at||0)+(session.expires_in||3600)*1000);
 if(Date.now()>exp-15000)await refresh();
 return session?.access_token||null;
}
async function rest(path,{method="GET",body}={}){
 let t=await token();if(!t)throw new Error("Inicia sesión para continuar.");
 const doFetch=tv=>fetch(URL+"/rest/v1/"+path,{method,headers:headers(tv,body!==undefined?{"Content-Type":"application/json"}:{}),body:body===undefined?undefined:JSON.stringify(body),cache:"no-store"});
 let r=await doFetch(t);
 if(r.status===401){await refresh();t=session?.access_token||null;if(t)r=await doFetch(t)}
 return parse(r);
}
async function rpc(name,args={}){return rest("rpc/"+name,{method:"POST",body:args})}
async function edge(name,body={}){
 const t=await token();if(!t)throw new Error("Inicia sesión para continuar.");
 const r=await fetch(URL+"/functions/v1/"+name,{method:"POST",headers:headers(t,{"Content-Type":"application/json"}),body:JSON.stringify(body)});
 return parse(r);
}
async function logout(){session=null;localStorage.removeItem(SESSION_KEY);sessionStorage.removeItem(SESSION_KEY)}
window.ProfeSupabase={URL,KEY,login,logout,restore,token,rpc,edge,get session(){return session}};
})();