/* Reportes individuales matutinos: dos alumnos por hoja carta, solo lectura. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const groups=['22','23','24','25','26'];
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
function sheet(doc,st,group,acts,recordMap,from,to,y,incidents=[],logoData){
 const left=13;
 // Encabezado fiel al reporte grupal: franja superior, logo, nombre del profesor y línea roja.
 doc.setFillColor(245,196,0);doc.rect(9,y,198,2.4,'F');
 if(logoData)doc.addImage(logoData,'PNG',13,y+5,15,15);
 doc.setTextColor(35,35,35);doc.setFont('helvetica','bold');doc.setFontSize(10);
 doc.text('Reporte de actividades',32,y+10);
 doc.setFont('helvetica','normal');doc.setFontSize(6.5);
 doc.text('Profesor: Jaime Armando Pérez Vázquez',32,y+14);
 doc.setTextColor(153,22,43);doc.setFont('helvetica','bold');doc.text('ESPAÑOL',32,y+18);
 doc.setDrawColor(158,19,43);doc.setLineWidth(.55);doc.line(13,y+22,203,y+22);
 doc.setTextColor(25,25,25);doc.setFont('helvetica','bold');doc.setFontSize(7.4);
 doc.text('Turno: Matutino    Grupo: '+group+'    Periodo: '+from+' al '+to,13,y+27);
 doc.setFontSize(7.2);doc.text('Alumno: '+String(st.name||st.id).slice(0,78)+'    No. '+(st.list_number||'—'),13,y+32);
 const body=acts.map(a=>{
  const r=recordMap.get(String(a.id)+'|'+String(st.id));
  return [String(a.title||a.name||'Actividad'),String(a.data?.type||a.evaluation_type||'Actividad'),String(a.activity_date||'—').slice(0,10),String(a.due_date||'—').slice(0,10),r?.delivered===true?'Entregada':r?.delivered===false?'No entregada':'Sin registro'];
 });
 doc.autoTable({startY:y+35,head:[['Actividad','Tipo','Asignada','Entrega','Estado']],body,
  margin:{left:13,right:13},tableWidth:190,
  styles:{fontSize:6.3,cellPadding:1.05,valign:'middle',overflow:'ellipsize'},
  headStyles:{fillColor:[245,196,0],textColor:[33,27,18],fontStyle:'bold'},alternateRowStyles:{fillColor:[245,245,245]},
  columnStyles:{0:{cellWidth:76},1:{cellWidth:25},2:{cellWidth:25},3:{cellWidth:25},4:{cellWidth:39}},
  pageBreak:'avoid'});
 let yy=doc.lastAutoTable.finalY+4;
 const count=acts.filter(a=>recordMap.get(String(a.id)+'|'+String(st.id))?.delivered===true).length;
 doc.setFont('helvetica','bold');doc.setFontSize(8);doc.text('Entregadas / registradas: '+count+' de '+acts.length,left,yy);
 yy+=5;
 if(incidents.length){
  doc.setFontSize(7.5);doc.text('Incidencias de comportamiento',left,yy);yy+=3;
  for(const inc of incidents.slice(0,4)){
   doc.setFont('helvetica','normal');doc.setFontSize(6.5);
   doc.text(String(inc.incident_date||'')+' · '+String(window.MorningIncidents?.labels?.[inc.incident_code]||inc.incident_code||'').slice(0,105),left,yy);yy+=3.2;
  }
  if(incidents.length>4){doc.text('+'+(incidents.length-4)+' incidencias adicionales; reduzca el intervalo.',left,yy);yy+=3}
 }
 doc.setDrawColor(60);doc.line(122,y+108,199,y+108);
 doc.setFont('helvetica','normal');doc.setFontSize(7);doc.text('Firma del padre, madre o tutor (de enterado)',125,y+112);
 doc.setFont('helvetica','bold');doc.setFontSize(7);
 const warning='NO SE ACEPTARÁN ACTIVIDADES ATRASADAS ESTE TRIMESTRE.';
 doc.text(warning,left,y+117);doc.line(left,y+118,left+doc.getTextWidth(warning),y+118);
 doc.setFont('helvetica','normal');doc.setFontSize(6.4);
 doc.text('Excepto por inasistencia justificada. Se actualizarán actividades selladas o firmadas',left,y+122);
 doc.text('que no aparezcan registradas, previa comprobación.',left,y+125);
 if(yy>y+105)throw Error('El reporte del grupo '+group+' no cabe en media carta. Reduce el intervalo.');
}
function openViewer(blob,filename,count){
 const old=$('morningBatchPdfViewer');if(old)old.remove();
 const url=URL.createObjectURL(blob);
 const overlay=document.createElement('div');overlay.id='morningBatchPdfViewer';
 overlay.style.cssText='position:fixed;inset:0;z-index:2147483647;background:#fff;display:flex;flex-direction:column';
 overlay.innerHTML='<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:10px;background:#f5c400"><strong style="flex:1">Reportes individuales · '+count+' alumnos</strong><button type="button" id="morningBatchShare">Compartir PDF</button><button type="button" id="morningBatchDownload">Descargar PDF</button><button type="button" id="morningBatchClose">Cerrar y volver</button></div><iframe title="Vista previa de reportes" style="width:100%;flex:1;border:0"></iframe>';
 document.body.appendChild(overlay);
 overlay.querySelector('iframe').src=url;
 const close=()=>{overlay.remove();URL.revokeObjectURL(url)};
 $('morningBatchClose').onclick=close;
 $('morningBatchDownload').onclick=()=>{const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove()};
 $('morningBatchShare').onclick=async()=>{
  try{
   const file=new File([blob],filename,{type:'application/pdf'});
   if(navigator.share&&navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title:'Reportes individuales'});return}
   if(navigator.share){await navigator.share({title:'Reportes individuales',url});return}
   $('morningBatchDownload').click();alert('Se descargó el PDF para compartirlo desde tu dispositivo.');
  }catch(e){if(e.name!=='AbortError')alert('No se pudo compartir: '+(e.message||e))}
 };
}
async function loadInstitutionalLogo(){
 const img=new Image();img.src='logo-app-docente-v821.png';
 await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('No se pudo cargar el logotipo institucional.'));if(img.complete&&img.naturalWidth)resolve()});
 const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
 canvas.getContext('2d').drawImage(img,0,0);
 return canvas.toDataURL('image/png');
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
  const logoData=await loadInstitutionalLogo();
  const roster=await pages('students','select=id,name,shift,group_name,list_number,active&active=eq.true');
  let printed=0,first=true;
  for(const group of chosen){
   const sts=roster.filter(s=>morning(s.shift)&&same(s.group_name,group)).sort((a,b)=>(Number(a.list_number)||999)-(Number(b.list_number)||999)||String(a.name).localeCompare(String(b.name),'es'));
   if(!sts.length)continue;
   status.textContent='Consultando grupo '+group+' ('+sts.length+' alumnos)…';
   const raw=await pages('activities','select=*&activity_date=gte.'+from+'&activity_date=lte.'+to);
   const acts=raw.filter(a=>{
    if(!morning(a.shift))return false;
    // data.groups es la asignación real; group_name solo identifica el registro original.
    const targets=a.data?.groups;
    if(Array.isArray(targets)&&targets.length)return targets.some(g=>same(g,group));
    return same(a.group_name,group)||same(a.data?.group,group);
   }).sort((a,b)=>String(a.activity_date).localeCompare(String(b.activity_date)));
   status.textContent='Grupo '+group+': '+acts.length+' actividades asignadas en el intervalo.';
   if(acts.length>17)throw Error('El grupo '+group+' tiene '+acts.length+' actividades en el intervalo. Reduce las fechas para evitar cortar actividades en media carta (máximo 17).');
   const map=new Map();
   const incidentRows=window.MorningIncidents?.read?await window.MorningIncidents.read(sts.map(st=>String(st.id)),from,to):[];
   const incidentMap=new Map();for(const row of incidentRows){const key=String(row.student_id);if(!incidentMap.has(key))incidentMap.set(key,[]);incidentMap.get(key).push(row)}
   for(let i=0;i<acts.length;i+=15){
    const ids=acts.slice(i,i+15).map(a=>a.id);
    for(let j=0;j<sts.length;j+=60){
     const rows=await pages('activity_records','select=activity_id,student_id,delivered&activity_id=in.'+inList(ids)+'&student_id=in.'+inList(sts.slice(j,j+60).map(s=>s.id)));
     rows.forEach(r=>map.set(String(r.activity_id)+'|'+String(r.student_id),r));
    }
   }
   for(const st of sts){
    if(!first&&printed%2===0)doc.addPage();
    sheet(doc,st,group,acts,map,from,to,printed%2===0?12:145,incidentMap.get(String(st.id))||[],logoData);
    printed++;first=false;
   }
  }
  if(!printed)throw Error('No se encontraron alumnos activos de los grupos seleccionados.');
  status.textContent='PDF listo: '+printed+' reportes en '+Math.ceil(printed/2)+' hojas.';
  const blob=doc.output('blob');
  openViewer(blob,'reportes_matutino_'+from+'_'+to+'.pdf',printed);
 }catch(e){console.error(e);status.textContent='No se pudo generar el PDF: '+(e.message||e)}
 finally{btn.disabled=false}
}
const observer=new MutationObserver(addUI);
function init(){observer.observe(document.body,{childList:true,subtree:true});addUI()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();