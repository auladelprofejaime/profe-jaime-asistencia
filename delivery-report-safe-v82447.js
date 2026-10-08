/* Delivery reports are read-only, server-first, and expose failures in the UI. */
(()=>{
'use strict';
const q=id=>document.getElementById(id);
const timeout=(work,ms=35000)=>{let timer;return Promise.race([work,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('El servidor tardó demasiado. No se modificaron entregas; vuelve a intentar.')),ms)})]).finally(()=>clearTimeout(timer))};
async function pages(table,query,order){
 const out=[];
 for(let offset=0;;offset+=500){
  const rows=await ProfeSupabase.select(table,query+'&order='+order+'&limit=500&offset='+offset);
  if(!Array.isArray(rows))throw new Error('No se pudieron consultar '+table+'.');
  out.push(...rows);if(rows.length<500)return out;
 }
}
const inList=values=>encodeURIComponent('('+values.map(v=>'"'+String(v).replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'"').join(',')+')');
async function readActivities(shift,group,from,to){
 if(!window.ProfeSupabase)throw new Error('Inicia sesión para consultar las entregas guardadas.');
 let filter='select=*&shift=eq.'+encodeURIComponent(shift);
 if(from&&to)filter+='&activity_date=gte.'+from+'&activity_date=lte.'+to;
 const rows=await pages('activities',filter,'activity_date.asc,id.asc');
 return rows.map(r=>({...r.data,id:r.id,name:r.title,date:r.activity_date,dueDate:r.due_date,shift:r.shift,group:r.group_name,evaluationMode:r.evaluation_type||'delivery',closed:!!r.closed}))
  .filter(a=>activityMatchesGroup(a,group)).sort(activitySort);
}
reportRangeActivities=async function(from,to){
 if(!from||!to||from>to)throw new Error('Revisa las fechas del reporte.');
 return timeout(readActivities(q('gridShift').value,q('gridGroup').value,from,to));
};
weeklyReportData=async function(selectedIds=null,fromDate=null,toDate=null){
 const shift=q('gridShift').value,group=q('gridGroup').value;
 return timeout((async()=>{
  if((fromDate||toDate)&&(!fromDate||!toDate||fromDate>toDate))throw new Error('Revisa las fechas del reporte.');
  const [available,roster]=await Promise.all([
   readActivities(shift,group,fromDate,toDate),
   pages('students','select=id,name,shift,group_name,list_number,active&active=eq.true&shift=eq.'+encodeURIComponent(shift)+'&group_name=eq.'+encodeURIComponent(group),'list_number.asc,id.asc')
  ]);
  const chosen=Array.isArray(selectedIds)?new Set(selectedIds.map(String)):null;
  let acts=available.filter(a=>!chosen||chosen.has(String(a.id)));
  if(!chosen&&!(fromDate&&toDate)){
   const ids=new Set((await currentWeekActivities()).map(a=>String(a.id)));
   acts=acts.filter(a=>ids.has(String(a.id)));
  }
  if(!acts.length)throw new Error('No hay actividades seleccionadas en ese rango para este grupo.');
  const sts=roster.map(r=>({...r,group:r.group_name,number:r.list_number})).sort(compareStudentsForList);
  if(!sts.length)throw new Error('No hay alumnos activos en el grupo seleccionado.');
  const studentIds=new Set(sts.map(s=>String(s.id))),map=new Map();
  for(let start=0;start<acts.length;start+=20){
   const rows=await pages('activity_records','select=activity_id,student_id,delivered,score,delivery_date&activity_id=in.'+inList(acts.slice(start,start+20).map(a=>a.id))+'&student_id=in.'+inList([...studentIds]),'activity_id.asc,student_id.asc');
   for(const r of rows){
    if(!studentIds.has(String(r.student_id)))continue;
    const key=String(r.activity_id)+'|'+String(r.student_id),rec={key,activityId:r.activity_id,studentId:r.student_id,timestamp:r.delivery_date};
    if(r.delivered===true)rec.status='yes';else if(r.delivered===false)rec.status='no';
    if(r.score!==null&&r.score!==undefined&&Number.isFinite(Number(r.score)))rec.score=Number(r.score);
    map.set(key,rec);
   }
  }
  return {shift,group,week:fromDate&&toDate?reportRangeLabel(fromDate,toDate):q('gridWeek').value,students:sts,acts,map,fromDate,toDate};
 })());
};
let busy=false;
let pdfLoading=null;
async function ensurePdf(){
 if(window.jspdf?.jsPDF?.API?.autoTable)return;
 if(pdfLoading)return pdfLoading;
 const load=src=>timeout(new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src=src;script.onload=resolve;script.onerror=()=>reject(new Error('No se pudo cargar el generador de PDF. Revisa la conexión e intenta nuevamente.'));document.head.append(script);
 }),12000);
 pdfLoading=(async()=>{
  if(!window.jspdf?.jsPDF)await load('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js');
  if(!window.jspdf?.jsPDF?.API?.autoTable)await load('https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js');
  if(!window.jspdf?.jsPDF?.API?.autoTable)throw new Error('El generador de tablas PDF no está disponible.');
 })();
 try{await pdfLoading}finally{pdfLoading=null}
}
document.addEventListener('click',async event=>{
 const button=event.target.closest?.('#generateSelectedWeeklyPdf');if(!button)return;
 event.preventDefault();event.stopImmediatePropagation();if(busy)return;
 let status=q('deliveryReportStatus');
 if(!status){status=document.createElement('p');status.id='deliveryReportStatus';status.setAttribute('role','status');status.setAttribute('aria-live','polite');button.closest('.actions').after(status)}
 const selected=[...document.querySelectorAll('[data-report-act]:checked')].map(x=>x.dataset.reportAct);
 if(!selected.length){status.textContent='Selecciona al menos una actividad.';return;}
 const from=q('weeklyReportFrom').value,to=q('weeklyReportTo').value,title=(q('weeklyReportTitle').value||'Reporte de actividades').trim();
 if(!from||!to||from>to){status.textContent='Revisa las fechas del rango.';return;}
 const original=button.textContent;busy=true;button.disabled=true;button.textContent='Generando PDF…';status.textContent='Consultando entregas guardadas y preparando el PDF…';
 try{
  await ensurePdf();
  await printWeekly(selected,title,from,to);
  q('dialog')?.close();
 }catch(error){
  console.error('Reporte general de entregas',error);
  status.textContent='No se pudo generar el PDF: '+(error.message||error)+'. Se conservaron tus fechas y actividades seleccionadas.';
 }finally{busy=false;button.disabled=false;button.textContent=original;}
},true);
const originalOptions=window.showWeeklyReportOptions;
window.showWeeklyReportOptions=async function(){
 try{return await originalOptions.apply(this,arguments)}catch(error){alert('No se pudo preparar el reporte: '+(error.message||error));}
};
})();
