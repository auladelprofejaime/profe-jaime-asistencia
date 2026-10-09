/* Individual PDFs accept both fresh calculations and restored saved results. */
(()=>{
'use strict';
const q=id=>document.getElementById(id);
const original=printMethodologyIndividuals;
let busy=false;
let loading=null;
function deadline(work,ms=15000){let timer;return Promise.race([work,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('La consulta tardó demasiado. Vuelve a intentar; no se modificaron calificaciones.')),ms)})]).finally(()=>clearTimeout(timer))}
async function ensurePdf(){
 if(window.jspdf?.jsPDF)return;
 if(!loading){
  loading=deadline(new Promise((resolve,reject)=>{
   const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';script.onload=resolve;script.onerror=()=>reject(new Error('No se pudo cargar el generador de PDF. Revisa la conexión.'));document.head.append(script);
  })).finally(()=>{loading=null});
 }
 await loading;if(!window.jspdf?.jsPDF)throw new Error('No está disponible el generador de PDF.');
}
function status(text){
 let el=q('methodologyIndividualPdfStatus');
 if(!el){el=document.createElement('p');el.id='methodologyIndividualPdfStatus';el.setAttribute('role','status');el.setAttribute('aria-live','polite');q('methodologyIndividualPdfBtn').closest('.section')?.after(el);if(!el.isConnected)q('methodologyIndividualPdfBtn').after(el)}
 el.textContent=text;
}
printMethodologyIndividuals=async function(){
 if(busy)return;
 const button=q('methodologyIndividualPdfBtn'),data=window._lastMethodologyCalculation,id=q('calcMethodology')?.value;
 if(!id||data?.methodology?.id!==id||!data.rows?.length){status('Selecciona la metodología y pulsa Ver promedios guardados antes de generar el PDF. No se recalculó nada.');return;}
 if(!data.methodology.month){status('La metodología no tiene un mes definido. Revisa su configuración antes de generar el PDF.');return;}
 busy=true;const label=button.textContent;button.disabled=true;button.textContent='Generando PDF…';status('Preparando los reportes individuales con las calificaciones mostradas…');
 try{
  await ensurePdf();
  const records=await deadline(all('activityRecords'));
  const map=new Map(records.map(r=>[r.key||r.activityId+'|'+r.studentId,r]));
  // Compatibility fields belong only to the report model, never to saved grades.
  const rows=data.rows.map(row=>{
   const pending=Array.isArray(row.pending)?row.pending:(data.activities||[]).filter(a=>{
    if(!data.methodology.assignments?.[a.id]||(a.evaluationMode||'delivery')!=='numeric')return false;
    if(window.StudentEvaluationRange&&!StudentEvaluationRange.applicable(data.methodology,row.student.id,a))return false;
    return typeof map.get(a.id+'|'+row.student.id)?.score!=='number';
   }).map(a=>a.name||'Actividad');
   return {...row,pending,criterionGrades:Object.fromEntries((data.methodology.criteria||[]).map(c=>[c.id,Number.isFinite(row.criterionGrades?.[c.id])?row.criterionGrades[c.id]:null])),final:row.final??row.finalDecimal??null};
  });
  // The legacy renderer reads this shared view model. Restore it even on failure.
  const printable={...data,rows};
  window._lastMethodologyCalculation=printable;
  try{await original.apply(this,arguments)}finally{if(window._lastMethodologyCalculation===printable)window._lastMethodologyCalculation=data}
  status('PDF individual generado. Tus calificaciones guardadas no se modificaron.');
 }catch(error){console.error('PDF individual de metodología',error);status('No se pudo generar el PDF: '+(error.message||error)+'. Tus calificaciones se conservan.');}
 finally{busy=false;button.disabled=false;button.textContent=label;}
};
// Capture delegation survives older scripts that rebind the button on load.
document.addEventListener('click',event=>{
 if(!event.target.closest?.('#methodologyIndividualPdfBtn'))return;
 event.preventDefault();event.stopImmediatePropagation();printMethodologyIndividuals();
},true);
})();
