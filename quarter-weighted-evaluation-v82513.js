/* Evaluación trimestral ponderada: Proyecto 35%, mensuales 30%, examen 22%, responsabilidad 13%. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state=null, roster=[], activeStudent='', activeProjectItem='', loading=false, saveTimer=null;
const norm=v=>String(v??'').trim().toLowerCase().replace(/[^a-z0-9]/g,'');
const schoolRound=v=>{const n=Math.max(0,Math.min(10,Number(v)||0)),b=Math.floor(n+1e-9);return Math.min(10,n-b>=.6-1e-9?b+1:b)};
function studentGroup(s){return s.group??s.group_name??''}
function displayName(s){return typeof window.studentListDisplayName==='function'?studentListDisplayName(s):(s.name||s.student_name||s.id)}
function sortRoster(a,b){return typeof window.compareStudentsForList==='function'?compareStudentsForList(a,b):Number(a.number??a.list_number??999)-Number(b.number??b.list_number??999)}
function cfg(){return {shift:$('quarterShift')?.value||'',group:$('quarterGroup')?.value||'',cycle:($('quarterCycle')?.value||'').trim(),quarter:$('quarterNumber')?.value||'1',subject:'Español'}}
function mxToday(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Mexico_City',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
function isLateItem(it){return !!it?.dueDate&&mxToday()>String(it.dueDate)}
function itemStatus(rec,it){
 const m=rec?.projectDeliveryStatus||{},id=String(it.id);
 if(m[id]==='on_time'||m[id]==='late')return m[id];
 return (rec?.projectDelivered||[]).map(String).includes(id)?'on_time':null;
}
function projectStatuses(rec,items){
 const out={};for(const it of items){const st=itemStatus(rec,it);if(st)out[String(it.id)]=st}return out;
}
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
 const rec=state?.evaluation?.records?.[sid]||{},items=state?.evaluation?.project_items||[],statuses=projectStatuses(rec,items);
 const delivered=new Set(Object.keys(statuses));
 const months=monthsForStudent(sid),monthlyAvg=months.length?months.reduce((a,b)=>a+b.value,0)/months.length:null;
 const fullShare=items.length?35/items.length:0;
 let projectPct=0,lateCount=0;
 for(const it of items){
   const st=statuses[String(it.id)];
   if(st==='on_time')projectPct+=fullShare;
   else if(st==='late'){projectPct+=fullShare*Number(it.lateFactor??(20/35));lateCount++}
 }
 const exam=rec.exam===''||rec.exam==null?null:Number(rec.exam),resp=rec.responsibility===''||rec.responsibility==null?null:Number(rec.responsibility);
 const monthlyContribution=monthlyAvg==null?0:monthlyAvg*.30,projectContribution=projectPct/10,examContribution=Number.isFinite(exam)?exam*.22:0,respContribution=Number.isFinite(resp)?resp*.13:0;
 const complete=monthlyAvg!=null&&items.length>0&&Number.isFinite(exam)&&Number.isFinite(resp);
 const finalDecimal=Math.min(10,monthlyContribution+projectContribution+examContribution+respContribution);
 return {rec,items,statuses,delivered,lateCount,months,monthlyAvg,projectPct,exam,resp,monthlyContribution,projectContribution,examContribution,respContribution,complete,finalDecimal,rounded:schoolRound(finalDecimal)}
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
 const items=state.evaluation?.project_items||[];
 if(!items.some(x=>String(x.id)===String(activeProjectItem)))activeProjectItem=items[0]?String(items[0].id):'';
 const student=roster.find(s=>String(s.id)===String(activeStudent))||roster[0];if(student)activeStudent=String(student.id);
 const c=student?calc(activeStudent):null;
 const activeItem=items.find(x=>String(x.id)===String(activeProjectItem));

 box.innerHTML='<h2>Evaluación trimestral</h2>'+
 '<div class="stats"><div><b>35%</b><span>Proyecto integrador</span></div><div><b>30%</b><span>Promedio mensual</span></div><div><b>22%</b><span>Examen trimestral</span></div><div><b>13%</b><span>Responsabilidad</span></div></div>'+
 '<div class="card" style="margin:12px 0"><h3>Registro rápido del Proyecto integrador</h3><p class="hint">Selecciona un trabajo y toca únicamente a los alumnos que lo entregaron. El registro se guarda al momento.</p>'+
 '<div id="quarterQuickItems" style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0">'+items.map((it,i)=>'<button type="button" class="'+(String(it.id)===String(activeProjectItem)?'primary':'secondary')+'" data-quick-item="'+esc(it.id)+'">'+(i+1)+'. '+esc(it.name)+'</button>').join('')+'</div>'+
 (activeItem?'<div class="hint" style="margin-bottom:10px"><b>'+esc(activeItem.name)+'</b> · Entrega en tiempo hasta '+esc(activeItem.dueDate||'hoy')+'. Después se registra automáticamente como extemporánea.</div>':'')+
 '<div id="quarterQuickRoster" class="quarter-quick-grid">'+(activeItem?roster.map(s=>{const cc=calc(String(s.id)),st=cc.statuses[String(activeItem.id)]||'',label=st==='on_time'?'✓ Entregado en tiempo':st==='late'?'✓ Entregado extemporáneo':'Pendiente';return '<button type="button" class="quarter-person '+(st==='on_time'?'quarter-done':st==='late'?'quarter-late':'')+'" data-quick-student="'+esc(s.id)+'"><b>'+esc((s.number??s.list_number??'')+'. '+displayName(s))+'</b><span>'+label+'</span></button>'}).join(''):'<p class="hint">No hay trabajos cargados.</p>')+'</div><p id="quarterQuickStatus" class="hint"></p></div>'+
 '<div class="card" style="margin:12px 0"><h3>Trabajos del Proyecto integrador</h3><p class="hint">Todos los trabajos entregados en tiempo se reparten el 35%. Los extemporáneos conservan un valor reducido equivalente al 20% total si todo se entregara tarde.</p><textarea id="quarterItemsText" rows="5" placeholder="Trabajo 1\nTrabajo 2\nTrabajo 3">'+esc(items.map(x=>x.name).join('\n'))+'</textarea><div class="actions"><button id="quarterSaveItems" class="secondary" type="button">Guardar nombres de trabajos</button></div><p id="quarterItemsStatus" class="hint"></p></div>'+
 (roster.length?'<label>Alumno<select id="quarterStudent">'+roster.map(s=>'<option value="'+esc(s.id)+'" '+(String(s.id)===String(activeStudent)?'selected':'')+'>'+esc((s.number??s.list_number??'')+' · '+displayName(s))+'</option>').join('')+'</select></label>':'<p>No hay alumnos en este grupo.</p>')+
 (student?'<div class="card" style="margin-top:12px"><h3>'+esc(displayName(student))+'</h3>'+
 '<div class="grid2"><div><b>Promedio mensual · 30%</b><p>'+(c.monthlyAvg==null?'Pendiente de cerrar evaluaciones mensuales':c.monthlyAvg.toFixed(2)+' → aporta '+c.monthlyContribution.toFixed(2)+' puntos')+'</p><small>'+esc(c.months.map(x=>x.month+': '+x.value.toFixed(1)).join(' · ')||'Sin meses cerrados')+'</small></div>'+
 '<div><b>Proyecto integrador · 35%</b><p>'+c.delivered.size+' de '+c.items.length+' trabajos'+(c.lateCount?' · '+c.lateCount+' extemporáneo'+(c.lateCount===1?'':'s'):'')+' → '+c.projectPct.toFixed(2)+' / 35%</p></div></div>'+
 '<h3>Trabajos entregados</h3><div id="quarterProjectChecklist" class="quarter-project-buttons">'+(c.items.length?c.items.map((it,i)=>{const st=c.statuses[String(it.id)]||'',share=35/c.items.length,earned=st==='on_time'?share:st==='late'?share*Number(it.lateFactor??(20/35)):0;return '<button type="button" class="quarter-work '+(st==='on_time'?'quarter-done':st==='late'?'quarter-late':'')+'" data-project-item="'+esc(it.id)+'"><b>'+(i+1)+'. '+esc(it.name)+'</b><span>'+(st==='on_time'?'✓ En tiempo · '+earned.toFixed(2)+' pts':st==='late'?'✓ Extemporáneo · '+earned.toFixed(2)+' pts':'Pendiente')+'</span></button>'}).join(''):'<p class="hint">Primero guarda los trabajos que integran el proyecto.</p>')+'</div>'+
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
async function saveRecord(statusOverride=null){
 if(!activeStudent||!state)return;
 const c=calc(activeStudent),examEl=$('quarterExam'),respEl=$('quarterResponsibility');
 const exam=examEl?.value===''?null:Number(examEl?.value),responsibility=respEl?.value===''?null:Number(respEl?.value);
 if(exam!=null&&(exam<0||exam>10)||responsibility!=null&&(responsibility<0||responsibility>10)){if($('quarterSaveStatus'))$('quarterSaveStatus').textContent='Las calificaciones deben estar entre 0 y 10.';return}
 const statuses=statusOverride||c.statuses,delivered=Object.keys(statuses);
 const p=cfg();if($('quarterSaveStatus'))$('quarterSaveStatus').textContent='Guardando…';
 const out=await rpc('teacher_save_quarter_record',{p_shift:p.shift,p_group:p.group,p_cycle:p.cycle,p_quarter:p.quarter,p_student_id:activeStudent,p_record:{projectDelivered:delivered,projectDeliveryStatus:statuses,exam,responsibility},p_subject:p.subject});
 state.evaluation=out.evaluation;render();
}
async function toggleProjectForStudent(studentId,itemId,fromQuick=false){
 const items=state?.evaluation?.project_items||[],it=items.find(x=>String(x.id)===String(itemId));if(!it)return;
 const rec=state?.evaluation?.records?.[studentId]||{},statuses=projectStatuses(rec,items),old=statuses[String(itemId)];
 if(old){delete statuses[String(itemId)]}
 else statuses[String(itemId)]=isLateItem(it)?'late':'on_time';
 const exam=rec.exam??null,responsibility=rec.responsibility??null,p=cfg(),target=fromQuick?$('quarterQuickStatus'):$('quarterSaveStatus');
 if(target)target.textContent='Guardando…';
 const out=await rpc('teacher_save_quarter_record',{p_shift:p.shift,p_group:p.group,p_cycle:p.cycle,p_quarter:p.quarter,p_student_id:String(studentId),p_record:{projectDelivered:Object.keys(statuses),projectDeliveryStatus:statuses,exam,responsibility},p_subject:p.subject});
 state.evaluation=out.evaluation;
 if(target)target.textContent=old?'Registro retirado.':(statuses[String(itemId)]==='late'?'✓ Entrega registrada como extemporánea.':'✓ Entrega registrada en tiempo.');
 render();
}
function scheduleSave(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>saveRecord().catch(e=>{if($('quarterSaveStatus'))$('quarterSaveStatus').textContent=e.message||e}),250)}
function bind(){
 const st=$('quarterStudent');if(st)st.onchange=()=>{activeStudent=st.value;render()};
 document.querySelectorAll('[data-quick-item]').forEach(b=>b.onclick=()=>{activeProjectItem=b.dataset.quickItem;render()});
 document.querySelectorAll('[data-quick-student]').forEach(b=>b.onclick=()=>toggleProjectForStudent(b.dataset.quickStudent,activeProjectItem,true).catch(e=>{if($('quarterQuickStatus'))$('quarterQuickStatus').textContent=e.message||e}));
 document.querySelectorAll('[data-project-item]').forEach(b=>b.onclick=()=>toggleProjectForStudent(activeStudent,b.dataset.projectItem,false).catch(e=>{if($('quarterSaveStatus'))$('quarterSaveStatus').textContent=e.message||e}));
 if($('quarterExam'))$('quarterExam').onchange=scheduleSave;
 if($('quarterResponsibility'))$('quarterResponsibility').onchange=scheduleSave;
 if($('quarterSaveItems'))$('quarterSaveItems').onclick=async()=>{
  const names=($('quarterItemsText').value||'').split(/\n+/).map(x=>x.trim()).filter(Boolean);
  const old=state.evaluation?.project_items||[];
  const items=names.map((name,i)=>({id:'item-'+(i+1),name,dueDate:old[i]?.dueDate||mxToday(),lateFactor:Number(old[i]?.lateFactor??(20/35))}));
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
 if(!document.getElementById('quarterQuickStyles')){const st=document.createElement('style');st.id='quarterQuickStyles';st.textContent='#quarterWeightedPanel .quarter-quick-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:8px}#quarterWeightedPanel .quarter-person,#quarterWeightedPanel .quarter-work{width:100%;text-align:left;display:flex;flex-direction:column;gap:6px;padding:13px;border-radius:12px;background:#fff1e9;border:1px solid #ddc8bb;color:#4a3024}#quarterWeightedPanel .quarter-person.quarter-done,#quarterWeightedPanel .quarter-work.quarter-done{background:#e4f4e8;border-color:#98c8a4;color:#1a5e36}#quarterWeightedPanel .quarter-person.quarter-late,#quarterWeightedPanel .quarter-work.quarter-late{background:#fff3cd;border-color:#d9b968;color:#725500}#quarterWeightedPanel .quarter-person span,#quarterWeightedPanel .quarter-work span{font-size:.85em}#quarterWeightedPanel .quarter-project-buttons{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:8px;margin-bottom:14px}';document.head.appendChild(st)}

 const btn=$('calculateQuarterBtn');if(btn)btn.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();load()},true);
 document.querySelector('[data-mettab="quarter"]')?.addEventListener('click',()=>setTimeout(load,100));
 ['quarterShift','quarterGroup','quarterNumber'].forEach(id=>$(id)?.addEventListener('change',()=>setTimeout(load,0)));
 $('quarterCycle')?.addEventListener('change',()=>setTimeout(load,0));
 setTimeout(()=>{if($('quarterCycle')&&!$('quarterCycle').value)$('quarterCycle').value='2026-2027';},300);
});
})();