/* Daily missing-task PDFs: one named file per reviewed pupil, no writes. */
(()=>{
'use strict';
const enc=new TextEncoder();
const crcTable=Array.from({length:256},(_,i)=>{let c=i;for(let j=0;j<8;j++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;return c>>>0});
function crc(bytes){let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0}
function header(size){const bytes=new Uint8Array(size);return {bytes,v:new DataView(bytes.buffer)}}
function zipArchive(files){
 const chunks=[],central=[],now=new Date(),year=Math.max(1980,Math.min(2107,now.getFullYear()));
 const date=((year-1980)<<9)|((now.getMonth()+1)<<5)|now.getDate(),time=(now.getHours()<<11)|(now.getMinutes()<<5)|(now.getSeconds()>>1);
 let offset=0,centralSize=0;
 for(const f of files){
  const name=enc.encode(f.name),bytes=f.bytes,checksum=crc(bytes),local=header(30),v=local.v;
  v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);
  v.setUint16(10,time,true);v.setUint16(12,date,true);v.setUint32(14,checksum,true);
  v.setUint32(18,bytes.length,true);v.setUint32(22,bytes.length,true);v.setUint16(26,name.length,true);
  chunks.push(local.bytes,name,bytes);
  const entry=header(46),c=entry.v;
  c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x800,true);
  c.setUint16(12,time,true);c.setUint16(14,date,true);c.setUint32(16,checksum,true);
  c.setUint32(20,bytes.length,true);c.setUint32(24,bytes.length,true);c.setUint16(28,name.length,true);c.setUint32(42,offset,true);
  central.push(entry.bytes,name);centralSize+=46+name.length;offset+=30+name.length+bytes.length;
 }
 const end=header(22),e=end.v;e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,centralSize,true);e.setUint32(16,offset,true);
 return new Blob([...chunks,...central,end.bytes],{type:'application/zip'});
}
function filePart(value){
 let name=String(value||'').normalize('NFC').replace(/[<>:"/\\|?*\x00-\x1f]/g,' ').replace(/\s+/g,' ').trim().replace(/[. ]+$/g,'').slice(0,120).trim();
 if(!name||name==='.'||name==='..')name='Alumno';
 if(/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name))name='Alumno '+name;
 return name;
}

function missingRows(data){return data.roster.map(student=>({student,review:data.reviews.find(r=>r.student_id===student.student_id)})).filter(x=>x.review).map(x=>({...x,tasks:x.review.results.filter(t=>t.status==='missing')})).filter(x=>x.tasks.length)}
function dateLabel(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return 'Fecha no registrada';const [y,m,d]=value.split('-');return d+'/'+m+'/'+y}
function missingPdf(row,date){
 if(!window.jspdf?.jsPDF)throw Error('No se cargó el generador de PDF. Abre la app con internet y vuelve a intentar.');
 const doc=new window.jspdf.jsPDF({unit:'mm',format:'letter'});let y=0;
 function page(){doc.setFillColor(247,196,0);doc.rect(0,0,216,8,'F');doc.setTextColor(30);doc.setFont('helvetica','bold');doc.setFontSize(15);doc.text('El Aula del Profe Jaime',16,20);doc.setFontSize(12);doc.text('Revisión diaria - tareas no presentadas',16,29);doc.setFont('helvetica','normal');doc.setFontSize(10);const name=doc.splitTextToSize('Alumno: '+row.student.name,182);doc.text(name,16,40);y=40+name.length*5;doc.text('Grupo: 3.º A   |   No. de lista: '+row.student.list_number,16,y);y+=6;doc.text('Fecha de revisión: '+dateLabel(date),16,y);y+=12}
 page();
 for(const t of row.tasks){
  const title=doc.splitTextToSize(t.title||'Tarea sin descripción',174);
  const lines=[t.subject+(t.variant?' ('+t.variant+')':''),...title,'Debía entregar: '+dateLabel(t.due_date)];
  if(y+Math.min(lines.length*5+12,210)>255){doc.addPage();page()}
  doc.setDrawColor(215);doc.line(16,y-3,200,y-3);
  lines.forEach((line,i)=>{if(y>252){doc.addPage();page()}doc.setFont('helvetica',i===0?'bold':'normal');doc.setFontSize(10);doc.text(String(line),18,y);y+=5});y+=9;
 }
 if(y>245){doc.addPage();page()}doc.setFont('helvetica','normal');doc.setFontSize(9);doc.text('Este reporte incluye únicamente faltantes registrados por el docente.',16,y+2);
 const pages=doc.getNumberOfPages();for(let i=1;i<=pages;i++){doc.setPage(i);doc.setFontSize(8);doc.setTextColor(100);doc.text('Página '+i+' de '+pages,174,269)}
 return doc
}
function reportFiles(data,date){const used=new Set(),folder='Tareas_faltantes_3A_'+date;return missingRows(data).map(row=>{const stem=filePart(row.student.name);let name=stem+'.pdf',n=1;while(used.has(name.toLocaleLowerCase('es'))){name=stem+' ('+filePart(row.student.student_id)+(n>1?'_'+n:'')+').pdf';n++}used.add(name.toLocaleLowerCase('es'));return {name:folder+'/'+name,bytes:new Uint8Array(missingPdf(row,date).output('arraybuffer'))}})}
let running=false,currentUrl=null;
async function generate(){
 if(running)return;running=true;const button=document.getElementById('dailyMissingZip'),box=document.getElementById('dailyMissingZipResult'),date=document.getElementById('dailyDate').value;button.disabled=true;box.hidden=false;box.textContent='Consultando revisiones guardadas…';
 try{
  const app=window.DailyTaskReview;if(!app)throw Error('Abre primero Revisión diaria de tareas.');
  if(!await app.load())throw Error('No se pudieron consultar los registros. Vuelve a intentar con conexión.');
  if(document.getElementById('dailyDate').value!==date)throw Error('Cambió la fecha. Genera nuevamente el ZIP.');
  const rows=missingRows(app.data);if(!rows.length){box.textContent='No hay tareas faltantes registradas para esta fecha. No se generó ZIP.';return}
  box.textContent='Generando '+rows.length+' reportes individuales…';
  const files=reportFiles(app.data,date),blob=zipArchive(files),filename='Tareas_faltantes_3A_'+date+'.zip';
  if(currentUrl)URL.revokeObjectURL(currentUrl);currentUrl=URL.createObjectURL(blob);box.replaceChildren();
  const text=document.createElement('p');text.textContent=files.length+' PDFs listos. Solo alumnos con tareas faltantes registradas el '+dateLabel(date)+'.';
  const save=document.createElement('a');save.className='primary';save.textContent='Guardar ZIP';save.href=currentUrl;save.download=filename;save.style.display='inline-block';
  const share=document.createElement('button');share.type='button';share.textContent='Compartir ZIP';share.onclick=async()=>{try{const file=new File([blob],filename,{type:'application/zip'});if(navigator.share&&navigator.canShare?.({files:[file]}))await navigator.share({files:[file],title:'Tareas faltantes'});else save.click()}catch(e){if(e.name!=='AbortError')text.textContent='Pulsa Guardar ZIP para guardarlo en Archivos.'}};
  box.append(text,save,share);
 }catch(e){box.textContent='No se generó el ZIP: '+e.message}finally{running=false;button.disabled=false}
}
window.DailyMissingReports={missingRows,dateLabel,missingPdf,reportFiles,zipArchive,generate};
document.addEventListener('click',event=>{if(event.target.closest?.('#dailyMissingZip'))generate()});
})();
