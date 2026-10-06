/* Saved averages are restored, never recalculated on entry. */
(()=>{
'use strict';
let seq=0;
const byId=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toolbar(){
 let el=byId('savedGradeActions');
 if(!el){el=document.createElement('div');el.id='savedGradeActions';el.className='card';byId('methodologyResults').before(el)}
 el.innerHTML='<button type="button" id="restoreSavedGrades">Ver promedios guardados</button> <button type="button" id="publishProvisionalGrades">Publicar calificación provisional</button><p id="savedGradeStatus" aria-live="polite"></p>';
 byId('restoreSavedGrades').onclick=()=>restoreGrades().catch(showError);
 byId('publishProvisionalGrades').onclick=publish;
 return el;
}
function status(t){const el=byId('savedGradeStatus');if(el)el.textContent=t}
function showError(e){status('No se pudo completar: '+(e.message||e))}
async function remote(id){
 const rows=await ProfeSupabase.select('methodologies','select=*&id=eq.'+encodeURIComponent(id));
 if(!rows?.length)throw new Error('La metodología no está guardada en el servidor.');
 const row=rows[0];
 return {...row.data,id:row.id,group:row.group_name,shift:row.shift,month:row.month,cycle:row.cycle,quarter:row.quarter,closed:row.closed};
}
async function restoreGrades(){
 const ticket=++seq,id=byId('calcMethodology')?.value;
 toolbar();
 if(!id){status('Selecciona una metodología.');return}
 status('Consultando promedios guardados…');
 const m=await remote(id),roster=await students();
 if(ticket!==seq||byId('calcMethodology').value!==id)return;
 // Local cache only: no remote upsert and no recalculation.
 await req(store('methodologies','readwrite').put(m));
 const entries=Object.entries(m.gradeRecords||{});
 byId('publishProvisionalGrades').disabled=m.closed||!entries.length;
 if(!entries.length){byId('methodologyResults').innerHTML='<p>No hay promedios guardados. Pulsa Calcular para generarlos.</p>';status('Sin resultados guardados.');return}
 const names=new Map(roster.map(s=>[String(s.id),s]));
 entries.sort((a,b)=>Number(names.get(a[0])?.listNumber||names.get(a[0])?.list_number||999)-Number(names.get(b[0])?.listNumber||names.get(b[0])?.list_number||999));
 const n=x=>Number.isFinite(Number(x))?Number(x).toFixed(2):'—';
 byId('methodologyResults').innerHTML='<p>Promedios guardados · '+esc(m.month)+' · Grupo '+esc(m.group)+'. No se recalcularon.</p><div style="overflow:auto"><table><thead><tr><th>Alumno</th><th>Base</th><th>Extra</th><th>Puntos usados</th><th>Promedio</th><th>Redondeada</th></tr></thead><tbody>'+entries.map(([sid,g])=>'<tr><td>'+esc(names.get(sid)?.name||sid)+'</td><td>'+n(g.base)+'</td><td>'+n(g.manualExtra||0)+'</td><td>'+n(g.pointsUsed||0)+'</td><td>'+n(g.finalDecimal)+'</td><td>'+esc(g.rounded??g.monthlyGrade??'—')+'</td></tr>').join('')+'</tbody></table></div>';
 status(entries.length+' promedios recuperados del servidor. '+(m.closed?'Mes cerrado.':m.provisionalPublished?'Provisionales visibles en Alumnos y Padres.':'Todavía no publicados.'));
}
async function publish(){
 const id=byId('calcMethodology')?.value;if(!id)return;
 if(!confirm('¿Mostrar los promedios guardados como provisionales en Alumnos y Padres? El mes seguirá abierto.'))return;
 const b=byId('publishProvisionalGrades');b.disabled=true;
 try{status('Publicando…');const out=await ProfeSupabase.rpc('teacher_publish_provisional_methodology',{p_methodology_id:id});if(!out?.ok)throw new Error('El servidor no confirmó la publicación.');await restoreGrades()}
 catch(e){showError(e)}finally{b.disabled=false}
}
const original=renderMethodologyAssignments;
renderMethodologyAssignments=async function(){await original.apply(this,arguments);try{await restoreGrades()}catch(e){showError(e)}};
window.addEventListener('load',()=>{
 if(byId('calcMethodology'))byId('calcMethodology').onchange=renderMethodologyAssignments;
});
// Await the existing remote mirror before confirming a calculation was saved.
const originalMirror=queueRemoteMirror,pending=new Map();
queueRemoteMirror=function(n,v){const p=originalMirror.apply(this,arguments);if(n==='methodologies')pending.set(v.id,p);return p};
const originalCalculate=calculateMethodology;
calculateMethodology=async function(){
 toolbar();const id=byId('calcMethodology')?.value;
 try{
  if(!supabaseReady)throw new Error('Conecta con Supabase antes de calcular y guardar.');
  await originalCalculate.apply(this,arguments);
  if(pending.has(id))await pending.get(id);
  const m=await remote(id);
  status(Object.keys(m.gradeRecords||{}).length+' promedios guardados en el servidor. Puedes publicar la calificación provisional.');
 }catch(e){showError(e);throw e}
};
window.addEventListener('load',()=>{if(byId('calculateMethodologyBtn'))byId('calculateMethodologyBtn').onclick=()=>calculateMethodology().catch(()=>{})});
})();
