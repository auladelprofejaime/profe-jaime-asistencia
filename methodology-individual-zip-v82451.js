/* Separate PDFs share the same saved-grade renderer as the combined report. */
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
let currentUrl=null;
window.renderMethodologyIndividualZip=async function(data,records,status){
 const button=document.getElementById('methodologyIndividualZipBtn');
 const previous=document.getElementById('methodologyZipDownload');if(previous)previous.hidden=true;
 let timer;
 const details=await Promise.race([ProfeSupabase.rpc('teacher_methodology_report_points',{p_methodology_id:data.methodology.id}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('La consulta de puntos tardó demasiado. Vuelve a intentar.')),15000)})]).finally(()=>clearTimeout(timer));
 if(details?.methodology_id!==data.methodology.id)throw Error('No se pudieron consultar los puntos del reporte.');
 const folder=filePart('Reportes_calificacion_Grupo_'+data.methodology.group+'_'+data.methodology.month),files=[],used=new Set();
 for(let i=0;i<data.rows.length;i++){
  status('Preparando PDF '+(i+1)+' de '+data.rows.length+'…');button.textContent='Generando '+(i+1)+'/'+data.rows.length+'…';
  const row=data.rows[i],doc=await window.renderMethodologyPointsIndividualPdf({data:{...data,rows:[row]},records,details,returnDocument:true});
  const stem=filePart(row.student.name||row.student.id);let name=stem+'.pdf',suffix=0;
  while(used.has(name.toLocaleLowerCase('es'))){suffix++;name=stem+' ('+filePart(row.student.id)+(suffix>1?'_'+suffix:'')+').pdf'}
  used.add(name.toLocaleLowerCase('es'));files.push({name:folder+'/'+name,bytes:new Uint8Array(doc.output('arraybuffer'))});
  await new Promise(resolve=>setTimeout(resolve,0));
 }
 const blob=zipArchive(files),filename=folder+'.zip';
 if(currentUrl)URL.revokeObjectURL(currentUrl);
 currentUrl=URL.createObjectURL(blob);
 let box=document.getElementById('methodologyZipDownload');
 if(!box){box=document.createElement('div');box.id='methodologyZipDownload';box.className='card';button.closest('.section')?.after(box);if(!box.isConnected)button.after(box)}
 box.hidden=false;
 box.replaceChildren();
 const description=document.createElement('p');description.textContent='ZIP listo: '+files.length+' PDFs, uno por alumno, dentro de la carpeta '+folder+'.';
 const save=document.createElement('a');save.className='primary';save.textContent='Guardar ZIP';save.href=currentUrl;save.download=filename;save.style.display='inline-block';save.style.marginRight='10px';
 const share=document.createElement('button');share.type='button';share.className='secondary';share.textContent='Compartir ZIP';
 share.onclick=async()=>{
  const file=new File([blob],filename,{type:'application/zip'});
  try{if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]})))await navigator.share({files:[file],title:'Reportes de calificación'});else save.click()}catch(error){if(error.name!=='AbortError')status('Pulsa Guardar ZIP y elige dónde guardarlo en Archivos.')}
 };
 box.append(description,save,share);
};
document.addEventListener('click',event=>{
 if(!event.target.closest?.('#methodologyIndividualZipBtn'))return;
 event.preventDefault();event.stopImmediatePropagation();printMethodologyIndividuals({zip:true});
},true);
})();

