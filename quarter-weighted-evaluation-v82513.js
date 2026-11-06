/* Evaluación trimestral ponderada: Proyecto 35%, mensuales 30%, examen 22%, responsabilidad 13%. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state=null, roster=[], activeStudent='', loading=false, saveTimer=null;
const norm=v=>String(v??'').trim().toLowerCase().replace(/[^a-z0-9]/g,'');
const schoolRound=v=>{const n=Math.max(0,Math.min(10,Number(v)||0)),b=Math.floor(n+1e-9);return Math.min(10,n-b>=.6-1e-9?b+1:b)};
function studentGroup(s){return s.group??s.group_name??''}
function displayName(s){return typeof window.studentListDisplayName==='function'?studentListDisplayName(s):(s.name||s.student_name||s.id)}
function sortRoster(a,b){return typeof window.compareStudentsForList==='function'?compareStudentsForList(a,b):Number(a.number??a.list_number??999)-Number(b.number??b.list_number??999)}
function cfg(){return {shift:$('quarterShift')?.value||'',group:$('quarterGroup')?.value||'',cycle:($('quarterCycle')?.value||'').trim(),quarter:$('quarterNumber')?.value||'1',subject:'Español'}}
async function rpc(name,args){if(!window.ProfeSupabase)throw Error('Sin conexión con el servidor.');return ProfeSupabase.rpc(name,args)}
function monthsForStudent(sid){
 const arr=state?.closed_months||[],byMonth=new Map();
 for(const m of arr){const prev=byMonth.get(m.month);if(!prev||String(m.updated_at)>String(prev.updated_at))byMonth.set(m.month,m)}
 const vals=[];
 for(const m of byMonth.values()){
  const g=m.gradeRecords?.[sid];if(!g)continue;
  const v=Number(g.monthlyGrade??g.rounded??g.finalDecimal??g.obtainedAverage);
  if(Number.isFinite(v))vals.push({month:m.month,value:v});
 }
 return vals;
}
function calc(sid){
 const rec=state?.evaluation?.records?.[sid]||{},items=state?.evaluation?.project_items||[],delivered=new Set(rec.projectDelivered||[]);
 const months=monthsForStudent(sid),monthlyAvg=months.length?months.reduce((a,b)=>a+b.value,0)/months.length:null;
 const projectPct=items.length?35*items.filter(x=>delivered.has(String(x.id))).length/items.length:0;
 const exam=rec.exam===''||rec.exam==null?null:Number(rec.exam),resp=rec.responsibility===''||rec.responsibility==null?null:Number(rec.responsibility);
 const monthlyContribution=monthlyAvg==null?0:monthlyAvg*.30,projectContribution=projectPct/10,examContribution=Number.isFinite(exam)?exam*.22:0,respContribution=Number.isFinite(resp)?resp*.13:0;
 const complete=monthlyAvg!=null&&items.length>0&&Number.isFinite(exam)&&Number.isFinite(resp);
 const finalDecimal=Math.min(10,monthlyContribution+projectContribution+examContribution+respContribution);
 return {rec,items,delivered,months,monthlyAvg,projectPct,exam,resp,monthlyContribution,projectContribution,examContribution,respContribution,complete,finalDecimal,rounded:schoolRound(finalDecimal)}
}
function ensureUI(){
 const pane=$('met-quarter');if(!pane)return null;
 let box=$('quarterWeightedPanel');
 if(!box){box=document.createElement('div');box.id='quarterWeightedPanel';box.className='card';$('quarterResults')?.before(box)}
 return box;
}
function render(){
 const box=ensureUI();if(!box)return;
 if(!state){box.innerHTML='<h2>Evaluación trimestral</h2><p class="hint">Selecciona turno, grupo, ciclo y trimestre; después pulsa Calcular trimestre.</p>';return}
 const items=state.evaluation?.project_items||[],student=roster.find(s=>String(s.id)===String(activeStudent))||roster[0];if(student)activeStudent=String(student.id);
 const c=student?calc(activeStudent):null;
 box.innerHTML='<h2>Evaluación trimestral</h2>'+
 '<div class="stats"><div><b>35%</b><span>Proyecto integrador</span></div><div><b>30%</b><span>Promedio mensual</span></div><div><b>22%</b><span>Examen trimestral</span></div><div><b>13%</b><span>Responsabilidad</span></div></div>'+
 '<div class="card" style="margin:12px 0"><h3>Trabajos del Proyecto integrador</h3><p class="hint">Todos valen lo mismo y juntos conforman el 35%. Escribe un trabajo por línea.</p><textarea id="quarterItemsText" rows="5" placeholder="Trabajo 1\nTrabajo 2\nTrabajo 3">'+esc(items.map(x=>x.name).join('\n'))+'</textarea><div class="actions"><button id="quarterSaveItems" class="secondary" type="button">Guardar trabajos del proyecto</button></div><p id="quarterItemsStatus" class="hint"></p></div>'+
 (roster.length?'<label>Alumno<select id="quarterStudent">'+roster.map(s=>'<option value="'+esc(s.id)+'" '+(String(s.id)===String(activeStudent)?'selected':'')+'>'+esc((s.number??s.list_number??'')+' · '+displayName(s))+'</option>').join('')+'</select></label>':'<p>No hay alumnos en este grupo.</p>')+
 (student?'<div class="card" style="margin-top:12px"><h3>'+esc(displayName(student))+'</h3>'+
 '<div class="grid2"><div><b>Promedio mensual · 30%</b><p>'+(c.monthlyAvg==null?'Pendiente de cerrar evaluaciones mensuales':c.monthlyAvg.toFixed(2)+' → aporta '+c.monthlyContribution.toFixed(2)+' puntos')+'</p><small>'+esc(c.months.map(x=>x.month+': '+x.value.toFixed(1)).join(' · ')||'Sin meses cerrados')+'</small></div>'+
 '<div><b>Proyecto integrador · 35%</b><p>'+c.delivered.size+' de '+c.items.length+' trabajos → '+c.projectPct.toFixed(2)+' / 35%</p></div></div>'+
 '<h3>Trabajos entregados</h3><div id="quarterProjectChecklist" class="activity-group-choices">'+(c.items.length?c.items.map((it,i)=>'<label style="display:flex;gap:10px;align-items:center;padding:8px"><input type="checkbox" class="quarter-project-item" value="'+esc(it.id)+'" '+(c.delivered.has(String(it.id))?'checked':'')+'> <span>'+(i+1)+'. '+esc(it.name)+' <small>('+(35/c.items.length).toFixed(2)+'%)</small></span></label>').join(''):'<p class="hint">Primero guarda los trabajos que integran el proyecto.</p>')+'</div>'+
 '<div class="grid2"><label>Examen trimestral · 22%<input id="quarterExam" type="number" min="0" max="10" step="0.1" value="'+(Number.isFinite(c.exam)?c.exam:'')+'" placeholder="0 a 10"></label><label>Responsabilidad escolar · 13%<input id="quarterResponsibility" type="number" min="0" max="10" step="0.1" value="'+(Number.isFinite(c.resp)?c.resp:'')+'" placeholder="0 a 10"></label></div>'+
 '<div class="percentage-total" style="margin-top:12px">Resultado actual: <strong>'+c.finalDecimal.toFixed(2)+'</strong> / 10 · Calificación: <strong>'+(c.complete?c.rounded:'Pendiente')+'</strong></div><p id="quarterSaveStatus" class="hint">'+(c.complete?'Todos los criterios capturados.':'Faltan datos para cerrar la calificación.')+'</p></div>':'');
 bind();
 renderSummary();
}
function renderSummary(){
 const out=$('quarterResults');if(!out||!state)return;
 if(!roster.length){out.innerHTML='<div class="empty">No hay alumnos.</div>';return}
 out.innerHTML='<table><thead><tr><th>No.</th><th>Alumno</th><th>Mensual 30%</th><th>Proyecto 35%</th><th>Examen 22%</th><th>Resp. 13%</th><th>Final</th></tr></thead><tbody>'+roster.map(s=>{const c=calc(String(s.id));return '<tr><td>'+esc(s.number??s.list_number??'')+'</td><td>'+esc(displayName(s))+'</td><td>'+(c.monthlyAvg==null?'—':c.monthlyAvg.toFixed(2))+'</td><td>'+c.projectPct.toFixed(2)+'%</td><td>'+(Number.isFinite(c.exam)?c.exam.toFixed(1):'—')+'</td><td>'+(Number.isFinite(c.resp)?c.resp.toFixed(1):'—')+'</td><td><b>'+(c.complete?c.rounded:'—')+'</b></td></tr>'}).join('')+'</tbody></table>';
}
async function saveRecord(){
 if(!activeStudent||!state)return;
 const c=calc(activeStudent),examEl=$('quarterExam'),respEl=$('quarterResponsibility');
 const exam=examEl?.value===''?null:Number(examEl?.value),responsibility=respEl?.value===''?null:Number(respEl?.value);
 if(exam!=null&&(exam<0||exam>10)||responsibility!=null&&(responsibility<0||responsibility>10)){if($('quarterSaveStatus'))$('quarterSaveStatus').textContent='Las calificaciones deben estar entre 0 y 10.';return}
 const delivered=[...document.querySelectorAll('.quarter-project-item:checked')].map(x=>x.value);
 const p=cfg();if($('quarterSaveStatus'))$('quarterSaveStatus').textContent='Guardando…';
 const out=await rpc('teacher_save_quarter_record',{p_shift:p.shift,p_group:p.group,p_cycle:p.cycle,p_quarter:p.quarter,p_student_id:activeStudent,p_record:{projectDelivered:delivered,exam,responsibility},p_subject:p.subject});
 state.evaluation=out.evaluation;render();
}
function scheduleSave(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>saveRecord().catch(e=>{if($('quarterSaveStatus'))$('quarterSaveStatus').textContent=e.message||e}),250)}
function bind(){
 const st=$('quarterStudent');if(st)st.onchange=()=>{activeStudent=st.value;render()};
 document.querySelectorAll('.quarter-project-item').forEach(x=>x.onchange=scheduleSave);
 if($('quarterExam'))$('quarterExam').onchange=scheduleSave;
 if($('quarterResponsibility'))$('quarterResponsibility').onchange=scheduleSave;
 if($('quarterSaveItems'))$('quarterSaveItems').onclick=async()=>{
  const names=($('quarterItemsText').value||'').split(/\n+/).map(x=>x.trim()).filter(Boolean);
  const items=names.map((name,i)=>({id:'item-'+(i+1),name}));
  const p=cfg();$('quarterItemsStatus').textContent='Guardando…';
  try{const out=await rpc('teacher_set_quarter_items',{p_shift:p.shift,p_group:p.group,p_cycle:p.cycle,p_quarter:p.quarter,p_items:items,p_subject:p.subject});state.evaluation=out.evaluation;$('quarterItemsStatus').textContent='Trabajos guardados.';render()}catch(e){$('quarterItemsStatus').textContent=e.message||e}
 };
}
async function load(){
 if(loading)return;const p=cfg();if(!p.shift||!p.group||!p.cycle){state=null;render();return}
 loading=true;
 try{
  const data=await rpc('teacher_quarter_state',{p_shift:p.shift,p_group:p.group,p_cycle:p.cycle,p_quarter:p.quarter,p_subject:p.subject});
  state=data;
  const allStudents=await students();
  roster=(allStudents||[]).filter(s=>norm(s.shift)===norm(p.shift)&&norm(studentGroup(s))===norm(p.group)&&String(s.id)!=='00001').sort(sortRoster);
  if(!roster.some(s=>String(s.id)===String(activeStudent)))activeStudent=roster[0]?String(roster[0].id):'';
  render();
 }catch(e){const box=ensureUI();if(box)box.innerHTML='<h2>Evaluación trimestral</h2><p class="message bad">No se pudo cargar: '+esc(e.message||e)+'</p>'}
 finally{loading=false}
}
window.addEventListener('load',()=>{
 const btn=$('calculateQuarterBtn');if(btn)btn.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();load()},true);
 document.querySelector('[data-mettab="quarter"]')?.addEventListener('click',()=>setTimeout(load,100));
 ['quarterShift','quarterGroup','quarterNumber'].forEach(id=>$(id)?.addEventListener('change',()=>setTimeout(load,0)));
 $('quarterCycle')?.addEventListener('change',()=>setTimeout(load,0));
 setTimeout(()=>{if($('quarterCycle')&&!$('quarterCycle').value)$('quarterCycle').value='2026-2027';},300);
});
})();