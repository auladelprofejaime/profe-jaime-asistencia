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
function reviewResult(studentId,t){
 const row=(weekly?.reviews||[]).find(r=>r.student_id===studentId&&r.review_date===t.due_date);
 return row?.results?.find(x=>String(x.task_id)===String(t.id))||null;
}
function taskState(student,t){
 if(t.report_mode==='consult_student')return {key:'consult',text:'Consulte con el alumno si cumplió con esta indicación.'};
 if(t.due_date>weekly.generated_for)return {key:'pending',text:'Pendiente · se entrega '+fmt(t.due_date,true)+'.'};
 const r=reviewResult(student.student_id,t);
 if(r?.status==='presented')return {key:'presented',text:'Cumplió.'};
 if(r?.status==='missing')return {key:'missing',text:'No presentó.'};
 if(r?.status==='unverified')return {key:'unverified',text:'Pendiente de confirmar.'};
 return {key:'unreviewed',text:'Pendiente de revisión.'};
}
function visibleTasks(student){
 const p=profileFor(student.student_id);
 return (weekly?.tasks||[]).filter(t=>t.report_mode!=='omit'&&applies(t,p));
}
function renderSummary(){
 const box=q('weeklyTaskSummary');if(!box||!weekly)return;
 const tasks=weekly.tasks||[];
 box.innerHTML='<p><b>Periodo automático:</b> '+esc(fmt(weekly.week_start))+' al '+esc(fmt(weekly.week_end))+'.</p>'+
 '<p><b>'+tasks.length+' actividad(es) detectada(s).</b> Revisa una sola vez qué debe aparecer en los reportes.</p>'+
 (tasks.length?'<div class="weekly-task-list">'+tasks.map(t=>'<article class="weekly-task-row" data-weekly-task="'+esc(t.id)+'"><div><b>'+esc(t.subject)+(t.variant?' · '+esc(t.variant):'')+'</b><div>'+esc(t.title)+'</div><small>Asignada: '+esc(fmt(t.assigned_date,true))+' · Entrega: '+esc(fmt(t.due_date,true))+'</small></div><label>En el reporte<select data-weekly-mode="'+esc(t.id)+'"><option value="include" '+(t.report_mode==='include'?'selected':'')+'>Incluir</option><option value="consult_student" '+(t.report_mode==='consult_student'?'selected':'')+'>Consultar con el alumno</option><option value="omit" '+(t.report_mode==='omit'?'selected':'')+'>Eliminar del reporte</option></select></label></article>').join(''):'<p>No hay tareas cargadas en este periodo. Los días sin foto simplemente no aparecen.</p>');
}
async function loadWeekly(){
 if(busy)return;busy=true;const st=q('weeklyTaskStatus');if(st)st.textContent='Cargando semana…';
 try{
  const out=await rpc('teacher_daily_task_weekly_load',{p_reference_date:localDate()});
  if(!out?.week_start)throw Error('No se pudo calcular la semana.');
  weekly=out;renderSummary();
  if(st)st.textContent='Semana lista. Los días sin foto no generan ningún registro.';
 }catch(e){if(st)st.textContent='No se pudo cargar el seguimiento semanal: '+e.message}
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
 for(const t of tasks){
   const state=taskState(student,t);
   const title=(t.subject+(t.variant?' ('+t.variant+')':'')+': '+t.title);
   const lines=doc.splitTextToSize(title,maxW);
   const statusLines=doc.splitTextToSize(state.text,maxW);
   const need=lines.length*3.1+3.2+statusLines.length*3.1+3.3;
   if(cy+need>y+h-16){
     doc.setFont('helvetica','italic');doc.setFontSize(6.4);
     doc.text('Continúa en el reverso/hoja siguiente por cantidad de actividades.',left,y+h-10);
     break;
   }
   doc.setFont('helvetica','bold');doc.setFontSize(7.1);doc.text(lines,left,cy);cy+=lines.length*3.1;
   doc.setFont('helvetica','normal');doc.setFontSize(6.6);doc.text('Asignada: '+fmtShort(t.assigned_date)+' · Entrega: '+fmtShort(t.due_date),left,cy);cy+=3.2;
   doc.setFont('helvetica',state.key==='missing'?'bold':'normal');doc.setFontSize(6.8);doc.text(statusLines,left,cy);cy+=statusLines.length*3.1+3;
 }
 const fy=y+h-13;doc.setDrawColor(170);doc.line(left,fy,right-55,fy);doc.line(right-48,fy,right,fy);
 doc.setFont('helvetica','normal');doc.setFontSize(6.3);doc.text('Firma del padre/madre/tutor',left,fy+3);doc.text('Fecha de entrega',right-48,fy+3);
 doc.setFontSize(5.8);doc.setTextColor(100);doc.text('Reporte generado automáticamente el '+fmtShort(weekly.generated_for)+'.',left,y+h-4);
}
async function generatePdf(){
 const st=q('weeklyTaskStatus');if(busy)return;busy=true;
 try{
  if(!weekly)await loadWeekly();
  if(!weekly)throw Error('No hay información semanal.');
  if(!window.jspdf?.jsPDF)throw Error('No se cargó el generador de PDF.');
  const doc=new window.jspdf.jsPDF({unit:'mm',format:'letter',orientation:'portrait'});
  const pageW=215.9,pageH=279.4,outer=8,gap=4,half=(pageH-outer*2-gap)/2;
  weekly.roster.forEach((student,i)=>{
    if(i>0&&i%2===0)doc.addPage();
    const slot=i%2,y=outer+slot*(half+gap);
    addReport(doc,student,outer,y,pageW-outer*2,half);
  });
  const name='Seguimiento_tareas_3A_'+weekly.week_start+'_a_'+weekly.week_end+'.pdf';
  doc.save(name);
  if(st)st.textContent='✓ PDF semanal generado: '+weekly.roster.length+' reportes personalizados, dos por hoja.';
 }catch(e){if(st)st.textContent='No se pudo generar el PDF: '+e.message}
 finally{busy=false}
}
function init(){
 const host=q('daily-task-review');if(!host||q('weeklyTaskPanel'))return;
 const first=host.querySelector('.card');
 const panel=document.createElement('div');panel.id='weeklyTaskPanel';panel.className='card';
 panel.innerHTML='<div class="section"><div><h2>Reporte semanal para familias</h2><p class="hint">El periodo se calcula solo de viernes a jueves. Solo aparecen los días en los que cargaste tareas.</p></div><button type="button" id="weeklyTaskRefresh">Actualizar semana</button></div><div id="weeklyTaskSummary"></div><div class="daily-toolbar"><button type="button" id="weeklyTaskPdf" class="primary">Generar reportes semanales</button></div><p id="weeklyTaskStatus" role="status" aria-live="polite"></p>';
 host.insertBefore(panel,first||host.firstChild);
 const style=document.createElement('style');style.textContent='#weeklyTaskPanel .weekly-task-list{display:grid;gap:10px;margin:12px 0}#weeklyTaskPanel .weekly-task-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(210px,260px);gap:12px;align-items:end;border:1px solid #ddd5bf;border-radius:12px;padding:12px;background:#fffdf7}#weeklyTaskPanel .weekly-task-row small{display:block;margin-top:5px;color:#69645a}#weeklyTaskPanel select{width:100%}@media(max-width:720px){#weeklyTaskPanel .weekly-task-row{grid-template-columns:1fr}}';document.head.append(style);
 q('weeklyTaskRefresh').addEventListener('click',loadWeekly);q('weeklyTaskPdf').addEventListener('click',generatePdf);
 panel.addEventListener('change',e=>{const id=e.target.dataset.weeklyMode;if(id)changeMode(id,e.target.value,e.target)});
 document.querySelector('[data-view="daily-task-review"]')?.addEventListener('click',()=>setTimeout(loadWeekly,80));
 loadWeekly();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();