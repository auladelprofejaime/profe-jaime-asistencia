/* Reportes individuales matutinos: dos alumnos por hoja carta, solo lectura. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const groups=['22','24','25','26'];
const morning=v=>/matutino/i.test(String(v||''));
const same=(a,b)=>String(a||'').replace(/[^a-z0-9]/gi,'').toLowerCase()===String(b||'').replace(/[^a-z0-9]/gi,'').toLowerCase();
async function pages(table,query){
 const result=[];
 for(let offset=0;;offset+=500){
  const rows=await ProfeSupabase.select(table,query+'&limit=500&offset='+offset);
  if(!Array.isArray(rows))throw Error('No se pudo leer '+table);
  result.push(...rows);
  if(rows.length<500)return result;
 }
}
const inList=xs=>encodeURIComponent('('+xs.map(x=>'"'+String(x).replace(/"/g,'')+'"').join(',')+')');
function addUI(){
 if($('morningBatchReports'))return;
 const anchor=$('generateSelectedWeeklyPdf');
 if(!anchor)return;
 const wrap=document.createElement('section');
 wrap.id='morningBatchReports';
 wrap.style.cssText='border:1px solid #d9c17a;border-radius:12px;padding:14px;margin:16px 0;background:#fffdf5';
 wrap.innerHTML='<h3>Impresión masiva · Matutino</h3><p>Un solo PDF, dos alumnos por hoja tamaño carta (media carta cada reporte).</p><div style="display:flex;flex-wrap:wrap;gap:14px">'+groups.map(g=>'<label><input type="checkbox" class="morningBatchGroup" value="'+g+'" checked> Grupo '+g+'</label>').join('')+'</div><p class="hint">Utiliza las fechas inicial y final del reporte indicadas arriba. Se incluirán todas las actividades asignadas dentro del intervalo para cada grupo.</p><button type="button" class="primary" id="morningBatchGenerate">Generar PDF individual masivo</button><p id="morningBatchStatus" role="status"></p>';
 anchor.closest('.actions')?.after(wrap);
 $('morningBatchGenerate').addEventListener('click',generate);
}
function fit(doc,text,width,maxLines=2){
 const lines=doc.splitTextToSize(String(text||'—'),width);
 return lines.slice(0,maxLines).map((line,i)=>i===maxLines-1&&lines.length>maxLines?line.replace(/.{2}$/,'…'):line);
}
function sheet(doc,st,group,acts,recordMap,from,to,y){
 const left=13,right=203,mid=108;
 doc.setDrawColor(155);doc.setLineWidth(.25);doc.rect(9,y,198,127);
 doc.setFont('helvetica','bold');doc.setFontSize(10);
 doc.text('REPORTE INDIVIDUAL DE ACTIVIDADES · ESPAÑOL',left,y+7);
 doc.setFontSize(8);doc.text('Alumno: '+String(st.name||st.id).slice(0,69),left,y+13);
 doc.setFont('helvetica','normal');doc.text('Grupo: '+group+'     Periodo: '+from+' al '+to,left,y+18);
 doc.setFillColor(237,239,242);doc.rect(left,y+21,190,6,'F');
 doc.setFont('helvetica','bold');doc.setFontSize(7);
 doc.text('ACTIVIDAD',left+2,y+25);doc.text('FECHA',mid+20,y+25);doc.text('ENTREGA',right-25,y+25);
 let yy=y+30,delivered=0;
 const maxRows=acts.length>24?24:acts.length;
 for(const a of acts){
  const r=recordMap.get(String(a.id)+'|'+String(st.id));
  const yes=r?.delivered===true;
  if(yes)delivered++;
  doc.setFont('helvetica','normal');doc.setFontSize(6.6);
  doc.text(fit(doc,a.title||a.name||'Actividad',99,1),left+2,yy);
  doc.text(String(a.activity_date||a.date||'—').slice(0,10),mid+20,yy);
  doc.text(yes?'Entregada':r?.delivered===false?'No entregada':'Sin registro',right-25,yy);
  yy+=3.25;
 }
 const allDelivered=acts.filter(a=>recordMap.get(String(a.id)+'|'+String(st.id))?.delivered===true).length;
 if(acts.length>maxRows){doc.setFontSize(7);doc.text('+'+(acts.length-maxRows)+' actividades adicionales: reduce el intervalo para verlas todas.',left+2,yy+2)}
 doc.setFont('helvetica','bold');doc.setFontSize(8);
 doc.text('Entregadas: '+allDelivered+' de '+acts.length,left+2,y+109);
 doc.setDrawColor(60);doc.line(124,y+110,198,y+110);
 doc.setFont('helvetica','normal');doc.setFontSize(7);doc.text('Firma del padre, madre o tutor',126,y+114);
 doc.setFont('helvetica','bold');doc.setFontSize(7);
 const note1='IMPORTANTE: NO SE ACEPTARÁN ACTIVIDADES ATRASADAS ESTE TRIMESTRE.';
 doc.text(note1,left+2,y+118);doc.line(left+2,y+119, left+2+doc.getTextWidth(note1),y+119);
 doc.setFont('helvetica','normal');doc.setFontSize(6.4);
 doc.text('Excepciones: inasistencia justificada; o actividades selladas o firmadas',left+2,y+122);
 doc.text('que no aparezcan registradas, previa verificación y actualización.',left+2,y+125);
}
async function generate(){
 const btn=$('morningBatchGenerate'),status=$('morningBatchStatus');
 const chosen=[...document.querySelectorAll('.morningBatchGroup:checked')].map(x=>x.value);
 const from=$('weeklyReportFrom')?.value,to=$('weeklyReportTo')?.value;
 if(!chosen.length||!from||!to||from>to){status.textContent='Selecciona grupos y un intervalo válido.';return}
 if(!window.ProfeSupabase||!window.jspdf?.jsPDF){status.textContent='No está disponible la conexión o el generador PDF.';return}
 btn.disabled=true;status.textContent='Consultando registros de los grupos…';
 try{
  const {jsPDF}=window.jspdf,doc=new jsPDF({unit:'mm',format:'letter'});
  const roster=await pages('students','select=id,name,shift,group_name,list_number,active&active=eq.true');
  let printed=0,first=true;
  for(const group of chosen){
   const sts=roster.filter(s=>morning(s.shift)&&same(s.group_name,group)).sort((a,b)=>(Number(a.list_number)||999)-(Number(b.list_number)||999)||String(a.name).localeCompare(String(b.name),'es'));
   if(!sts.length)continue;
   status.textContent='Consultando grupo '+group+' ('+sts.length+' alumnos)…';
   const raw=await pages('activities','select=*&shift=eq.Matutino&activity_date=gte.'+from+'&activity_date=lte.'+to);
   const acts=raw.filter(a=>{const obj={...a.data,id:a.id,shift:a.shift,group:a.group_name};return typeof activityMatchesGroup==='function'?activityMatchesGroup(obj,group):same(a.group_name,group)}).sort((a,b)=>String(a.activity_date).localeCompare(String(b.activity_date)));
   const map=new Map();
   for(let i=0;i<acts.length;i+=15){
    const ids=acts.slice(i,i+15).map(a=>a.id);
    for(let j=0;j<sts.length;j+=60){
     const rows=await pages('activity_records','select=activity_id,student_id,delivered&activity_id=in.'+inList(ids)+'&student_id=in.'+inList(sts.slice(j,j+60).map(s=>s.id)));
     rows.forEach(r=>map.set(String(r.activity_id)+'|'+String(r.student_id),r));
    }
   }
   for(const st of sts){
    if(!first&&printed%2===0)doc.addPage();
    sheet(doc,st,group,acts,map,from,to,printed%2===0?12:145);
    printed++;first=false;
   }
  }
  if(!printed)throw Error('No se encontraron alumnos activos de los grupos seleccionados.');
  status.textContent='PDF listo: '+printed+' reportes en '+Math.ceil(printed/2)+' hojas.';
  const blob=doc.output('blob');
  if(typeof printContent==='function')printContent('Reportes individuales matutinos','<p>'+printed+' reportes · '+Math.ceil(printed/2)+' hojas tamaño carta</p>',blob,'reportes_matutino_'+from+'_'+to+'.pdf');
  else doc.save('reportes_matutino_'+from+'_'+to+'.pdf');
 }catch(e){console.error(e);status.textContent='No se pudo generar el PDF: '+(e.message||e)}
 finally{btn.disabled=false}
}
const observer=new MutationObserver(addUI);
function init(){observer.observe(document.body,{childList:true,subtree:true});addUI()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();