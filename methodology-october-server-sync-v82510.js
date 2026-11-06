/* Remove stale duplicate October methodologies from local cache after server cleanup. */
(()=>{
'use strict';
let running=false;
const decode=row=>({...row.data,id:row.id,group:row.group_name,shift:row.shift,month:row.month,cycle:row.cycle,quarter:row.quarter,closed:row.closed});
async function syncOctober(){
 if(running||!window.ProfeSupabase||typeof db==='undefined'||!db)return;
 running=true;
 try{
  const remote=await ProfeSupabase.select('methodologies','select=*&shift=eq.Matutino&cycle=eq.2026-2027&month=eq.Octubre');
  if(!Array.isArray(remote))throw Error('No se pudo consultar octubre.');
  const valid=new Set(remote.map(r=>String(r.id)));
  const local=(await all('methodologies')).filter(m=>m.shift==='Matutino'&&m.cycle==='2026-2027'&&m.month==='Octubre');
  for(const m of local){
   if(!valid.has(String(m.id)))await req(store('methodologies','readwrite').delete(m.id));
  }
  for(const row of remote)await req(store('methodologies','readwrite').put(decode(row)));
  const sel=document.getElementById('calcMethodology');
  if(sel){
   [...sel.options].forEach(o=>{if(o.value&&/octubre/i.test(o.textContent||'')&&!valid.has(String(o.value)))o.remove()});
   const group=document.getElementById('calcGroup')?.value||document.getElementById('methodologyGroup')?.value||'';
   const matches=remote.filter(r=>!group||String(r.group_name)===String(group));
   if(matches.length===1&&!valid.has(String(sel.value)))sel.value=matches[0].id;
  }
 }catch(e){console.warn('Sincronización de metodologías de octubre pendiente:',e)}
 finally{running=false}
}
window.addEventListener('load',()=>setTimeout(syncOctober,700));
window.addEventListener('focus',syncOctober);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncOctober()});
document.addEventListener('click',e=>{if(e.target?.closest('[data-mettab],#calcMethodology,#methodologies'))setTimeout(syncOctober,100)});
})();