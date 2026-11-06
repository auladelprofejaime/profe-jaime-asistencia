(()=>{
'use strict';
const q=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const localDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Mexico_City',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
let weekly=null,busy=false;

async function rpc(name,args={}){if(!window.ProfeSupabase)throw Error('No hay conexión con la app.');return window.ProfeSupabase.rpc(name,args)}
function parseDate(v){const [y,m,d]=String(v||'').split('-').map(Number);return new Date(Date.UTC(y,m-1,d))}
function fmt(v,weekday=false){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(v||''))return '—';
 return new Intl.DateTimeFormat('es-MX',{timeZone:'UTC',weekday:weekday?'long':undefined,day:'numeric',month:'long',year:'numeric'}).format(parseDate(v));
}
function fmtShort(v){if(!/^\d{4}-\d{2}-\d{2}$/.test(v||''))return '—';const [y,m,d]=v.split('-');return d+'/'+m+'/'+y}
function profileFor(id){return weekly?.profiles?.find(p=>p.student_id===id)||{english:'',art:''}}
function applies(t,p){return !t.variant||t.variant===p.english||t.variant===p.art}
function taskPresentation(t){
 if(t.report_mode==='consult_student')return {kind:'consult',text:'Consulte con el alumno si cumplió con esta indicación.'};
 if(t.due_in_period)return {kind:'verify',text:''};
 return {kind:'future',text:'Se entrega: '+fmt(t.due_date,true)+'.'};
}
function visibleTasks(student){
 const p=profileFor(student.student_id);
 return (weekly?.tasks||[]).filter(t=>t.report_mode!=='omit'&&applies(t,p));
}
function renderSummary(){
 const box=q('weeklyTaskSummary');if(!box||!weekly)return;
 const tasks=weekly.tasks||[];
 box.innerHTML='<p><b>Periodo de seguimiento:</b> '+esc(fmt(weekly.week_start))+' al '+esc(fmt(weekly.week_end))+'.</p>'+
 '<p><b>'+tasks.length+' actividad(es) para este reporte.</b> Las que vencen dentro del periodo llevarán las opciones Entregada / No entregada / Realizada, pendiente de revisión. Las que vencen después solo mostrarán su fecha de entrega.</p>'+
 (tasks.length?'<div class="weekly-task-list">'+tasks.map(t=>'<article class="weekly-task-row" data-weekly-task="'+esc(t.id)+'"><div><b>'+esc(t.subject)+(t.variant?' · '+esc(t.variant):'')+'</b><div>'+esc(t.title)+'</div><small>Asignada: '+esc(fmt(t.assigned_date,true))+' · Entrega: '+esc(fmt(t.due_date,true))+'</small></div><label>En el reporte<select data-weekly-mode="'+esc(t.id)+'"><option value="include" '+(t.report_mode==='include'?'selected':'')+'>Incluir</option><option value="consult_student" '+(t.report_mode==='consult_student'?'selected':'')+'>Consultar con el alumno</option><option value="omit" '+(t.report_mode==='omit'?'selected':'')+'>Eliminar del reporte</option></select></label></article>').join(''):'<p>No hay tareas cargadas en este periodo. Los días sin foto simplemente no aparecen.</p>');
}
async function loadWeekly(){
 if(busy)return false;busy=true;const st=q('weeklyTaskStatus');if(st)st.textContent='Cargando semana…';
 try{
  const reference=q('weeklyReferenceDate')?.value||localDate();
  const previous=parseDate(reference);previous.setUTCDate(previous.getUTCDate()-7);
  const previousDate=previous.toISOString().slice(0,10);
  const [out,prior]=await Promise.all([
    rpc('teacher_daily_task_weekly_load',{p_reference_date:reference}),
    rpc('teacher_daily_task_weekly_load',{p_reference_date:previousDate})
  ]);
  if(!out?.week_start||!prior?.week_start)throw Error('No se pudieron cargar ambos periodos.');
  const seen=new Set();const tasks=[];
  for(const t of [...(prior.tasks||[]),...(out.tasks||[])]){
    const id=String(t.id||t.activity_id||JSON.stringify(t));
    if(seen.has(id))continue;seen.add(id);tasks.push(t);
  }
  tasks.sort((a,b)=>String(a.assigned_date||'').localeCompare(String(b.assigned_date||''))||String(a.subject||'').localeCompare(String(b.subject||'')));
  weekly={...out,week_start:prior.week_start,tasks};renderSummary();
  if(st)st.textContent='Semana lista. Los días sin foto no generan ningún registro.';
  return true;
 }catch(e){if(st)st.textContent='No se pudo cargar el seguimiento semanal: '+e.message;return false}
 finally{busy=false}
}
async function changeMode(id,mode,select){
 if(busy)return;busy=true;select.disabled=true;const st=q('weeklyTaskStatus');
 try{
  const out=await rpc('teacher_daily_task_set_report_mode',{p_task_id:id,p_report_mode:mode});
  if(!out?.ok)throw Error('No se guardó la clasificación.');
  const task=weekly.tasks.find(t=>String(t.id)===String(id));if(task)task.report_mode=mode;
  if(st)st.textContent=mode==='omit'?'Actividad eliminada de los reportes.':mode==='consult_student'?'Se mostrará la indicación para que la familia la consulte con el alumno.':'Actividad incluida normalmente.';
 }catch(e){select.value=weekly.tasks.find(t=>String(t.id)===String(id))?.report_mode||'include';if(st)st.textContent='No se guardó el cambio: '+e.message}
 finally{busy=false;select.disabled=false}
}

function addReport(doc,student,x,y,w,h,startAt=0){
 const tasks=visibleTasks(student),margin=5,left=x+margin,right=x+w-margin,maxW=w-margin*2;
 doc.setDrawColor(205);doc.rect(x,y,w,h);
 const logo=window.JAIME_LASALLE_LOGO_JPEG||window.JAIME_LASALLE_LOGO;
 if(logo){try{doc.addImage(logo,'JPEG',left,y+4,20,9)}catch(_){try{doc.addImage(logo,'PNG',left,y+4,20,9)}catch(__){}}}
 doc.setTextColor(25);doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text('Seguimiento semanal de tareas · 3.º A',left+23,y+8);
 doc.setFont('helvetica','normal');doc.setFontSize(7.3);
 doc.text('Periodo: '+fmtShort(weekly.week_start)+' al '+fmtShort(weekly.week_end),left+23,y+12);
 doc.setFont('helvetica','bold');doc.setFontSize(8.6);
 const nameLines=doc.splitTextToSize(student.name,maxW);doc.text(nameLines,left,y+19);
 let cy=y+19+nameLines.length*3.6;
 doc.setFont('helvetica','normal');doc.setFontSize(7.2);doc.text('Matrícula: '+student.student_id+'   ·   No. '+student.list_number,left,cy);cy+=5;
 doc.setDrawColor(220);doc.line(left,cy,right,cy);cy+=4;
 if(!tasks.length){doc.setFontSize(7.5);doc.text('No hay actividades incluidas en el reporte de esta semana.',left,cy);cy+=5}
 for(let taskIndex=startAt;taskIndex<tasks.length;taskIndex++){
   const t=tasks[taskIndex];
   const view=taskPresentation(t);
   const title=(t.subject+(t.variant?' ('+t.variant+')':'')+': '+t.title);
   const lines=doc.splitTextToSize(title,maxW);
   const extra=view.kind==='verify'?10:view.kind==='consult'?7:6;
   const need=lines.length*3.1+3.2+extra+3;
   if(cy+need>y+h-21){
     if(taskIndex===startAt)throw Error('Una actividad es demasiado larga para el espacio disponible.');
     doc.setFont('helvetica','italic');doc.setFontSize(6.4);
     doc.text('Continúa en una hoja adicional.',left,y+h-19);
     drawFooter();
     return taskIndex;
   }
   doc.setFont('helvetica','bold');doc.setFontSize(7.1);doc.text(lines,left,cy);cy+=lines.length*3.1;
   doc.setFont('helvetica','normal');doc.setFontSize(6.6);
   doc.text('Asignada: '+fmtShort(t.assigned_date)+' · Entrega: '+fmtShort(t.due_date),left,cy);cy+=3.5;
   if(view.kind==='verify'){
     doc.setFontSize(6.8);
     const labels=['Entregada','No entregada','Realizada, pendiente de revisión'];
     let xx=left;
     for(const label of labels){
       doc.rect(xx,cy-2.3,2.8,2.8);
       doc.text(label,xx+4,cy);
       xx+=label==='Realizada, pendiente de revisión'?0:label==='No entregada'?36:31;
     }
     cy+=6.5;
   }else{
     const lines2=doc.splitTextToSize(view.text,maxW);
     doc.setFontSize(6.8);doc.text(lines2,left,cy);cy+=lines2.length*3.1+3;
   }
 }
 drawFooter();
 return tasks.length;
 function drawFooter(){
 const fy=y+h-13;doc.setDrawColor(170);doc.line(left,fy,right-55,fy);doc.line(right-48,fy,right,fy);
 doc.setFont('helvetica','normal');doc.setFontSize(6.3);doc.text('Firma del padre/madre/tutor',left,fy+3);doc.text('Fecha de entrega',right-48,fy+3);
 doc.setFontSize(5.8);doc.setTextColor(100);doc.text('Reporte generado automáticamente el '+fmtShort(weekly.generated_for)+'.',left,y+h-4);
 }
}
async function generatePdf(){
 const st=q('weeklyTaskStatus');if(busy)return;
 // Actualizar SIEMPRE antes de imprimir, incluyendo fotos guardadas hace unos segundos.
 const loaded=await loadWeekly();if(!loaded||!weekly)return;
 busy=true;
 try{
  if(!window.jspdf?.jsPDF)throw Error('No se cargó el generador de PDF.');
  // Dos medias cartas VERTICALES sobre una hoja carta horizontal.
  const doc=new window.jspdf.jsPDF({unit:'mm',format:'letter',orientation:'landscape'});
  const pageW=279.4,pageH=215.9,outer=5,gap=4,half=(pageW-outer*2-gap)/2;
  const queue=weekly.roster.map(student=>({student,next:0}));
  let slot=0,continuationCount=0;
  while(queue.length){
    const item=queue.shift();
    if(slot===2){doc.addPage();slot=0;}
    const x=outer+slot*(half+gap),previous=item.next;
    const next=addReport(doc,item.student,x,outer,half,pageH-outer*2,previous);
    if(next<=previous&&next<visibleTasks(item.student).length)throw Error('Una actividad no cabe en el reporte.');
    if(next<visibleTasks(item.student).length){queue.push({student:item.student,next});continuationCount++;}
    slot++;
  }
  const name='Seguimiento_tareas_3A_'+weekly.week_start+'_a_'+weekly.week_end+'.pdf';
  doc.save(name);
  if(st)st.textContent='✓ PDF semanal generado: '+weekly.roster.length+' reportes personalizados, dos medias cartas verticales por hoja; '+weekly.tasks.length+' actividades del periodo; '+continuationCount+' continuaciones.';
 }catch(e){if(st)st.textContent='No se pudo generar el PDF: '+e.message}
 finally{busy=false}
}
function init(){
 const host=q('daily-task-review');if(!host||q('weeklyTaskPanel'))return;
 const first=host.querySelector('.card');
 const panel=document.createElement('div');panel.id='weeklyTaskPanel';panel.className='card';
 panel.innerHTML='<div class="section"><div><h2>Reporte semanal para familias</h2><p class="hint">Incluye la semana seleccionada y la anterior, para que no se omitan las tareas capturadas desde el viernes previo.</p></div><button type="button" id="weeklyTaskRefresh">Actualizar semana</button></div><div id="weeklyTaskSummary"></div><div class="daily-toolbar"><button type="button" id="weeklyTaskPdf" class="primary">Generar reportes semanales</button></div><p id="weeklyTaskStatus" role="status" aria-live="polite"></p>';
 host.insertBefore(panel,first||host.firstChild);
 const dateControl=document.createElement('label');dateControl.textContent='Semana de referencia (incluye esta semana y la anterior): ';
 const dateInput=document.createElement('input');dateInput.type='date';dateInput.id='weeklyReferenceDate';dateInput.value=localDate();dateControl.appendChild(dateInput);
 panel.insertBefore(dateControl,q('weeklyTaskSummary'));
 dateInput.addEventListener('change',loadWeekly);
 const style=document.createElement('style');style.textContent='#weeklyTaskPanel .weekly-task-list{display:grid;gap:10px;margin:12px 0}#weeklyTaskPanel .weekly-task-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(210px,260px);gap:12px;align-items:end;border:1px solid #ddd5bf;border-radius:12px;padding:12px;background:#fffdf7}#weeklyTaskPanel .weekly-task-row small{display:block;margin-top:5px;color:#69645a}#weeklyTaskPanel select{width:100%}@media(max-width:720px){#weeklyTaskPanel .weekly-task-row{grid-template-columns:1fr}}';document.head.append(style);
 q('weeklyTaskRefresh').addEventListener('click',loadWeekly);q('weeklyTaskPdf').addEventListener('click',generatePdf);
 panel.addEventListener('change',e=>{const id=e.target.dataset.weeklyMode;if(id)changeMode(id,e.target.value,e.target)});
 document.querySelector('[data-view="daily-task-review"]')?.addEventListener('click',()=>setTimeout(loadWeekly,80));
 loadWeekly();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();