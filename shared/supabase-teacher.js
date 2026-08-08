(function(){
const URL="https://xqeyyjakmeiaahecfdmc.supabase.co",KEY="sb_publishable_GY2NGAigumnZw3rIJKU7LA_a2qigAEA",SESSION_KEY='profeJaimeSupabaseTeacherSession';
let session=null;
function headers(token,extra={}){return {apikey:KEY,Authorization:`Bearer ${token||KEY}`,...extra}}
async function parse(r){let t=await r.text(),d=null;try{d=t?JSON.parse(t):null}catch{d=t}if(!r.ok)throw new Error(d?.message||d?.error_description||d?.hint||`Supabase ${r.status}`);return d}
async function refresh(){
 if(!session?.refresh_token)return null;
 const r=await fetch(URL+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token})});
 session=await parse(r);session.saved_at=Date.now();localStorage.setItem(SESSION_KEY,JSON.stringify(session));return session;
}
async function token(){
 if(!session){try{session=JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch{}}
 if(!session)return null;
 const exp=(session.expires_at?session.expires_at*1000:(session.saved_at||0)+(session.expires_in||3600)*1000);
 if(Date.now()>exp-60000)await refresh();
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
 const t=await token();if(!t)throw new Error('Inicia sesión de profesor para sincronizar.');
 let p=path;if(onConflict)p+=(p.includes('?')?'&':'?')+'on_conflict='+encodeURIComponent(onConflict);
 const h=headers(t,body!==undefined?{'Content-Type':'application/json'}:{});if(prefer)h.Prefer=prefer;
 const r=await fetch(URL+'/rest/v1/'+p,{method,headers:h,body:body===undefined?undefined:JSON.stringify(body)});return parse(r);
}
async function rpc(name,args={}){return rest('rpc/'+name,{method:'POST',body:args})}
async function upsert(table,rows,onConflict){if(!Array.isArray(rows))rows=[rows];if(!rows.length)return;return rest(table,{method:'POST',body:rows,prefer:'resolution=merge-duplicates,return=minimal',onConflict})}
async function select(table,query=''){return rest(table+(query?('?'+query):''))}
async function remove(table,query){return rest(table+'?'+query,{method:'DELETE',prefer:'return=minimal'})}
async function uploadMaterial(path,data,mime='application/octet-stream'){const t=await token();if(!t)throw new Error('Sin sesión de profesor');const r=await fetch(URL+'/storage/v1/object/materials/'+path.split('/').map(encodeURIComponent).join('/'),{method:'POST',headers:headers(t,{'Content-Type':mime,'x-upsert':'true'}),body:data});return parse(r)}
window.ProfeSupabase={URL,KEY,login,logout,restore,token,rest,rpc,upsert,select,remove,uploadMaterial,get session(){return session}};
})();
