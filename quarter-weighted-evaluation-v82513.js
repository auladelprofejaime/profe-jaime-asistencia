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
 qpdfStatus('Preparando reporte trimestral en formato institucional…');
 try{
   const p=cfg();
   const methRows=await ProfeSupabase.select('methodologies','select=*&shift=eq.'+encodeURIComponent(p.shift)+'&group_name=eq.'+encodeURIComponent(p.group)+'&cycle=eq.'+encodeURIComponent(p.cycle)+'&quarter=eq.'+encodeURIComponent(p.quarter)+'&subject=eq.'+encodeURIComponent(p.subject));
   const monthOrder=['Septiembre','Octubre'];
   const months=(methRows||[]).map(monthDataFromRow).filter(m=>monthOrder.includes(m.month)).sort((x,y)=>monthOrder.indexOf(x.month)-monthOrder.indexOf(y.month));
   if(!months.length)throw Error('No se encontraron las evaluaciones de septiembre y octubre para este grupo.');

   const acts=await all('activities');
   const recs=await all('activityRecords');
   const recMap=new Map((recs||[]).map(r=>[recordKey(r),r]));
   const {jsPDF}=window.jspdf;
   const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'letter'});
   const pageW=doc.internal.pageSize.getWidth(),pageH=doc.internal.pageSize.getHeight();
   const margin=12,gap=7,colW=(pageW-margin*2-gap)/2;
   const yellow=[245,196,0],dark=[33,27,18],red=[181,30,45],light=[247,247,247],green=[27,159,89];

   const fallbackHeader=(student)=>{
     doc.setFillColor(...yellow);doc.rect(0,0,pageW,4,'F');
     doc.setFont('helvetica','bold');doc.setTextColor(...dark);doc.setFontSize(15);doc.text('Reporte trimestral de Español',margin,14);
     doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.text('Profesor: Jaime Armando Pérez Vázquez',margin,19);
     doc.setTextColor(...red);doc.setFont('helvetica','bold');doc.setFontSize(7.5);doc.text('ESPAÑOL',margin,24);
     doc.setDrawColor(...red);doc.setLineWidth(.7);doc.line(margin,27,pageW-margin,27);
     doc.setTextColor(0);doc.setFontSize(8.5);
     doc.text('Turno: '+p.shift+'    Grupo: '+p.group+'    Ciclo: '+p.cycle+'    Primer trimestre',margin,33);
     doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text((student.number??student.list_number??'')+'. '+displayName(student),margin,39);
     return 44;
   };
   const header=(student)=>{
     if(typeof pdfHeader==='function'){
       pdfHeader(doc,'Reporte trimestral de Español','ESPAÑOL');
       doc.setFont('helvetica','normal');doc.setTextColor(0);doc.setFontSize(8.5);
       doc.text('Turno: '+p.shift+'    Grupo: '+p.group+'    Ciclo: '+p.cycle+'    Primer trimestre',14,34);
       doc.setFont('helvetica','bold');doc.setFontSize(10);
       doc.text((student.number??student.list_number??'')+'. '+displayName(student),14,40);
       return 45;
     }
     return fallbackHeader(student);
   };
   const footer=()=>{
     if(typeof pdfFooter==='function'){pdfFooter(doc);return}
     doc.setFont('helvetica','normal');doc.setFontSize(6.7);doc.setTextColor(90);
     doc.text('Generado '+new Date().toLocaleString('es-MX')+' · App Docente',margin,pageH-6);
     doc.setTextColor(0);
   };
   const sectionBar=(x,y,w,title,right='')=>{
     doc.setFillColor(...yellow);doc.rect(x,y,w,7,'F');
     doc.setTextColor(...dark);doc.setFont('helvetica','bold');doc.setFontSize(8.2);doc.text(title,x+2,y+4.7);
     if(right){doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.text(right,x+w-2,y+4.7,{align:'right'})}
     doc.setTextColor(0);
   };
   const monthBlock=(m,sid,x,y)=>{
     const gm=m?.gradeRecords?.[sid]||{};
     const finalMonth=Number(gm.monthlyGrade??gm.rounded??gm.finalDecimal??gm.obtainedAverage);
     const cm=m?monthlyCriterionModel(m,sid,acts,recMap):[];
     sectionBar(x,y,colW,m?m.month:'Mes sin datos',m?(Number.isFinite(finalMonth)?'Calificación mensual: '+finalMonth.toFixed(1):'Calificación mensual: Pendiente'):'');
     y+=9;

     const critRows=cm.map(v=>[
       (v.criterion.name||'Criterio')+' ('+Number(v.criterion.percent||0)+'%)',
       v.grade==null?'—':v.grade.toFixed(2),
       v.done+'/'+v.total,
       v.missing?String(v.missing):'0'
     ]);
     doc.autoTable({
       startY:y,head:[['Criterio','Calif.','Ent.','Pend.']],body:critRows,
       margin:{left:x,right:pageW-(x+colW)},tableWidth:colW,
       styles:{fontSize:5.1,cellPadding:.48,valign:'middle',lineColor:[225,225,225],lineWidth:.15},
       headStyles:{fillColor:yellow,textColor:dark,fontStyle:'bold',fontSize:5.8},
       alternateRowStyles:{fillColor:light},
       columnStyles:{0:{cellWidth:colW-33},1:{cellWidth:12,halign:'center'},2:{cellWidth:10,halign:'center'},3:{cellWidth:11,halign:'center'}},
       theme:'grid'
     });
     y=doc.lastAutoTable.finalY+2;

     // Conservar TODAS las actividades, como el formato original.
     // Filas muy compactas para que proyecto y resumen permanezcan en la misma hoja.
     const details=[];
     for(const v of cm)for(const d of v.details)details.push([d.name,d.label]);
     doc.autoTable({
       startY:y,head:[['Actividad','Estado / resultado']],body:details,
       margin:{left:x,right:pageW-(x+colW),top:5,bottom:5},
       tableWidth:colW,
       styles:{fontSize:4.45,minCellHeight:0,cellPadding:{top:.28,bottom:.28,left:.65,right:.65},valign:'middle',lineColor:[230,230,230],lineWidth:.1,overflow:'linebreak'},
       headStyles:{fillColor:yellow,textColor:dark,fontStyle:'bold',fontSize:4.6},
       alternateRowStyles:{fillColor:light},
       columnStyles:{0:{cellWidth:colW-35},1:{cellWidth:35}},
       theme:'grid',
       didParseCell:data=>{
         if(data.section!=='body'||data.column.index!==1)return;
         const txt=String(data.cell.raw||'').toLowerCase();
         if(txt.includes('no entregado')||txt.includes('sin calificación'))data.cell.styles.textColor=[196,35,42];
         else if(txt.includes('entregado')||txt.includes('calificación'))data.cell.styles.textColor=[24,142,76];
       }
     });
     return doc.lastAutoTable.finalY+1.5;
   };

   roster.forEach((student,si)=>{
     if(si>0)doc.addPage('letter','landscape');
     const sid=String(student.id),c=calc(sid);
     let top=header(student);
     const left=margin,right=margin+colW+gap;

     // Resultado trimestral principal: visible y jerárquico, sin usar rojo de alerta.
     doc.setFillColor(242,246,250);
     doc.roundedRect(margin,top,pageW-margin*2,14,2,2,'F');
     doc.setTextColor(20,48,86);
     doc.setFont('helvetica','bold');doc.setFontSize(10);
     doc.text('CALIFICACIÓN TRIMESTRAL',margin+4,top+5);
     doc.setFontSize(18);
     doc.text(c.complete?String(c.rounded):'Pendiente',pageW-margin-4,top+9,{align:'right'});
     if(c.complete){
       doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor(75);
       doc.text('Resultado sin redondear: '+c.finalDecimal.toFixed(2),pageW-margin-4,top+12.2,{align:'right'});
     }
     doc.setTextColor(0);
     top+=18;

     const sep=months.find(m=>m.month==='Septiembre')||null;
     const oct=months.find(m=>m.month==='Octubre')||null;
     // El desglose mensual muestra solo faltantes; el resto se contabiliza arriba.
     const ySep=monthBlock(sep,sid,left,top);
     const yOct=monthBlock(oct,sid,right,top);
     let y=Math.max(ySep,yOct)+3;

     sectionBar(margin,y,pageW-margin*2,'Proyecto integrador · 35%',
       c.items.length?(c.delivered.size+' de '+c.items.length+' trabajos registrados · '+c.projectPct.toFixed(2)+' / 35'):'Sin trabajos configurados');
     y+=8;
     const projectRows=c.items.map((it,i)=>{
       const st=c.statuses[String(it.id)]||'';
       const full=c.items.length?35/c.items.length:0;
       const earned=(st==='on_time'||st==='justified')?full:st==='late'?full*Number(it.lateFactor??(20/35)):0;
       const label=st==='on_time'?'En tiempo':st==='justified'?'Justificado':st==='late'?'Extemporáneo':'No entregado';
       return [(i+1)+'. '+it.name,label,earned.toFixed(2)+' pts'];
     });
     doc.autoTable({
       startY:y,head:[['Trabajo','Estado','Valor']],body:projectRows,
       margin:{left:margin,right:margin,top:5,bottom:5},tableWidth:pageW-margin*2,
       styles:{fontSize:4.8,cellPadding:.36,lineColor:[230,230,230],lineWidth:.12},
       headStyles:{fillColor:yellow,textColor:dark,fontStyle:'bold',fontSize:5.6},
       alternateRowStyles:{fillColor:light},
       columnStyles:{0:{cellWidth:pageW-margin*2-63},1:{cellWidth:38},2:{cellWidth:25,halign:'right'}},
       theme:'grid',
       didParseCell:data=>{
         if(data.section!=='body')return;
         const row=projectRows[data.row.index]||[];
         const status=String(row[1]||'').toLowerCase();
         const delivered=status==='en tiempo'||status==='justificado'||status==='extemporáneo';
         if(data.column.index===0||data.column.index===1){
           data.cell.styles.textColor=delivered?[24,142,76]:[196,35,42];
           if(data.column.index===1)data.cell.styles.fontStyle='bold';
         }
       }
     });

     y=doc.lastAutoTable.finalY+2;
     sectionBar(margin,y,pageW-margin*2,'Resumen del trimestre',
       c.complete?('Calificación trimestral: '+c.rounded+' ('+c.finalDecimal.toFixed(2)+')'):'Calificación trimestral: Pendiente');
     y+=8;
     const monthlyLabel=c.months.length?c.months.map(x=>x.month+': '+x.value.toFixed(1)).join(' · '):'Sin meses disponibles';
     const summaryRows=[
       ['Promedio mensual · 30%',c.monthlyAvg==null?'Pendiente':c.monthlyAvg.toFixed(2),c.monthlyContribution.toFixed(2)+' pts',monthlyLabel],
       ['Proyecto integrador · 35%',c.projectPct.toFixed(2)+' / 35',c.projectContribution.toFixed(2)+' pts',c.delivered.size+' de '+c.items.length+' trabajos'],
       ['Examen trimestral · 22%',Number.isFinite(c.exam)?c.exam.toFixed(1):'Pendiente',c.examContribution.toFixed(2)+' pts',''],
       ['Responsabilidad · 13%',Number.isFinite(c.resp)?c.resp.toFixed(1):'Pendiente',c.respContribution.toFixed(2)+' pts','']
     ];
     if(c.quarterPoints>0)summaryRows.push(['Beneficio Mérito','+'+c.quarterPoints.toFixed(2),c.quarterPoints.toFixed(2)+' pts','Aplicado directamente al trimestre']);
     doc.autoTable({
       startY:y,head:[['Componente','Resultado','Aporte','Detalle']],body:summaryRows,
       margin:{left:margin,right:margin},tableWidth:pageW-margin*2,
       styles:{fontSize:4.8,cellPadding:.36,lineColor:[225,225,225],lineWidth:.12},
       headStyles:{fillColor:yellow,textColor:dark,fontStyle:'bold',fontSize:5.6},
       alternateRowStyles:{fillColor:light},
       columnStyles:{0:{cellWidth:58},1:{cellWidth:30},2:{cellWidth:28},3:{cellWidth:pageW-margin*2-116}},
       theme:'grid'
     });

     footer();
   });

   doc.save('Reporte_trimestral_'+p.group+'_'+p.cycle+'.pdf');
   qpdfStatus('Reporte trimestral generado con todas las actividades y desglose en formato horizontal compacto.');
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