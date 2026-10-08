/* Individual evaluation dates: server-owned, per methodology, never delivery dates. */
(()=>{
'use strict';
const q=id=>document.getElementById(id);
let ticket=0,busy=false;
const date=x=>/^\d{4}-\d{2}-\d{2}$/.test(String(x||'').slice(0,10))?String(x).slice(0,10):'';
function range(m,sid){return m.evaluationRanges?.[sid]||null}
function applicable(m,sid,a){
 const r=range(m,sid);if(!r)return true;
 const d=date(a.date||a.activity_date);if(!d)return true;
 return (!r.start||d>=r.start)&&(!r.end||d<=r.end);
}
function weights(m,sid,acts){
 const r=range(m,sid),excluded=[];
 if(r)for(const c of m.criteria||[]){const aa=acts.filter(a=>m.assignments?.[a.id]===c.id);if(aa.length&&!aa.some(a=>applicable(m,sid,a)))excluded.push(c.id)}
 const active=(m.criteria||[]).reduce((n,c)=>n+(excluded.includes(c.id)?0:Number(c.percent)),0);
 return {excluded,active};
}
window.StudentEvaluationRange={applicable,weights};
function decode(row){return {...row.data,id:row.id,group:row.group_name,shift:row.shift,month:row.month,cycle:row.cycle,quarter:row.quarter,closed:row.closed,_serverUpdatedAt:row.updated_at}}
async function remote(id){const aa=await ProfeSupabase.select('methodologies','select=*&id=eq.'+encodeURIComponent(id));if(!aa?.length)throw Error('No se pudo consultar la metodología.');return decode(aa[0])}
function status(text){if(q('evaluationRangeStatus'))q('evaluationRangeStatus').textContent=text}
async function panel(){
 const n=++ticket,id=q('calcMethodology')?.value,anchor=q('methodologyAssignments');if(!anchor)return;
 let box=q('evaluationRangePanel');if(!box){box=document.createElement('div');box.id='evaluationRangePanel';box.className='card';anchor.before(box)}
 if(!id){box.hidden=true;return}box.hidden=false;
 try{
  const m=await remote(id),roster=(await students()).filter(s=>sameShift(s.shift,m.shift)&&sameGroup(s.group,m.group)).sort(compareStudentsForList);
  if(n!==ticket||q('calcMethodology')?.value!==id)return;
  const old=q('evaluationRangeStudent')?.value;
  box.innerHTML='<h3>Fechas de evaluación por alumno</h3><p class="hint">Para alumnos que llegaron después. Solo cuentan las actividades asignadas dentro de estas fechas, incluyendo ambos días. Vacío = periodo normal del grupo. No cambia las entregas ni los puntos.</p><label>Alumno<select id="evaluationRangeStudent">'+roster.map(s=>'<option value="'+safe(s.id)+'">'+safe((s.number||'')+' · '+studentListDisplayName(s)+' · ID '+s.id)+'</option>').join('')+'</select></label><div class="grid2"><label>Evaluar desde<input id="evaluationRangeStart" type="date"></label><label>Evaluar hasta (opcional)<input id="evaluationRangeEnd" type="date"></label></div><p class="hint">Si un criterio solo tiene actividades fuera del rango, no cuenta como cero: se redistribuye su porcentaje entre los demás criterios. Las faltas dentro del rango sí cuentan.</p><div class="actions"><button id="evaluationRangeSave" type="button">Guardar fechas</button><button id="evaluationRangeReset" class="secondary" type="button">Usar periodo normal</button></div><p id="evaluationRangeStatus" role="status" aria-live="polite"></p>';
  if(roster.some(s=>s.id===old))q('evaluationRangeStudent').value=old;
  function select(){const r=range(m,q('evaluationRangeStudent').value);q('evaluationRangeStart').value=r?.start||'';q('evaluationRangeEnd').value=r?.end||'';status(m.closed?'Mes cerrado: reábrelo para modificar fechas.':r?'Fechas individuales guardadas.':'Este alumno usa el periodo normal del grupo.')}
  q('evaluationRangeStudent').onchange=select;select();
  for(const key of ['evaluationRangeSave','evaluationRangeReset','evaluationRangeStart','evaluationRangeEnd'])q(key).disabled=m.closed||!roster.length;
  async function save(reset){
   if(busy)return;const sid=q('evaluationRangeStudent').value,start=reset?null:q('evaluationRangeStart').value||null,end=reset?null:q('evaluationRangeEnd').value||null;
   if(start&&end&&start>end){status('El inicio no puede ser posterior al fin.');return}
   if(reset&&!confirm('¿Volver al periodo normal para este alumno?'))return;
   busy=true;q('evaluationRangeSave').disabled=q('evaluationRangeReset').disabled=true;status('Guardando fechas en el servidor…');
   try{
    const out=await ProfeSupabase.rpc('teacher_set_student_evaluation_range',{p_methodology_id:id,p_student_id:sid,p_start:start,p_end:end});if(!out?.ok)throw Error('El servidor no confirmó las fechas.');
    const saved=decode(out.methodology);await req(store('methodologies','readwrite').put(saved));
    if(q('calcMethodology')?.value===id){await panel();status('Fechas guardadas. Pulsa Calcular para actualizar los promedios; después publica la provisional si corresponde. Los puntos ya aplicados se conservan.')}
   }catch(e){status('No se guardó: '+(e.message||e))}finally{busy=false;if(q('calcMethodology')?.value===id){q('evaluationRangeSave').disabled=q('evaluationRangeReset').disabled=m.closed}}
  }
  q('evaluationRangeSave').onclick=()=>save(false);q('evaluationRangeReset').onclick=()=>save(true);
 }catch(e){if(n===ticket){box.textContent='No se pudieron consultar las fechas: '+(e.message||e)}}
}
const oldAssignments=renderMethodologyAssignments;
renderMethodologyAssignments=async function(){const result=await oldAssignments.apply(this,arguments);await panel();return result};
const oldRender=renderMethodologyResults;
renderMethodologyResults=function(data){
 const result=oldRender.apply(this,arguments);if(data?.methodology?.id!==q('calcMethodology')?.value)return result;
 const m=data.methodology,acts=data.activities||[],table=q('methodologyResults')?.querySelector('.methodology-results-table');if(!table)return result;
 table.querySelectorAll('tbody tr').forEach((tr,i)=>{
  const row=data.rows[i],r=range(m,row.student.id);if(!r)return;
  const w=weights(m,row.student.id,acts),label=document.createElement('small');label.style.display='block';label.textContent='Evaluación: '+(r.start||'inicio normal')+' a '+(r.end||'fin normal');tr.children[1]?.append(label);
  (m.criteria||[]).forEach((c,j)=>{const cell=tr.children[j+2];if(!cell)return;if(w.excluded.includes(c.id)){cell.textContent='No aplica';cell.title='Todas las actividades de este criterio quedan fuera de sus fechas.'}else if(row.criterionGrades[c.id]!=null&&w.active>0){const contribution=Number(row.criterionGrades[c.id])*Number(c.percent)/w.active;cell.textContent=contribution.toFixed(2);cell.title='Aporte ajustado a sus fechas: '+Number(c.percent)+' / '+w.active+' × '+Number(row.criterionGrades[c.id]).toFixed(2)}});
 });
 return result;
};
const oldCalculate=calculateMethodology;
calculateMethodology=async function(){
 const id=q('calcMethodology')?.value;if(!id)return oldCalculate.apply(this,arguments);
 const m=await remote(id);await req(store('methodologies','readwrite').put(m));
 if(!Object.keys(m.evaluationRanges||{}).length)return oldCalculate.apply(this,arguments);
 if(m.closed)throw Error('Reabre el mes para recalcular las fechas individuales.');
 const total=m.criteria.reduce((s,c)=>s+Number(c.percent),0);if(Math.abs(total-100)>0.001)throw Error('Los criterios deben sumar 100%.');
 const acts=(await all('activities')).filter(a=>m.assignments?.[a.id]);if(!acts.length)throw Error('Asigna al menos una actividad a un criterio.');
 const roster=(await students()).filter(s=>sameShift(s.shift,m.shift)&&sameGroup(s.group,m.group)).sort(compareStudentsForList),records=await all('activityRecords'),map=new Map(records.map(r=>[r.key,r])),rows=[];
 m.gradeRecords=m.gradeRecords||{};
 for(const st of roster){
  const r=range(m,st.id),w=weights(m,st.id,acts),criterionGrades={};
  if(r&&acts.some(a=>!date(a.date||a.activity_date)))throw Error('Hay actividades sin fecha de asignación. Corrígelas antes de aplicar el rango.');
  if(r&&(!acts.some(a=>applicable(m,st.id,a))||w.active<=0))throw Error('No hay actividades evaluables dentro de las fechas de '+studentListDisplayName(st)+'. Revisa su rango; no se guardó un cero.');
  for(const c of m.criteria){
   const aa=acts.filter(a=>m.assignments[a.id]===c.id&&applicable(m,st.id,a));
   criterionGrades[c.id]=w.excluded.includes(c.id)?null:aa.length?aa.reduce((n,a)=>{const rec=map.get(a.id+'|'+st.id);return n+((a.evaluationMode||'delivery')==='numeric'?(typeof rec?.score==='number'?rec.score:0):(rec?.status==='yes'?10:0))},0)/aa.length:0;
  }
  const base=m.criteria.reduce((n,c)=>n+Number(criterionGrades[c.id]||0)*Number(c.percent),0)/(r?w.active:100),prior=m.gradeRecords[st.id]||{},manualExtra=Number(prior.manualExtra||0),pointsUsed=Number(prior.pointsUsed||0),ledger=await pointsLedgerFor(m,st.id,true),raw=base+manualExtra+pointsUsed,average=Math.min(10,Math.max(0,raw)),monthly=Math.min(10,Math.max(5,roundSchoolGrade(average))),generated=Math.max(0,raw-10);
  m.gradeRecords[st.id]={...prior,base,manualExtra,pointsUsed,finalDecimal:average,rounded:monthly,obtainedAverage:average,monthlyGrade:monthly,pointsGenerated:generated,evaluationRange:r,evaluationExcludedCriteria:w.excluded,updated:new Date().toISOString()};
  rows.push({student:st,criterionGrades,base,manualExtra,pointsUsed,final:average,finalDecimal:average,obtainedAverage:average,rounded:monthly,monthlyGrade:monthly,pointsGenerated:generated,pointsAvailable:Math.max(0,Number(ledger.available||0)-pointsUsed),pointsTotalBefore:Number(ledger.available||0)});
 }
 m.updated=new Date().toISOString();
 // Lock and revision-check the server row; never overwrite a donation/use made during calculation.
 const grades=Object.fromEntries(rows.map(row=>[row.student.id,m.gradeRecords[row.student.id]]));
 const out=await ProfeSupabase.rpc('teacher_save_range_calculation',{p_methodology_id:id,p_expected_updated_at:m._serverUpdatedAt,p_grades:grades});if(!out?.ok)throw Error('No se confirmó el guardado en el servidor.');
 const saved=decode(out.methodology);for(const row of rows){const g=saved.gradeRecords?.[row.student.id];if(!g||Math.abs(Number(g.base)-row.base)>0.000001||Number(g.pointsUsed)!==row.pointsUsed)throw Error('El servidor tiene cambios nuevos. Vuelve a consultar antes de recalcular.')}
 await req(store('methodologies','readwrite').put(saved));window._lastMethodologyCalculation={methodology:saved,activities:acts,rows};renderMethodologyResults(window._lastMethodologyCalculation);
 if(q('savedGradeStatus'))q('savedGradeStatus').textContent=rows.length+' promedios guardados con las fechas individuales. Los puntos ya aplicados se conservan.';
};
window.addEventListener('load',()=>{if(q('calculateMethodologyBtn'))q('calculateMethodologyBtn').onclick=()=>calculateMethodology().catch(e=>{status(e.message||e);alert(e.message||e)})});
})();
