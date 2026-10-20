/* La Salle: genera Excel con la plantilla institucional original y asistencias de Supabase. */
(function(){
'use strict';
const $=s=>document.querySelector(s),groups=['1C','3A','3B','3C'];
const store=()=>new Promise((resolve,reject)=>{const r=indexedDB.open('lasalle-plantillas-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('plantillas');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
async function get(key){const db=await store();return new Promise((resolve,reject)=>{const t=db.transaction('plantillas','readonly').objectStore('plantillas').get(key);t.onsuccess=()=>resolve(t.result);t.onerror=()=>reject(t.error)})}
async function put(key,val){const db=await store();return new Promise((resolve,reject)=>{const t=db.transaction('plantillas','readwrite').objectStore('plantillas').put(val,key);t.onsuccess=()=>resolve();t.onerror=()=>reject(t.error)})}
async function excel(){if(window.ExcelJS)return window.ExcelJS;await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';s.onload=resolve;s.onerror=reject;document.head.appendChild(s)});if(!window.ExcelJS)throw Error('No se pudo cargar ExcelJS');return window.ExcelJS}
function selection(){return {shift:$('#attShift')?.value||'',group:String($('#attGroup')?.value||'').replace(/[^a-z0-9]/gi,'').toUpperCase(),from:$('#attReportFrom')?.value,to:$('#attReportTo')?.value}}
function status(message){const x=$('#lasalleExcelStatus');if(x)x.textContent=message}
async function upload(ev){try{const f=ev.target.files?.[0];if(!f)return;const g=selection().group;if(!groups.includes(g))throw Error('Selecciona primero el grupo vespertino.');if(!/\.xlsx$/i.test(f.name))throw Error('Selecciona la lista original de La Salle en Excel (.xlsx).');const b=await f.arrayBuffer();const X=await excel(),w=new X.Workbook();await w.xlsx.load(b);const sh=w.worksheets[0];if(!sh||String(sh.getCell('A3').value||'').toLowerCase().indexOf('colegio la salle')<0)throw Error('El archivo no parece ser la lista original de La Salle.');await put(g,b);status('Plantilla original de '+g+' guardada en este dispositivo. Ya puedes generar el reporte.');}catch(e){status('Error: '+e.message)}finally{ev.target.value=''}}
async function generate(){const btn=$('#lasalleExcelBtn');btn.disabled=true;try{
 const {shift,group,from,to}=selection();
 if(!/vespertino/i.test(shift)||!groups.includes(group))throw Error('Selecciona turno Vespertino y grupo 1C, 3A, 3B o 3C.');
 if(!from||!to||from>to)throw Error('Selecciona un rango válido de fechas.');
 const template=await get(group);if(!template)throw Error('Primero carga una vez el Excel original de '+group+' con el botón «Guardar plantilla original».');
 status('Leyendo los pases de lista registrados…');
 const api=window.ProfeSupabase;if(!api?.select)throw Error('No se pudo conectar con Supabase.');
 const students=await api.select('students','select=*&shift=eq.Vespertino&group_name=eq.'+encodeURIComponent(group)+'&order=list_number.asc');
 const roster=(students||[]).filter(x=>x.shift==='Vespertino'&&x.group_name===group);
 if(!roster.length)throw Error('No se encontraron alumnos del grupo.');
 const ids=roster.map(x=>x.id),attendance=[];
 for(let i=0;i<ids.length;i+=35){const part=ids.slice(i,i+35);const records=await api.select('attendance','select=student_id,attendance_date,status&attendance_date=gte.'+from+'&attendance_date=lte.'+to+'&student_id=in.('+part.map(encodeURIComponent).join(',')+')&order=attendance_date.asc');attendance.push(...(records||[]))}
 const days=[...new Set(attendance.map(a=>a.attendance_date))].sort();
 if(!days.length)throw Error('No hay asistencias guardadas para el rango elegido.');
 const X=await excel(),workbook=new X.Workbook();await workbook.xlsx.load(template.slice(0));const original=workbook.worksheets[0];
 // La plantilla original utiliza E:X (20 fechas), fila 6 encabezados y filas 7:46 alumnos.
 const idMap=new Map(roster.map(x=>[String(x.id),x]));
 const marks=new Map();for(const a of attendance){const student=idMap.get(String(a.student_id));if(!student)continue;marks.set(a.attendance_date+'|'+Number(student.list_number),String(a.status||''))}
 const sheets=Math.ceil(days.length/20);
 for(let page=0;page<sheets;page++){
  const sheet=page===0?original:workbook.addWorksheet('Continuación '+(page+1));
  if(page>0){sheet.columns=original.columns.map(c=>({width:c.width,style:c.style}));for(let row=1;row<=46;row++){const src=original.getRow(row),dst=sheet.getRow(row);dst.height=src.height;src.eachCell({includeEmpty:true},(cell,col)=>{const d=dst.getCell(col);d.value=cell.value;d.style=JSON.parse(JSON.stringify(cell.style||{}))})}sheet.pageSetup={...original.pageSetup};for(const image of original.getImages()){sheet.addImage(image.imageId,JSON.parse(JSON.stringify(image.range)));}for(const range of Object.keys(original._merges||{})){try{sheet.mergeCells(range)}catch(_){}}}
  const segment=days.slice(page*20,(page+1)*20);
  for(let col=5;col<=24;col++){sheet.getCell(6,col).value=null;for(let row=7;row<=46;row++)sheet.getCell(row,col).value=null}
  segment.forEach((day,i)=>{const col=5+i;sheet.getCell(6,col).value=day.slice(8,10)+'-'+day.slice(5,7);for(let n=1;n<=40;n++){const st=marks.get(day+'|'+n);if(!st)continue;const cell=sheet.getCell(6+n,col);cell.value=/ausen|falta|inasisten/i.test(st)?'/':/retardo/i.test(st)?'R':'•';cell.alignment={horizontal:'center',vertical:'middle'};}});
  sheet.getCell('B5').value='Español · Jaime Pérez Vázquez';
 }
 const output=await workbook.xlsx.writeBuffer();const blob=new Blob([output],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='Asistencia_LaSalle_'+group+'_'+from+'_'+to+'.xlsx';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);status('Reporte descargado con '+days.length+' fecha(s), en '+sheets+' hoja(s).');
 }catch(e){status('No se pudo generar: '+e.message)}finally{btn.disabled=false}}
function init(){const box=$('.attendance-report-tools');if(!box||$('#lasalleExcelBtn'))return;const wrap=document.createElement('div');wrap.style.cssText='margin-top:12px;border-top:1px solid #ded3bb;padding-top:12px';wrap.innerHTML='<strong>La Salle · formato Excel original</strong><p class="hint">La primera vez, guarda la plantilla original del grupo en este dispositivo. Después solo elige las fechas y genera el reporte.</p><input id="lasalleTemplateInput" type="file" accept=".xlsx" style="display:none"><button type="button" class="secondary" id="lasalleUploadBtn">Guardar plantilla original</button> <button type="button" class="primary" id="lasalleExcelBtn">Generar reporte La Salle</button><p class="hint" id="lasalleExcelStatus"></p>';box.appendChild(wrap);$('#lasalleUploadBtn').addEventListener('click',()=>$('#lasalleTemplateInput').click());$('#lasalleTemplateInput').addEventListener('change',upload);$('#lasalleExcelBtn').addEventListener('click',generate);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();new MutationObserver(()=>{if(!$('#lasalleExcelBtn'))init()}).observe(document.documentElement,{childList:true,subtree:true});
})();