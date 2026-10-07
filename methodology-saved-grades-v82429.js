/* Saved averages are restored, never recalculated on entry. */
(()=>{
'use strict';
let seq=0,calculating=false,refreshing=false;
const signatures=new Map();
const byId=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toolbar(){
 let el=byId('savedGradeActions');
 if(!el){el=document.createElement('div');el.id='savedGradeActions';el.className='card';byId('methodologyResults').before(el)}
 if(!byId('restoreSavedGrades'))el.innerHTML='<button type="button" id="restoreSavedGrades">Ver promedios guardados</button> <button type="button" id="publishProvisionalGrades">Publicar calificación provisional</button><p id="savedGradeStatus" aria-live="polite"></p>';
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
async function restoreGrades(options={}){
 const quiet=options.quiet===true;
 const ticket=++seq,id=byId('calcMethodology')?.value;
 if(!quiet)toolbar();
 if(!id){status('Selecciona una metodología.');return}
 if(!quiet)status('Consultando promedios guardados…');
 const m=await remote(id),signature=JSON.stringify([m.closed,m.gradeRecords,m.provisionalPublished]);
 if(quiet&&signatures.get(id)===signature)return;
 const roster=await students();
 if(ticket!==seq||byId('calcMethodology').value!==id)return;
 // Local cache only: no remote upsert and no recalculation.
 await req(store('methodologies','readwrite').put(m));
 const entries=Object.entries(m.gradeRecords||{});
 byId('publishProvisionalGrades').disabled=m.closed||!entries.length;
 if(!entries.length){byId('methodologyResults').innerHTML='<p>No hay promedios guardados. Pulsa Calcular para generarlos.</p>';status('Sin resultados guardados.');return}
 // Build the existing table model from saved grades. Displaying details does not
 // recalculate or write the saved average, applied points or monthly grade.
 const acts=(await all('activities')).filter(a=>m.assignments?.[a.id]);
 const records=await all('activityRecords'),recordMap=new Map(records.map(r=>[r.key,r]));
 const names=new Map(roster.map(st=>[String(st.id),st]));
 const rows=[];
 for(const [sid,g] of entries){
  const st=names.get(sid)||{id:sid,name:sid,number:''};
  const criterionGrades={};
  for(const c of m.criteria||[]){
   const ca=acts.filter(a=>m.assignments?.[a.id]===c.id);
   const values=ca.map(a=>{const r=recordMap.get(a.id+'|'+sid);return (a.evaluationMode||'delivery')==='numeric'?(typeof r?.score==='number'?r.score:0):(r?.status==='yes'?10:0)});
   criterionGrades[c.id]=ca.length?values.reduce((a,b)=>a+b,0)/ca.length:null;
  }
  const ledger=await pointsLedgerFor(m,sid,true);
  const used=Number(g.pointsUsed||0),average=Number(g.finalDecimal??g.obtainedAverage??0);
  rows.push({student:st,criterionGrades,base:Number(g.base||0),manualExtra:Number(g.manualExtra||0),
   pointsUsed:used,final:average,finalDecimal:average,obtainedAverage:average,
   rounded:g.rounded??g.monthlyGrade,monthlyGrade:g.rounded??g.monthlyGrade,
   pointsGenerated:Number(g.pointsGenerated||0),pointsAvailable:Math.max(0,Number(ledger.available||0)-used),
   pointsTotalBefore:Number(ledger.available||0)});
 }
 rows.sort((a,b)=>compareStudentsForList(a.student,b.student));
 if(ticket!==seq||byId('calcMethodology').value!==id)return;
 window._lastMethodologyCalculation={methodology:m,activities:acts,rows};
 renderMethodologyResults(window._lastMethodologyCalculation);
 signatures.set(id,signature);
 status(entries.length+' promedios recuperados del servidor. '+(m.closed?'Mes cerrado.':m.provisionalPublished?'Provisionales visibles en Alumnos y Padres.':'Todavía no publicados.'));
}
async function publish(){
 const id=byId('calcMethodology')?.value;if(!id)return;
 if(!confirm('¿Mostrar los promedios guardados como provisionales en Alumnos y Padres? El mes seguirá abierto.'))return;
 const b=byId('publishProvisionalGrades');b.disabled=true;
 try{status('Publicando…');const out=await ProfeSupabase.rpc('teacher_publish_provisional_methodology',{p_methodology_id:id});if(!out?.ok)throw new Error('El servidor no confirmó la publicación.');await restoreGrades()}
 catch(e){showError(e)}finally{b.disabled=false}
}
// A newer calculation invalidates any unfinished server restore.
const originalResults=renderMethodologyResults;
renderMethodologyResults=function(data){
 if(data?.methodology?.id!==byId('calcMethodology')?.value)return;
 ++seq;
 return originalResults.apply(this,arguments);
};
const original=renderMethodologyAssignments;
renderMethodologyAssignments=async function(){await original.apply(this,arguments);try{await restoreGrades()}catch(e){showError(e)}};
window.addEventListener('load',()=>{
 if(byId('calcMethodology'))byId('calcMethodology').onchange=renderMethodologyAssignments;
});
// Await the existing remote mirror before confirming a calculation was saved.
const originalMirror=queueRemoteMirror,pending=new Map();
queueRemoteMirror=function(n,v){const p=originalMirror.apply(this,arguments);if(n==='methodologies')pending.set(v.id,p);return p};
const originalLedger=pointsLedgerFor;
pointsLedgerFor=async function(m,sid,excludeCurrent=true){
 const ledger=await originalLedger.apply(this,arguments);
 if(excludeCurrent)ledger.available=Math.max(Number(ledger.available||0),Number(m.gradeRecords?.[sid]?.pointsUsed||0));
 return ledger;
};
// Refund through the bank transaction API, never only reset a local number.
returnUsedPoints=async function(studentId){
 if(!confirm('¿Deshacer la aplicación y devolver los puntos al saldo del alumno?'))return;
 try{
  const id=byId('calcMethodology')?.value;
  const periods=(await ProfeSupabase.rpc('teacher_point_periods')).filter(p=>p.methodology_id===id&&!p.closed_at);
  const now=Date.now(),period=(periods||[]).find(p=>now>=Date.parse(p.opens_at)&&now<Date.parse(p.closes_at))||(periods||[])[0];
  if(!period)throw new Error('No hay un periodo de puntos para este mes.');
  const out=await ProfeSupabase.rpc('teacher_set_grade_points',{p_student_id:studentId,p_period_id:period.id,p_amount:0});
  if(!out?.ok)throw new Error('El servidor no confirmó la devolución.');
  await restoreGrades();
 }catch(e){showError(e);alert(e.message||e)}
};
const originalCalculate=calculateMethodology;
calculateMethodology=async function(){
 ++seq;calculating=true;toolbar();const id=byId('calcMethodology')?.value;
 try{
  if(!supabaseReady)throw new Error('Conecta con Supabase antes de calcular y guardar.');
  await originalCalculate.apply(this,arguments);
  if(pending.has(id))await pending.get(id);
  const m=await remote(id);
  status(Object.keys(m.gradeRecords||{}).length+' promedios guardados en el servidor. Puedes publicar la calificación provisional.');
 }catch(e){showError(e);throw e}finally{calculating=false}
};
window.addEventListener('load',()=>{if(byId('calculateMethodologyBtn'))byId('calculateMethodologyBtn').onclick=()=>calculateMethodology().catch(()=>{})});
async function refreshAppliedPoints(){
 if(refreshing||calculating||document.hidden||!byId('methodologies')?.classList.contains('active')||!byId('met-calculate')?.classList.contains('active'))return;
 if(byId('methodologyResults')?.contains(document.activeElement)||document.querySelector('dialog[open]'))return;
 refreshing=true;
 try{await restoreGrades({quiet:true})}catch(e){console.warn('No se pudieron consultar las calificaciones actualizadas:',e.message||e)}
 finally{refreshing=false}
}
window.addEventListener('load',()=>setInterval(refreshAppliedPoints,10000));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshAppliedPoints()});
window.addEventListener('focus',refreshAppliedPoints);
})();
