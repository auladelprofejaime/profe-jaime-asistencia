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
 if(m[id]==='on_time'||m[id]==='late'||m[id]==='justified')return m[id];
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
   if(st==='on_time'||st==='justified')projectPct+=fullShare;
   else if(st==='late'){projectPct+=fullShare*Number(it.lateFactor??(20/35));lateCount++}
 }
 const exam=rec.exam===''||rec.exam==null?null:Number(rec.exam),resp=rec.responsibility===''||rec.responsibility==null?null:Number(rec.responsibility);
 const monthlyContribution=monthlyAvg==null?0:monthlyAvg*.30,projectContribution=projectPct/10,examContribution=Number.isFinite(exam)?exam*.22:0,respContribution=Number.isFinite(resp)?resp*.13:0;
 const complete=monthlyAvg!=null&&items.length>0&&Number.isFinite(exam)&&Number.isFinite(resp);
 const quarterPoints=Number(state?.quarter_points?.[sid]||0);
 const baseDecimal=Math.min(10,monthlyContribution+projectContribution+examContribution+respContribution);
 const finalDecimal=Math.min(10,baseDecimal+quarterPoints);
 return {rec,items,statuses,delivered,lateCount,months,monthlyAvg,projectPct,exam,resp,monthlyContribution,projectContribution,examContribution,respContribution,quarterPoints,baseDecimal,complete,finalDecimal,rounded:schoolRound(finalDecimal)}
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

 const studentStrip=roster.length
   ? '<div class="quarter-student-strip">'+roster.map(s=>'<button type="button" class="'+(String(s.id)===String(activeStudent)?'primary':'secondary')+'" data-quick-student-select="'+esc(s.id)+'">'+esc((s.number??s.list_number??'')+'. '+displayName(s))+'</button>').join('')+'</div>'
   : '';

 const projectButtons=(student&&c)
   ? '<div style="margin-top:14px"><h4 style="margin-bottom:8px">'+esc(displayName(student))+'</h4>'+
     '<button type="button" id="quarterJustificationBtn" class="'+(c.rec?.projectJustified?'primary':'secondary')+'" style="margin-bottom:10px">'+(c.rec?.projectJustified?'✓ Justificante presentado':'Justificante presentado')+'</button>'+
     '<div class="quarter-project-buttons">'+items.map((it,i)=>{
       const st=c.statuses[String(it.id)]||'',share=items.length?35/items.length:0;
       const earned=(st==='on_time'||st==='justified')?share:st==='late'?share*Number(it.lateFactor??(20/35)):0;
       return '<button type="button" class="quarter-work '+((st==='on_time'||st==='justified')?'quarter-done':st==='late'?'quarter-late':'')+'" data-project-item="'+esc(it.id)+'">'+
         '<b>'+(i+1)+'. '+esc(it.name)+'</b>'+
         '<span>'+(st==='on_time'?'✓ En tiempo · '+earned.toFixed(2)+' pts':st==='justified'?'✓ Extemporáneo justificado · valor completo':st==='late'?'✓ Extemporáneo sin justificante · '+earned.toFixed(2)+' pts':'Pendiente')+'</span></button>';
     }).join('')+'</div><p id="quarterQuickStatus" class="hint"></p></div>'
   : '';

 const studentSelect=roster.length
   ? '<label>Alumno<select id="quarterStudent">'+roster.map(s=>'<option value="'+esc(s.id)+'" '+(String(s.id)===String(activeStudent)?'selected':'')+'>'+esc((s.number??s.list_number??'')+' · '+displayName(s))+'</option>').join('')+'</select></label>'
   : '<p>No hay alumnos en este grupo.</p>';

 const studentDetail=(student&&c)
   ? '<div class="card" style="margin-top:12px"><h3>'+esc(displayName(student))+'</h3>'+
     '<div class="grid2"><div><b>Promedio mensual · 30%</b><p>'+(c.monthlyAvg==null?'Pendiente de evaluaciones mensuales':c.monthlyAvg.toFixed(2)+' → aporta '+c.monthlyContribution.toFixed(2)+' puntos')+'</p>'+
     '<small>'+esc(c.months.map(x=>x.month+': '+x.value.toFixed(1)).join(' · ')||'Sin meses disponibles')+'</small></div>'+
     '<div><b>Proyecto integrador · 35%</b><p>'+c.delivered.size+' de '+c.items.length+' trabajos'+(c.lateCount?' · '+c.lateCount+' extemporáneo'+(c.lateCount===1?'':'s'):'')+' → '+c.projectPct.toFixed(2)+' / 35%</p></div></div>'+
     '<h3>Trabajos entregados</h3><p class="hint">Regístralos arriba, en el apartado rápido por alumno.</p>'+
     '<div class="grid2"><label>Examen trimestral · 22%<input id="quarterExam" type="number" min="0" max="10" step="0.1" value="'+(Number.isFinite(c.exam)?c.exam:'')+'" placeholder="0 a 10"></label>'+
     '<label>Responsabilidad escolar · 13%<input id="quarterResponsibility" type="number" min="0" max="10" step="0.1" value="'+(Number.isFinite(c.resp)?c.resp:'')+'" placeholder="0 a 10"></label></div>'+
     (c.quarterPoints>0?'<div class="card" style="margin-top:12px"><b>Beneficio Mérito Gabino A. Palma</b><p>+'+c.quarterPoints.toFixed(2)+' puntos del saldo aplicados directamente a la calificación trimestral.</p></div>':'')+
     '<div class="percentage-total" style="margin-top:12px">Resultado actual: <strong>'+c.finalDecimal.toFixed(2)+'</strong> / 10 · Calificación: <strong>'+(c.complete?c.rounded:'Pendiente')+'</strong></div>'+
     '<p id="quarterSaveStatus" class="hint">'+(c.complete?'Todos los criterios capturados.':'Faltan datos para cerrar la calificación.')+'</p></div>'
   : '';

 box.innerHTML=
   '<h2>Evaluación trimestral</h2>'+
   '<div class="stats"><div><b>35%</b><span>Proyecto integrador</span></div><div><b>30%</b><span>Promedio mensual</span></div><div><b>22%</b><span>Examen trimestral</span></div><div><b>13%</b><span>Responsabilidad</span></div></div>'+
   '<div class="card" style="margin:12px 0"><h3>Registro rápido del Proyecto integrador</h3><p class="hint">Revisa un folder por alumno. Selecciona al alumno y toca únicamente los trabajos que entregó.</p>'+
   studentStrip+projectButtons+'</div>'+
   '<div class="card" style="margin:12px 0"><h3>Trabajos del Proyecto integrador</h3><p class="hint">Todos los trabajos entregados en tiempo se reparten el 35%. Los extemporáneos conservan un valor reducido equivalente al 20% total si todo se entregara tarde.</p>'+
   '<textarea id="quarterItemsText" rows="5" placeholder="Trabajo 1\nTrabajo 2\nTrabajo 3">'+esc(items.map(x=>x.name).join('\n'))+'</textarea>'+
   '<div class="actions"><button id="quarterSaveItems" class="secondary" type="button">Guardar nombres de trabajos</button></div><p id="quarterItemsStatus" class="hint"></p></div>'+
   studentSelect+studentDetail;
 bind();
 renderSummary();
}
function renderSummary(){
 const out=$('quarterResults');if(!out||!state)return;
 if(!roster.length){out.innerHTML='<div class="empty">No hay alumnos.</div>';return}
 out.innerHTML='<table><thead><tr><th>No.</th><th>Alumno</th><th>Mensual 30%</th><th>Proyecto 35%</th><th>Examen 22%</th><th>Resp. 13%</th><th>Puntos trimestre</th><th>Final</th></tr></thead><tbody>'+
 roster.map(s=>{const c=calc(String(s.id));return '<tr><td>'+esc(s.number??s.list_number??'')+'</td><td>'+esc(displayName(s))+'</td><td>'+(c.monthlyAvg==null?'—':c.monthlyAvg.toFixed(2))+'</td><td>'+c.projectPct.toFixed(2)+'%</td><td>'+(Number.isFinite(c.exam)?c.exam.toFixed(1):'—')+'</td><td>'+(Number.isFinite(c.resp)?c.resp.toFixed(1):'—')+'</td><td>'+(c.quarterPoints?('+'+c.quarterPoints.toFixed(2)):'0.00')+'</td><td><b>'+(c.complete?c.rounded:'—')+'</b></td></tr>'}).join('')+
 '</tbody></table>';
}
async function saveRecord(statusOverride=null){
 if(!activeStudent||!state)return;
 const c=calc(activeStudent),examEl=$('quarterExam'),respEl=$('quarterResponsibility');
 const exam=examEl?.value===''?null:Number(examEl?.value),responsibility=respEl?.value===''?null:Number(respEl?.value);
 if(exam!=null&&(exam<0||exam>10)||responsibility!=null&&(responsibility<0||responsibility>10)){if($('quarterSaveStatus'))$('quarterSaveStatus').textContent='Las calificaciones deben estar entre 0 y 10.';return}
 const statuses=statusOverride||c.statuses,delivered=Object.keys(statuses);
 const p=cfg();if($('quarterSaveStatus'))$('quarterSaveStatus').textContent='Guardando…';
 const out=await rpc('teacher_save_quarter_record',{p_shift:p.shift,p_group:p.group,p_cycle:p.cycle,p_quarter:p.quarter,p_student_id:activeStudent,p_record:{projectDelivered:delivered,projectDeliveryStatus:statuses,projectJustified:!!c.rec?.projectJustified,exam,responsibility},p_subject:p.subject});
 state.evaluation=out.evaluation;render();
}
async function toggleProjectForStudent(studentId,itemId,fromQuick=false){
 const items=state?.evaluation?.project_items||[],it=items.find(x=>String(x.id)===String(itemId));if(!it)return;
 const rec=state?.evaluation?.records?.[studentId]||{},statuses=projectStatuses(rec,items),old=statuses[String(itemId)];
 if(old){delete statuses[String(itemId)]}
 else statuses[String(itemId)]=isLateItem(it)?(rec.projectJustified?'justified':'late'):'on_time';
 const exam=rec.exam??null,responsibility=rec.responsibility??null,p=cfg(),target=fromQuick?$('quarterQuickStatus'):$('quarterSaveStatus');
 if(target)target.textContent='Guardando…';
 const out=await rpc('teacher_save_quarter_record',{p_shift:p.shift,p_group:p.group,p_cycle:p.cycle,p_quarter:p.quarter,p_student_id:String(studentId),p_record:{projectDelivered:Object.keys(statuses),projectDeliveryStatus:statuses,projectJustified:!!rec.projectJustified,exam,responsibility},p_subject:p.subject});
 state.evaluation=out.evaluation;
 if(target)target.textContent=old?'Registro retirado.':(statuses[String(itemId)]==='late'?'✓ Entrega registrada como extemporánea.':'✓ Entrega registrada en tiempo.');
 render();
}
async function toggleProjectJustification(){
 if(!activeStudent||!state)return;
 const items=state?.evaluation?.project_items||[],rec=state?.evaluation?.records?.[activeStudent]||{},statuses=projectStatuses(rec,items);
 const next=!rec.projectJustified;
 for(const id of Object.keys(statuses)){
   if(next&&statuses[id]==='late')statuses[id]='justified';
   else if(!next&&statuses[id]==='justified')statuses[id]='late';
 }
 const p=cfg();
 if($('quarterQuickStatus'))$('quarterQuickStatus').textContent='Guardando justificante…';
 const out=await rpc('teacher_save_quarter_record',{p_shift:p.shift,p_group:p.group,p_cycle:p.cycle,p_quarter:p.quarter,p_student_id:activeStudent,p_record:{projectDelivered:Object.keys(statuses),projectDeliveryStatus:statuses,projectJustified:next,exam:rec.exam??null,responsibility:rec.responsibility??null},p_subject:p.subject});
 state.evaluation=out.evaluation;render();
}
function scheduleSave(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>saveRecord().catch(e=>{if($('quarterSaveStatus'))$('quarterSaveStatus').textContent=e.message||e}),250)}
function bind(){
 const st=$('quarterStudent');if(st)st.onchange=()=>{activeStudent=st.value;render()};
 document.querySelectorAll('[data-quick-student-select]').forEach(b=>b.onclick=()=>{activeStudent=b.dataset.quickStudentSelect;render()});
 document.querySelectorAll('[data-project-item]').forEach(b=>b.onclick=()=>toggleProjectForStudent(activeStudent,b.dataset.projectItem,true).catch(e=>{if($('quarterQuickStatus'))$('quarterQuickStatus').textContent=e.message||e}));
 if($('quarterJustificationBtn'))$('quarterJustificationBtn').onclick=()=>toggleProjectJustification().catch(e=>{if($('quarterQuickStatus'))$('quarterQuickStatus').textContent=e.message||e});
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

function qpdfStatus(t){
 let el=$('quarterPdfStatus');
 if(!el){el=document.createElement('p');el.id='quarterPdfStatus';el.className='hint';$('quarterResults')?.before(el)}
 if(el)el.textContent=t||'';
}
function recordKey(r){return r?.key||((r?.activityId||r?.activity_id)+'|'+(r?.studentId||r?.student_id))}
function activityName(a){return a?.name||a?.title||'Actividad'}
function activityMode(a){return a?.evaluationMode||a?.evaluation_type||'delivery'}
function monthDataFromRow(row){return {...(row?.data||{}),id:row.id,month:row.month,group:row.group_name,shift:row.shift,cycle:row.cycle,quarter:row.quarter,closed:row.closed}}
function monthlyCriterionModel(m,sid,acts,recMap){
 const criteria=m.criteria||[],assigned=m.assignments||{},out=[];
 for(const c of criteria){
   const ca=acts.filter(a=>assigned[a.id]===c.id&&(!window.StudentEvaluationRange||StudentEvaluationRange.applicable(m,sid,a)));
   let total=ca.length,done=0,sum=0;
   const details=ca.map(a=>{
     const r=recMap.get(a.id+'|'+sid),mode=activityMode(a);
     let delivered=false,value=0,label='No entregado';
     if(mode==='numeric'){
       delivered=typeof r?.score==='number';
       value=delivered?Number(r.score):0;
       label=delivered?('Calificación '+Number(r.score).toFixed(1)):'Sin calificación';
     }else{
       delivered=r?.status==='yes'||r?.delivered===true;
       value=delivered?10:0;
       label=delivered?'Entregado':'No entregado';
     }
     if(delivered)done++;
     sum+=value;
     return {name:activityName(a),delivered,label,value,criterion:c.name||'Criterio'};
   });
   out.push({criterion:c,grade:total?sum/total:null,total,done,missing:total-done,details});
 }
 return out;
}
async function generateQuarterPdf(){
 if(!state||!roster.length){qpdfStatus('Primero selecciona el grupo y pulsa Calcular trimestre.');return}
 if(!window.jspdf?.jsPDF){qpdfStatus('No está disponible el generador de PDF. Recarga la app y vuelve a intentar.');return}
 const btn=$('quarterPdfBtn'),old=btn?.textContent;if(btn){btn.disabled=true;btn.textContent='Generando PDF…'}
 qpdfStatus('Preparando reporte trimestral detallado…');
 try{
   const p=cfg();
   const methRows=await ProfeSupabase.select('methodologies','select=*&shift=eq.'+encodeURIComponent(p.shift)+'&group_name=eq.'+encodeURIComponent(p.group)+'&cycle=eq.'+encodeURIComponent(p.cycle)+'&quarter=eq.'+encodeURIComponent(p.quarter)+'&subject=eq.'+encodeURIComponent(p.subject));
   const months=(methRows||[]).map(monthDataFromRow).filter(m=>['Septiembre','Octubre'].includes(m.month)).sort((a,b)=>['Septiembre','Octubre'].indexOf(a.month)-['Septiembre','Octubre'].indexOf(b.month));
   if(!months.length)throw Error('No se encontraron las evaluaciones de septiembre y octubre para este grupo.');
   const acts=await all('activities');
   const recs=await all('activityRecords');
   const recMap=new Map((recs||[]).map(r=>[recordKey(r),r]));
   const {jsPDF}=window.jspdf;
   const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'letter'});
   const pageW=doc.internal.pageSize.getWidth(),pageH=doc.internal.pageSize.getHeight();
   const margin=12;
   const addHeader=(student,c,continuation=false)=>{
     doc.setFont('helvetica','bold');doc.setFontSize(15);doc.text('Reporte trimestral de Español',margin,14);
     doc.setFont('helvetica','normal');doc.setFontSize(9);
     doc.text('Ciclo '+p.cycle+' · Primer trimestre · Grupo '+p.group+(continuation?' · Continuación':''),margin,20);
     doc.setFont('helvetica','bold');doc.setFontSize(11);doc.text((student.number??student.list_number??'')+'. '+displayName(student),margin,27);
     doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.text('Ponderación trimestral: mensual 30% · proyecto integrador 35% · examen 22% · responsabilidad 13%',margin,32);
     return 37;
   };
   const footer=()=>{doc.setFontSize(7.5);doc.setTextColor(90);doc.text('Reporte generado desde la App Docente · '+new Date().toLocaleDateString('es-MX'),margin,pageH-7);doc.setTextColor(0)};
   const ensureSpace=(y,need,student,c)=>{if(y+need>pageH-15){footer();doc.addPage();return addHeader(student,c,true)}return y};

   roster.forEach((student,si)=>{
     if(si>0)doc.addPage();
     const sid=String(student.id),c=calc(sid);
     let y=addHeader(student,c,false);

     for(const m of months){
       y=ensureSpace(y,34,student,c);
       const gm=m.gradeRecords?.[sid]||{};
       const finalMonth=Number(gm.monthlyGrade??gm.rounded??gm.finalDecimal??gm.obtainedAverage);
       doc.setFillColor(238,243,248);doc.rect(margin,y-4,pageW-margin*2,8,'F');
       doc.setFont('helvetica','bold');doc.setFontSize(10.5);doc.text(m.month+' · '+(m.closed?'Mes cerrado':'Mes aún abierto'),margin+2,y+1);
       doc.setFont('helvetica','normal');doc.setFontSize(8.5);
       doc.text('Calificación mensual: '+(Number.isFinite(finalMonth)?finalMonth.toFixed(1):'Pendiente'),pageW-margin-2,y+1,{align:'right'});
       y+=8;

       const cm=monthlyCriterionModel(m,sid,acts,recMap);
       const critRows=cm.map(x=>[
         (x.criterion.name||'Criterio')+' ('+Number(x.criterion.percent||0)+'%)',
         x.grade==null?'—':x.grade.toFixed(2),
         x.done+' / '+x.total,
         x.missing?x.missing+' pendiente'+(x.missing===1?'':'s'):'Completo'
       ]);
       doc.autoTable({startY:y,head:[['Criterio','Calif.','Entregadas','Pendientes']],body:critRows,margin:{left:margin,right:margin},styles:{fontSize:7.5,cellPadding:1.5},headStyles:{fillColor:[20,48,86]},theme:'grid'});
       y=doc.lastAutoTable.finalY+3;

       const detailRows=[];
       for(const x of cm)for(const d of x.details)detailRows.push([x.criterion.name||'Criterio',d.name,d.label]);
       doc.autoTable({startY:y,head:[['Criterio','Actividad','Estado / resultado']],body:detailRows,margin:{left:margin,right:margin},styles:{fontSize:6.8,cellPadding:1.2},headStyles:{fillColor:[74,91,117]},columnStyles:{0:{cellWidth:40},2:{cellWidth:38}},theme:'grid',didDrawPage:()=>{}});
       y=doc.lastAutoTable.finalY+3;

       const missing=cm.flatMap(x=>x.details.filter(d=>!d.delivered).map(d=>d.name));
       y=ensureSpace(y,14,student,c);
       doc.setFontSize(7.5);doc.setFont('helvetica','bold');doc.text('Actividades pendientes:',margin,y);
       doc.setFont('helvetica','normal');
       const missText=missing.length?missing.join(' · '):'Ninguna.';
       const lines=doc.splitTextToSize(missText,pageW-margin*2);
       doc.text(lines,margin,y+4);y+=5+lines.length*3.2;
     }

     y=ensureSpace(y,34,student,c);
     doc.setFillColor(231,246,236);doc.rect(margin,y-4,pageW-margin*2,8,'F');
     doc.setFont('helvetica','bold');doc.setFontSize(10.5);doc.text('Proyecto integrador · 35%',margin+2,y+1);y+=8;
     const projectRows=c.items.map((it,i)=>{
       const st=c.statuses[String(it.id)]||'';
       const full=35/c.items.length;
       const earned=(st==='on_time'||st==='justified')?full:st==='late'?full*Number(it.lateFactor??(20/35)):0;
       let label='No entregado';
       if(st==='on_time')label='Entregado en tiempo';
       if(st==='justified')label='Extemporáneo con justificante · valor completo';
       if(st==='late')label='Extemporáneo sin justificante · valor reducido';
       return [(i+1)+'. '+it.name,label,earned.toFixed(2)+' / '+full.toFixed(2)];
     });
     doc.autoTable({startY:y,head:[['Trabajo','Estado','Valor dentro del 35%']],body:projectRows,margin:{left:margin,right:margin},styles:{fontSize:7.4,cellPadding:1.5},headStyles:{fillColor:[32,94,65]},columnStyles:{2:{cellWidth:36}},theme:'grid'});
     y=doc.lastAutoTable.finalY+3;
     if(c.lateCount){
       y=ensureSpace(y,14,student,c);doc.setFontSize(7.3);doc.setFont('helvetica','normal');
       const note='Nota: los trabajos marcados como extemporáneos sin justificante aplican la regla de entrega tardía: el proyecto completo tendría un valor máximo de 20% en lugar de 35%; cada trabajo recibe la parte proporcional de ese 20%.';
       const lines=doc.splitTextToSize(note,pageW-margin*2);doc.text(lines,margin,y);y+=lines.length*3.2+2;
     }
     if(c.rec?.projectJustified){
       y=ensureSpace(y,10,student,c);doc.setFontSize(7.3);
       const lines=doc.splitTextToSize('Se presentó justificante. Las entregas extemporáneas justificadas conservan el valor completo que les corresponde dentro del 35%.',pageW-margin*2);doc.text(lines,margin,y);y+=lines.length*3.2+2;
     }

     y=ensureSpace(y,34,student,c);
     doc.setFillColor(244,246,249);doc.rect(margin,y-4,pageW-margin*2,8,'F');
     doc.setFont('helvetica','bold');doc.setFontSize(10.5);doc.text('Resumen del trimestre',margin+2,y+1);y+=8;
     const monthlyLabel=c.months.length?c.months.map(x=>x.month+': '+x.value.toFixed(1)).join(' · '):'Sin meses cerrados';
     const summaryRows=[
       ['Promedio mensual · 30%',c.monthlyAvg==null?'Pendiente':c.monthlyAvg.toFixed(2),c.monthlyContribution.toFixed(2)+' pts',monthlyLabel],
       ['Proyecto integrador · 35%',c.projectPct.toFixed(2)+' / 35',c.projectContribution.toFixed(2)+' pts',c.delivered.size+' de '+c.items.length+' trabajos registrados'],
       ['Examen trimestral · 22%',Number.isFinite(c.exam)?c.exam.toFixed(1):'Pendiente',c.examContribution.toFixed(2)+' pts',''],
       ['Responsabilidad escolar · 13%',Number.isFinite(c.resp)?c.resp.toFixed(1):'Pendiente',c.respContribution.toFixed(2)+' pts',''],
       ['Beneficio Mérito · puntos al trimestre',c.quarterPoints?('+'+c.quarterPoints.toFixed(2)):'0.00',c.quarterPoints.toFixed(2)+' pts',c.quarterPoints?'Descontados del saldo general · máximo 3 puntos para grupo 22':'Sin puntos aplicados']
     ];
     doc.autoTable({startY:y,head:[['Componente','Resultado','Aporte','Detalle']],body:summaryRows,margin:{left:margin,right:margin},styles:{fontSize:7.5,cellPadding:1.5},headStyles:{fillColor:[20,48,86]},theme:'grid'});
     y=doc.lastAutoTable.finalY+5;
     doc.setFont('helvetica','bold');doc.setFontSize(12);
     doc.text('Calificación trimestral: '+(c.complete?c.rounded:'Pendiente')+(c.complete?'  ('+c.finalDecimal.toFixed(2)+' sin redondear)':''),margin,y);
     footer();
   });

   doc.save('Reporte_trimestral_'+p.group+'_'+p.cycle+'.pdf');
   qpdfStatus('PDF trimestral generado con detalle de septiembre, octubre y proyecto integrador.');
 }catch(e){
   console.error('PDF trimestral',e);qpdfStatus('No se pudo generar el PDF: '+(e.message||e));
 }finally{if(btn){btn.disabled=false;btn.textContent=old||'Generar PDF'}}
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
 if(!document.getElementById('quarterQuickStyles')){const st=document.createElement('style');st.id='quarterQuickStyles';st.textContent='#quarterWeightedPanel .quarter-student-strip{display:flex;gap:8px;overflow-x:auto;padding:4px 0 8px;scrollbar-width:thin}#quarterWeightedPanel .quarter-person,#quarterWeightedPanel .quarter-work{width:100%;text-align:left;display:flex;flex-direction:column;gap:6px;padding:13px;border-radius:12px;background:#fff1e9;border:1px solid #ddc8bb;color:#4a3024}#quarterWeightedPanel .quarter-person.quarter-done,#quarterWeightedPanel .quarter-work.quarter-done{background:#e4f4e8;border-color:#98c8a4;color:#1a5e36}#quarterWeightedPanel .quarter-person.quarter-late,#quarterWeightedPanel .quarter-work.quarter-late{background:#fff3cd;border-color:#d9b968;color:#725500}#quarterWeightedPanel .quarter-person span,#quarterWeightedPanel .quarter-work span{font-size:.85em}#quarterWeightedPanel .quarter-project-buttons{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:8px;margin-bottom:14px}';document.head.appendChild(st)}

 const btn=$('calculateQuarterBtn');if(btn)btn.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();load()},true);
 const pdfBtn=$('quarterPdfBtn');if(pdfBtn)pdfBtn.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();generateQuarterPdf()},true);
 document.querySelector('[data-mettab="quarter"]')?.addEventListener('click',()=>setTimeout(load,100));
 ['quarterShift','quarterGroup','quarterNumber'].forEach(id=>$(id)?.addEventListener('change',()=>setTimeout(load,0)));
 $('quarterCycle')?.addEventListener('change',()=>setTimeout(load,0));
 setTimeout(()=>{if($('quarterCycle')&&!$('quarterCycle').value)$('quarterCycle').value='2026-2027';},300);
});
})();