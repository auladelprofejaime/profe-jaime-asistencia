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

function addReport(doc,student,x,y,w,h){
 const tasks=visibleTasks(student),margin=5,left=x+margin,right=x+w-margin,maxW=w-margin*2;
 const groups=new Map();
 for(const t of tasks){const subject=String(t.subject||'Sin materia').trim();const key=subject+'|'+String(t.variant||'');if(!groups.has(key))groups.set(key,{label:subject+(t.variant?' ('+t.variant+')':''),items:[]});groups.get(key).items.push(t)}
 const grouped=[...groups.values()];
 const top=y+31,bottom=y+h-19,available=bottom-top;
 let layout=null;
 for(let size=7.4;size>=4.4;size-=0.25){
   const leading=size*0.43,spacing=size*0.36,blocks=[];let height=0;
   for(const group of grouped){
     doc.setFont('helvetica','bold');doc.setFontSize(size+0.5);
     const heading=doc.splitTextToSize(group.label,maxW);
     const entries=[];let blockHeight=heading.length*leading+1.1;
     for(const t of group.items){
       doc.setFont('helvetica','normal');doc.setFontSize(size);
       const due='Entrega '+fmtShort(t.due_date);
       const lines=doc.splitTextToSize(String(t.title||'')+' · '+due,maxW-5);
       const view=taskPresentation(t);
       const note=view.kind==='consult'?'Consultar con alumno':view.kind==='future'?'Entrega posterior':'E / NE / PR';
       const rowHeight=lines.length*leading+spacing+2.2;
       entries.push({t,lines,note,rowHeight});blockHeight+=rowHeight;
     }
     blockHeight+=1.3;blocks.push({heading,entries,blockHeight});height+=blockHeight;
   }
   if(height<=available){layout={size,leading,blocks};break}
 }
 if(!layout)throw Error('Las actividades de '+student.name+' no caben legiblemente en media carta. No se omitió ninguna.');
 doc.setDrawColor(205);doc.rect(x,y,w,h);
 const logo=window.JAIME_LASALLE_LOGO_JPEG||window.JAIME_LASALLE_LOGO;
 if(logo){try{doc.addImage(logo,'JPEG',left,y+4,20,9)}catch(_){try{doc.addImage(logo,'PNG',left,y+4,20,9)}catch(__){}}}
 doc.setTextColor(25);doc.setFont('helvetica','bold');doc.setFontSize(9);doc.text('Seguimiento de tareas · 3.º A',left+22,y+8);
 doc.setFont('helvetica','normal');doc.setFontSize(6.8);doc.text('Periodo: '+fmtShort(weekly.week_start)+' al '+fmtShort(weekly.week_end),left+22,y+12);
 doc.setFont('helvetica','bold');doc.setFontSize(8.2);doc.text(doc.splitTextToSize(student.name,maxW),left,y+19);
 doc.setFont('helvetica','normal');doc.setFontSize(6.8);doc.text('Matrícula: '+student.student_id+' · No. '+student.list_number,left,y+27);
 doc.setDrawColor(220);doc.line(left,y+29,right,y+29);
 let cy=top;
 for(const block of layout.blocks){
   doc.setFont('helvetica','bold');doc.setFontSize(layout.size+0.5);
   doc.text(block.heading,left,cy);cy+=block.heading.length*layout.leading+1.1;
   for(const entry of block.entries){
     doc.setFont('helvetica','normal');doc.setFontSize(layout.size);
     doc.text(entry.lines,left+4,cy);cy+=entry.lines.length*layout.leading;
     doc.setFontSize(Math.max(4.2,layout.size-0.7));
     doc.text(entry.note,left+4,cy+0.4);cy+=layout.size*0.36+2.2;
   }
   cy+=1.3;
 }
 const fy=y+h-12;doc.setDrawColor(170);doc.line(left,fy,right-48,fy);doc.line(right-43,fy,right,fy);
 doc.setFont('helvetica','normal');doc.setFontSize(6);doc.text('Firma del padre/madre/tutor',left,fy+3);doc.text('Fecha',right-43,fy+3);
 doc.setFontSize(5.5);doc.setTextColor(100);doc.text('E: entregada · NE: no entregada · PR: pendiente de revisión',left,y+h-4);
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
  weekly.roster.forEach((student,i)=>{
    if(i>0&&i%2===0)doc.addPage();
    const slot=i%2,x=outer+slot*(half+gap);
    addReport(doc,student,x,outer,half,pageH-outer*2);
  });
  const name='Seguimiento_tareas_3A_'+weekly.week_start+'_a_'+weekly.week_end+'.pdf';
  doc.save(name);
  if(st)st.textContent='✓ PDF semanal generado: '+weekly.roster.length+' reportes personalizados, dos medias cartas verticales por hoja; '+weekly.tasks.length+' actividades del periodo; sin continuaciones.';
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