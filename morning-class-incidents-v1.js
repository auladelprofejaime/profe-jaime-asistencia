/* Incidencias matutino: módulo aislado, sin tocar registros de entregas. */
(()=>{
'use strict';
const catalog=[
 ['talks','Platica constantemente','Conversa de manera recurrente durante las explicaciones o actividades.'],
 ['laughs','Se ríe durante la clase','Se ríe constantemente en momentos que requieren atención e interfiere con la clase.'],
 ['late','Llega tarde','Ingresa al salón después del inicio de la clase.'],
 ['skips','Se salta la clase','Se ausenta de la clase sin autorización.'],
 ['interrupts','Interrumpe la clase','Interrumpe reiteradamente las explicaciones o actividades.'],
 ['instructions','No sigue indicaciones','No atiende las indicaciones proporcionadas durante la clase.'],
 ['not_working','No trabaja en clase','No realiza las actividades asignadas durante la sesión.'],
 ['distracts','Distrae a sus compañeros','Realiza acciones que interfieren con la concentración de otros alumnos.'],
 ['disrespect','Falta de respeto','Presenta conductas irrespetuosas hacia el docente o sus compañeros.'],
 ['phone','Uso no autorizado del celular','Utiliza el teléfono celular durante la clase sin autorización.'],
 ['leaves_seat','Se levanta constantemente','Abandona su lugar de manera recurrente sin autorización.'],
 ['no_material','No trae material','Se presenta sin los materiales necesarios para trabajar en clase.']
];
const labels=Object.fromEntries(catalog.map(x=>[x[0],x[2]]));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const morning=()=>String(document.querySelector('#rangeShift')?.value||'').toLowerCase().includes('matutino');
const date=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Mexico_City',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
async function read(studentIds,from,to){
 if(!studentIds.length)return [];
 if(!window.ProfeSupabase)throw Error('Sin conexión al servidor.');
 let all=[];
 for(let i=0;i<studentIds.length;i+=20){
  const ids=studentIds.slice(i,i+20).map(x=>'"'+String(x).replace(/"/g,'')+'"').join(',');
  const q='select=id,student_id,incident_code,incident_date,created_by&student_id=in.('+encodeURIComponent(ids)+')&incident_date=gte.'+from+'&incident_date=lte.'+to+'&order=incident_date.asc,created_at.asc';
  const rows=await ProfeSupabase.select('morning_class_incidents',q);
  if(!Array.isArray(rows))throw Error('No se pudieron consultar las incidencias.');
  all.push(...rows);
 }
 return all;
}
async function openFor(studentId,name,group){
 if(!morning())return;
 if(!window.ProfeSupabase){alert('Sin conexión. No se registró ninguna incidencia.');return}
 const dialog=document.createElement('dialog');dialog.style.cssText='border:1px solid #ddd;border-radius:14px;max-width:min(94vw,520px);max-height:85vh;padding:20px;overflow:auto';
 dialog.innerHTML='<form method="dialog"><h3>Incidencias · '+esc(name)+'</h3><p>Selecciona una o varias incidencias. Se registrarán con la fecha actual.</p><div style="display:grid;gap:10px">'+catalog.map(([code,label])=>'<label style="display:flex;gap:10px;align-items:center"><input type="checkbox" name="incident" value="'+code+'">'+esc(label)+'</label>').join('')+'</div><p id="morningIncidentStatus" role="status"></p><div style="display:flex;gap:10px;margin-top:16px"><button type="button" data-save-incidents>Guardar incidencias</button><button type="button" data-history>Historial</button><button type="submit">Cerrar</button></div><div data-history-list></div></form>';
 document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove());dialog.showModal();
 const status=dialog.querySelector('#morningIncidentStatus'),save=dialog.querySelector('[data-save-incidents]');
 save.addEventListener('click',async()=>{
  const codes=[...dialog.querySelectorAll('[name=incident]:checked')].map(x=>x.value);
  if(!codes.length){status.textContent='Selecciona al menos una incidencia.';return}
  save.disabled=true;status.textContent='Guardando en el servidor…';
  try{
   const rows=codes.map(code=>({student_id:String(studentId),group_name:String(group),shift:'Matutino',incident_code:code,incident_date:date()}));
   for(const row of rows)await ProfeSupabase.upsert('morning_class_incidents',{...row,id:crypto.randomUUID()},'id');
   status.textContent='Incidencias guardadas correctamente.';
   dialog.querySelectorAll('[name=incident]:checked').forEach(x=>x.checked=false);
  }catch(e){status.textContent='NO GUARDADO: '+(e.message||e)}
  finally{save.disabled=false}
 });
 dialog.querySelector('[data-history]').addEventListener('click',async()=>{
  const box=dialog.querySelector('[data-history-list]');box.textContent='Consultando historial…';
  try{
   const rows=await read([studentId],'2026-01-01','2099-12-31');
   box.innerHTML=rows.length?'<h4>Historial</h4>'+rows.map(r=>'<p>'+esc(r.incident_date)+' · '+esc(labels[r.incident_code]||r.incident_code)+' <button type="button" data-remove="'+esc(r.id)+'">Eliminar</button></p>').join(''):'Sin incidencias registradas.';
   box.querySelectorAll('[data-remove]').forEach(b=>b.addEventListener('click',async()=>{
    if(!confirm('¿Eliminar esta incidencia?'))return;
    try{await ProfeSupabase.remove('morning_class_incidents','id=eq.'+encodeURIComponent(b.dataset.remove));b.parentElement.remove()}
    catch(e){status.textContent='No se pudo eliminar: '+(e.message||e)}
   }));
  }catch(e){box.textContent='No se pudo cargar: '+(e.message||e)}
 });
}
function enhance(){
 const grid=document.querySelector('#activityRangeGrid');
 if(!grid||!morning())return;
 grid.querySelectorAll('tbody tr').forEach(tr=>{
  const cell=tr.querySelector('.range-student');if(!cell||cell.querySelector('[data-morning-incidents]'))return;
  const sid=tr.querySelector('[data-sid]')?.dataset.sid;if(!sid)return;
  const btn=document.createElement('button');btn.type='button';btn.dataset.morningIncidents='1';btn.textContent='Incidencia';btn.style.cssText='display:block;margin-top:4px;padding:4px 8px;font-size:12px';
  const name=cell.textContent.trim();btn.addEventListener('click',()=>openFor(sid,name,document.querySelector('#rangeGroup')?.value||''));
  cell.append(btn);
 });
}
const observer=new MutationObserver(()=>enhance());
function init(){const el=document.querySelector('#activityRangeGrid');if(el){observer.observe(el,{childList:true,subtree:true});enhance()}else setTimeout(init,500)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
window.MorningIncidents={read,labels,openFor};
})();
