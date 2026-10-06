/* Activities: server-backed listing, defensive normalization, no record deletion. */
(()=>{
'use strict';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let request=0,readPromise=null,lastRead=0,cached=[];
function normalize(row){
 const d=row.data&&typeof row.data==='object'?row.data:{};
 return {...d,id:String(row.id),name:String(row.title??d.name??'Actividad'),date:String(row.activity_date??d.date??''),
 dueDate:String(row.due_date??d.dueDate??''),shift:String(row.shift??d.shift??''),group:String(row.group_name??d.group??''),
 week:String(d.week??''),evaluationMode:row.evaluation_type||d.evaluationMode||'delivery',closed:!!row.closed};
}
function info(text,bad=false){
 let el=document.getElementById('activitiesLoadStatus');
 if(!el){el=document.createElement('p');el.id='activitiesLoadStatus';el.setAttribute('aria-live','polite');document.getElementById('activitiesList')?.before(el)}
 el.textContent=text;el.className=bad?'message bad':'hint';
}
async function pullActivities(force=false){
 if(readPromise)return readPromise;
 if(!force&&Date.now()-lastRead<30000)return cached;
 readPromise=(async()=>{
  if(!window.ProfeSupabase)throw new Error('No se pudo conectar. Revisa internet e inicia sesión docente.');
  const rows=await ProfeSupabase.select('activities','select=*&order=activity_date.desc');
  if(!Array.isArray(rows))throw new Error('El servidor no devolvió la lista de actividades.');
  const acts=rows.map(normalize).sort((a,b)=>b.date.localeCompare(a.date)||a.name.localeCompare(b.name,'es',{sensitivity:'base'}));
  if(typeof ensureDB==='function')await ensureDB();
  for(const a of acts)await req(store('activities','readwrite').put(a));
  cached=acts;lastRead=Date.now();return acts;
 })();
 try{return await readPromise}finally{readPromise=null}
}
for(const name of ['refreshActivitySelectors','refreshGridWeeks']){
 // The core declares mutable functions; wrap both entry points so scanner and
 // weekly grid get the same server activity cache as the management list.
 const old=name==='refreshActivitySelectors'?refreshActivitySelectors:refreshGridWeeks;
 const wrapped=async function(){
  try{await pullActivities()}catch(e){info('No se pudieron cargar las actividades: '+(e.message||e),true)}
  return old.apply(this,arguments);
 };
 if(name==='refreshActivitySelectors')refreshActivitySelectors=wrapped;else refreshGridWeeks=wrapped;
}
renderActivities=async function(){
 const box=document.getElementById('activitiesList');if(!box)return;
 const ticket=++request;
 info('Cargando actividades del servidor…');
 try{
  const acts=await pullActivities(true);
  if(ticket!==request)return;
  box.className=acts.length?'list':'list empty';
  box.innerHTML=acts.length?acts.map(a=>'<div class="row" data-activity-id="'+esc(a.id)+'"><div><strong>'+esc(a.name)+'</strong><small>'+esc(a.shift)+' · '+esc((a.groups?.length?a.groups:[a.group]).join(', '))+' · '+esc(a.week)+' · Asignada '+esc(a.date||'Sin fecha')+' · Entrega '+esc(a.dueDate||'Sin fecha')+' · '+esc(a.type||'Actividad')+'</small></div><div class="rowactions"><button type="button" class="edit activity-edit" data-actedit="'+esc(a.id)+'">✏️ Editar</button><button type="button" class="del" data-actdel="'+esc(a.id)+'">Eliminar</button></div></div>').join(''):'No hay actividades guardadas.';
  box.querySelectorAll('[data-actedit]').forEach(b=>b.onclick=()=>editActivity(b.dataset.actedit));
  // Deletion remains with the existing server-verified capture handler.
  info(acts.length+' actividades cargadas del servidor.');
 }catch(e){
  if(ticket!==request)return;
  info('No se pudieron cargar las actividades: '+(e.message||e),true);
  if(!box.querySelector('.row'))box.innerHTML='<button type="button" id="retryActivitiesLoad" class="secondary">Volver a cargar actividades</button>';
  document.getElementById('retryActivitiesLoad')?.addEventListener('click',()=>renderActivities());
 }
};
})();
