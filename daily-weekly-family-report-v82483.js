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
 if(t.due_by_delivery)return {kind:'verify',text:''};
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
 '<p><b>Fecha de entrega del reporte:</b> '+esc(fmt(weekly.delivery_date))+'. <b>'+tasks.length+' actividad(es).</b> Las tareas vencidas o por entregar hasta esa fecha llevarán casillas de verificación; las posteriores aparecerán en la tabla PRÓXIMAS ENTREGAS.</p>'+
 (tasks.length?'<div class="weekly-task-list">'+tasks.map(t=>'<article class="weekly-task-row" data-weekly-task="'+esc(t.id)+'"><div><b>'+esc(t.subject)+(t.variant?' · '+esc(t.variant):'')+'</b><div>'+esc(t.title)+'</div><small>Asignada: '+esc(fmt(t.assigned_date,true))+' · Entrega: '+esc(fmt(t.due_date,true))+'</small></div><label>En el reporte<select data-weekly-mode="'+esc(t.id)+'"><option value="include" '+(t.report_mode==='include'?'selected':'')+'>Incluir</option><option value="consult_student" '+(t.report_mode==='consult_student'?'selected':'')+'>Consultar con el alumno</option><option value="omit" '+(t.report_mode==='omit'?'selected':'')+'>Eliminar del reporte</option></select></label></article>').join(''):'<p>No hay tareas cargadas en este periodo. Los días sin foto simplemente no aparecen.</p>');
}
async function loadWeekly(){
 if(busy)return false;busy=true;const st=q('weeklyTaskStatus');if(st)st.textContent='Cargando semana…';
 try{
  const from=q('weeklyRangeFrom')?.value;
  const to=q('weeklyRangeTo')?.value;
  const delivery=q('weeklyDeliveryDate')?.value;
  if(!from||!to||from>to)throw Error('Selecciona un rango de fechas válido.');
  if(!delivery||delivery<to)throw Error('La entrega del reporte debe ser el último día del periodo o una fecha posterior.');
  const fromDate=parseDate(from),toDate=parseDate(to);
  const days=Math.round((toDate-fromDate)/86400000);
  if(days>83)throw Error('Selecciona un periodo de hasta 12 semanas.');
  // Consultar tambien tareas anteriores cuya fecha de entrega sigue vigente.
  const dates=[];
  const lookback=new Date(fromDate);lookback.setUTCDate(lookback.getUTCDate()-84);
  // La RPC agrupa de viernes a jueves: consultar todos los viernes que intersectan el rango.
  lookback.setUTCDate(lookback.getUTCDate()-((lookback.getUTCDay()-5+7)%7));
  for(let d=new Date(lookback);d<=toDate;d.setUTCDate(d.getUTCDate()+7)){
    dates.push(d.toISOString().slice(0,10));
  }
  const weeks=await Promise.all(dates.map(d=>rpc('teacher_daily_task_weekly_load',{p_reference_date:d})));
  if(weeks.some(w=>!w?.week_start))throw Error('No se pudieron cargar las actividades del periodo.');
  const out=weeks[0];
  const seen=new Set(),tasks=[];
  for(const w of weeks)for(const t of (w.tasks||[])){
    const assigned=String(t.assigned_date||''),due=String(t.due_date||'');
    // Incluir asignadas en el rango y pendientes de semanas anteriores.
    if(!((assigned>=from&&assigned<=to)||(assigned<from&&due>=from)))continue;
    const id=String(t.id||t.activity_id||JSON.stringify(t));
    if(seen.has(id))continue;
    seen.add(id);
    tasks.push({...t,due_by_delivery:!!due&&due<=delivery});
  }
  tasks.sort((a,b)=>String(a.assigned_date||'').localeCompare(String(b.assigned_date||''))||String(a.subject||'').localeCompare(String(b.subject||'')));
  weekly={...out,week_start:from,week_end:to,delivery_date:delivery,tasks};renderSummary();
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

function reportGroups(student){
 const groups=new Map();
 for(const t of visibleTasks(student).filter(t=>t.due_by_delivery||t.report_mode==='consult_student')){
  const subject=String(t.subject||'Sin materia').trim(),key=subject+'|'+String(t.variant||'');
  if(!groups.has(key))groups.set(key,{label:subject+(t.variant?' ('+t.variant+')':''),items:[]});
  groups.get(key).items.push(t);
 }
 return [...groups.values()];
}
function upcomingTasks(student){return visibleTasks(student).filter(t=>!t.due_by_delivery&&t.report_mode!=='consult_student').sort((a,b)=>String(a.due_date).localeCompare(String(b.due_date))||String(a.subject).localeCompare(String(b.subject),'es'));}
function upcomingTable(doc,student,w,size){
 const tasks=upcomingTasks(student),rows=[];if(!tasks.length)return {rows,height:0};
 const widths=[w*.22,w*.57,w*.21],line=size*.43;
 doc.setFont('helvetica','normal');doc.setFontSize(size);
 for(const t of tasks){const subject=String(t.subject||'Sin materia')+(t.variant?' ('+t.variant+')':'');const cells=[subject,String(t.title||''),fmtShort(t.due_date)].map((v,i)=>doc.splitTextToSize(v,Math.max(8,widths[i]-3)));
 rows.push({cells,height:Math.max(...cells.map(c=>c.length))*line+2.5});}
 return {rows,widths,line,height:9+rows.reduce((n,r)=>n+r.height,0)};
}
function measureReport(doc,student,w,h,columns){
 const margin=5,gap=5,colW=(w-margin*2-gap*(columns-1))/columns;
 const top=31,bottom=h-19,usable=bottom-top;
 const groups=reportGroups(student);
 for(let size=7.6;size>=6.0;size-=0.2){
  const line=size*0.43,spacing=2.1,blocks=[];
  const future=upcomingTable(doc,student,w-10,size);
  const contentUsable=usable-future.height-(future.rows.length?6:0);
  for(const group of groups){
   doc.setFont('helvetica','bold');doc.setFontSize(size+0.5);
   const heading=doc.splitTextToSize(group.label,colW);
   let height=heading.length*line+1.7;
   const entries=[];
   for(const t of group.items){
    doc.setFont('helvetica','normal');doc.setFontSize(size);
    const lines=doc.splitTextToSize(String(t.title||'')+' · Entrega '+fmtShort(t.due_date),colW-4);
    const view=taskPresentation(t);
    const note=view.kind==='consult'?'Consultar con el alumno':view.kind==='future'?'Entrega posterior':'verify';
    const rowHeight=lines.length*line+spacing+3.2;
    entries.push({lines,note,rowHeight});
    height+=rowHeight;
   }
   height+=1.2;blocks.push({heading,entries,height});
  }
  const cols=Array.from({length:columns},()=>({height:0,blocks:[]}));
  for(const block of blocks){
   let col=cols.reduce((best,c,i)=>c.height<cols[best].height?i:best,0);
   // Keep subjects together; balance the two columns by height.
   cols[col].blocks.push(block);cols[col].height+=block.height;
  }
  if(cols.every(c=>c.height<=contentUsable))return {size,line,cols,colW,margin,gap,top,usable,future};
 }
 return null;
}
function drawReport(doc,student,x,y,w,h,layout){
 const left=x+5,right=x+w-5;
 doc.setDrawColor(205);doc.rect(x,y,w,h);
 const logo=window.JAIME_LASALLE_LOGO_JPEG||window.JAIME_LASALLE_LOGO;
 if(logo){try{doc.addImage(logo,'JPEG',left,y+4,20,9)}catch(_){try{doc.addImage(logo,'PNG',left,y+4,20,9)}catch(__){}}}
 doc.setTextColor(25);doc.setFont('helvetica','bold');doc.setFontSize(9);
 doc.text('Seguimiento de tareas · 3.º A',left+22,y+8);
 doc.setFont('helvetica','normal');doc.setFontSize(6.8);
 doc.text('Periodo: '+fmtShort(weekly.week_start)+' al '+fmtShort(weekly.week_end)+' · Entrega: '+fmtShort(weekly.delivery_date),left+22,y+12);
 doc.setFont('helvetica','bold');doc.setFontSize(8.2);
 const nameLines=doc.splitTextToSize(student.name,w-10);
 if(nameLines.length>2)throw Error('El nombre de '+student.name+' excede el encabezado.');
 doc.text(nameLines,left,y+19);
 doc.setFont('helvetica','normal');doc.setFontSize(6.8);
 doc.text('Matrícula: '+student.student_id+' · No. '+student.list_number,left,y+27);
 doc.setDrawColor(220);doc.line(left,y+29,right,y+29);
 layout.cols.forEach((col,ci)=>{
  const lx=left+ci*(layout.colW+layout.gap);
  let cy=y+layout.top;
  for(const block of col.blocks){
   doc.setFont('helvetica','bold');doc.setFontSize(layout.size+0.5);
   doc.text(block.heading,lx,cy);
   cy+=block.heading.length*layout.line+1.7;
   for(const entry of block.entries){
    doc.setFont('helvetica','normal');doc.setFontSize(layout.size);
    doc.text(entry.lines,lx+3,cy);
    cy+=entry.lines.length*layout.line;
    doc.setFontSize(Math.max(5.5,layout.size-0.6));
    if(entry.note==='verify'){
     // Short labels avoid collisions in the narrower column.
     let xx=lx+3;
     for(const [label,advance] of [['E',11],['NE',13],['PR',12]]){
      doc.rect(xx,cy-1.1,1.8,1.8);doc.text(label,xx+2.6,cy+0.4);xx+=advance;
     }
    }else doc.text(entry.note,lx+3,cy+0.4);
    cy+=layout.size*0.36+3.2;
   }
   cy+=1.2;
  }
 });
 // On full-letter reports, place signatures just below the last activity.
 let contentEnd=y+layout.top+Math.max(...layout.cols.map(c=>c.height),0);
 if(layout.future?.rows.length){
  const table=layout.future,tx=left,tw=w-10;
  let ty=contentEnd+5;
  doc.setTextColor(25);doc.setFont('helvetica','bold');doc.setFontSize(layout.size+0.7);
  doc.text('PRÓXIMAS ENTREGAS',tx,ty);ty+=4;
  const heads=['Materia','Actividad','Fecha'];let xx=tx;
  doc.setFillColor(238,241,245);doc.rect(tx,ty-2.6,tw,5,'F');
  for(let i=0;i<3;i++){doc.text(heads[i],xx+1,ty+0.7);xx+=table.widths[i]}
  ty+=5;
  doc.setFont('helvetica','normal');doc.setFontSize(layout.size);
  for(const row of table.rows){xx=tx;doc.setDrawColor(220);doc.line(tx,ty+row.height-1,tx+tw,ty+row.height-1);
   for(let i=0;i<3;i++){doc.text(row.cells[i],xx+1,ty+table.line);xx+=table.widths[i]}
   ty+=row.height;
  }
  contentEnd=ty;
 }

 const fy=Math.min(y+h-12,Math.max(y+51,contentEnd+9));
 doc.setDrawColor(170);
 const available=right-left, parentW=available*0.49, titularW=available*0.28;
 const titularX=left+parentW+5, dateX=titularX+titularW+5;
 doc.line(left,fy,left+parentW,fy);
 doc.line(titularX,fy,titularX+titularW,fy);
 doc.line(dateX,fy,right,fy);
 doc.setFont('helvetica','normal');doc.setFontSize(5.8);
 doc.text('Firma del padre, madre o tutor',left,fy+3);
 doc.text('Firma del titular',titularX,fy+3);
 doc.text('Fecha',dateX,fy+3);
 doc.setFontSize(5.5);doc.setTextColor(100);
 doc.text('E: entregada · NE: no entregada · PR: pendiente de revisión',left,h>240?Math.min(y+h-4,fy+10):y+h-4);
}
function chooseReport(doc,student){
 const vertical=measureReport(doc,student,132.7,205.9,1);
 if(vertical)return {orientation:'vertical',layout:vertical};
 const horizontal=measureReport(doc,student,205.9,129.7,2);
 if(horizontal)return {orientation:'horizontal',layout:horizontal};
 const full=measureReport(doc,student,205.9,269.4,2);
 if(full)return {orientation:'full',layout:full};
 throw Error('Las actividades de '+student.name+' exceden incluso una hoja carta completa. Revisa el rango de fechas; no se omitió ninguna.');
}
async function generatePdf(){
 const st=q('weeklyTaskStatus');if(busy)return;
 const loaded=await loadWeekly();if(!loaded||!weekly)return;
 busy=true;
 try{
  if(!window.jspdf?.jsPDF)throw Error('No se cargó el generador de PDF.');
  const probe=new window.jspdf.jsPDF({unit:'mm',format:'letter'});
  const plans=weekly.roster.map(student=>({student,...chooseReport(probe,student)}));
  // Half-letter reports share a letter sheet; exceptionally dense reports get a full letter sheet.
  const doc=new window.jspdf.jsPDF({unit:'mm',format:'letter',orientation:plans[0]?.orientation==='vertical'?'landscape':'portrait'});
  let current=null,slot=0,pages=0,fullCount=0;
  for(const plan of plans){
   const isFull=plan.orientation==='full';
   if(isFull||plan.orientation!==current||slot===2){
    if(pages>0)doc.addPage('letter',plan.orientation==='vertical'?'landscape':'portrait');
    current=plan.orientation;slot=0;pages++;
   }
   if(isFull){
    drawReport(doc,plan.student,5,5,205.9,269.4,plan.layout);
    fullCount++;slot=2;
   }else if(current==='horizontal'){
    drawReport(doc,plan.student,5,5+slot*(139.7+4),205.9,129.7,plan.layout);
    slot++;
   }else{
    drawReport(doc,plan.student,5+slot*(132.7+4),5,132.7,205.9,plan.layout);
    slot++;
   }
  }
  const name='Seguimiento_tareas_3A_'+weekly.week_start+'_a_'+weekly.week_end+'.pdf';
  doc.save(name);
  if(st)st.textContent='PDF generado: '+plans.length+' reportes personalizados, media carta normalmente (dos por hoja) y '+fullCount+' reportes excepcionales en carta completa; sin continuaciones.';
 }catch(e){if(st)st.textContent='No se pudo generar el PDF: '+e.message}
 finally{busy=false}
}

async function generateIndividualZip(){
 const st=q('weeklyTaskStatus');if(busy)return;
 const loaded=await loadWeekly();if(!loaded||!weekly)return;
 busy=true;
 try{
  if(!window.jspdf?.jsPDF)throw Error('No se cargó el generador de PDF.');
  if(!window.DailyMissingReports?.zipArchive)throw Error('No se cargó el generador de archivos ZIP.');
  const used=new Set(),files=[];
  for(const student of weekly.roster){
   const probe=new window.jspdf.jsPDF({unit:'mm',format:'letter'});
   const plan=chooseReport(probe,student);
   const horizontal=plan.orientation==='horizontal',full=plan.orientation==='full';
   const doc=new window.jspdf.jsPDF({unit:'mm',format:full?[215.9,279.4]:horizontal?[215.9,139.7]:[139.7,215.9],orientation:horizontal?'landscape':'portrait'});
   drawReport(doc,student,5,5,full?205.9:horizontal?205.9:132.7,full?269.4:horizontal?129.7:205.9,plan.layout);
   let stem=String(student.name||student.student_id||'Alumno').normalize('NFC').replace(/[<>:"/\\|?*\x00-\x1f]/g,' ').replace(/\s+/g,' ').trim().slice(0,110)||'Alumno';
   let name=stem+'.pdf',n=2;
   while(used.has(name.toLocaleLowerCase('es'))){name=stem+' '+n+'.pdf';n++}
   used.add(name.toLocaleLowerCase('es'));
   files.push({name,bytes:new Uint8Array(doc.output('arraybuffer'))});
  }
  const blob=window.DailyMissingReports.zipArchive(files);
  const filename='Seguimiento_tareas_3A_individual_'+weekly.week_start+'_a_'+weekly.week_end+'.zip';
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
  if(st)st.textContent='✓ ZIP generado: '+files.length+' PDFs individuales, uno por alumno, listos para enviar por correo.';
 }catch(e){if(st)st.textContent='No se pudo generar el ZIP individual: '+e.message}
 finally{busy=false}
}
function init(){
 const host=q('daily-task-review');if(!host||q('weeklyTaskPanel'))return;
 const first=host.querySelector('.card');
 const panel=document.createElement('div');panel.id='weeklyTaskPanel';panel.className='card';
 panel.innerHTML='<div class="section"><div><h2>Reporte semanal para familias</h2><p class="hint">Selecciona las fechas de las fotografías que deseas incluir. Los registros de otros periodos se conservan.</p></div><button type="button" id="weeklyTaskRefresh">Actualizar semana</button></div><div id="weeklyTaskSummary"></div><div class="daily-toolbar"><button type="button" id="weeklyTaskPdf" class="primary">Generar reportes semanales</button><button type="button" id="weeklyTaskIndividualZip" class="secondary">PDF individual por alumno (ZIP)</button></div><p id="weeklyTaskStatus" role="status" aria-live="polite"></p>';
 host.insertBefore(panel,first||host.firstChild);
 const dates=document.createElement('div');dates.className='daily-toolbar';
 const today=parseDate(localDate());const weekday=today.getUTCDay();today.setUTCDate(today.getUTCDate()-((weekday-5+7)%7));
 const friday=today.toISOString().slice(0,10);
 dates.innerHTML='<label>Desde <input type="date" id="weeklyRangeFrom"></label><label>Hasta <input type="date" id="weeklyRangeTo"></label><label>Fecha de entrega del reporte <input type="date" id="weeklyDeliveryDate"></label>';
 panel.insertBefore(dates,q('weeklyTaskSummary'));
 q('weeklyRangeFrom').value=friday;
 q('weeklyRangeTo').value=localDate();
 q('weeklyDeliveryDate').value=localDate();
 q('weeklyRangeFrom').addEventListener('change',loadWeekly);
 q('weeklyRangeTo').addEventListener('change',loadWeekly);
 q('weeklyDeliveryDate').addEventListener('change',loadWeekly);
 const style=document.createElement('style');style.textContent='#weeklyTaskPanel .weekly-task-list{display:grid;gap:10px;margin:12px 0}#weeklyTaskPanel .weekly-task-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(210px,260px);gap:12px;align-items:end;border:1px solid #ddd5bf;border-radius:12px;padding:12px;background:#fffdf7}#weeklyTaskPanel .weekly-task-row small{display:block;margin-top:5px;color:#69645a}#weeklyTaskPanel select{width:100%}@media(max-width:720px){#weeklyTaskPanel .weekly-task-row{grid-template-columns:1fr}}';document.head.append(style);
 q('weeklyTaskRefresh').addEventListener('click',loadWeekly);q('weeklyTaskPdf').addEventListener('click',generatePdf);q('weeklyTaskIndividualZip').addEventListener('click',generateIndividualZip);
 panel.addEventListener('change',e=>{const id=e.target.dataset.weeklyMode;if(id)changeMode(id,e.target.value,e.target)});
 document.querySelector('[data-view="daily-task-review"]')?.addEventListener('click',()=>setTimeout(loadWeekly,80));
 loadWeekly();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();