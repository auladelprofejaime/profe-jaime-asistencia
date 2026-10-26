/* Seguimiento 3A: reporte carta, lectura familiar y semaforo. */
(function(){
'use strict';
const COLORS={green:[28,124,78],yellow:[179,116,10],red:[177,44,48],white:[104,112,124]};
const LABEL={green:'AL CORRIENTE',yellow:'REQUIERE ATENCION',red:'ATENCION PRIORITARIA',white:'PENDIENTE DE CONFIRMACION'};
function wrap(doc,text,width){return doc.splitTextToSize(String(text||''),width);}
function text(doc,value,x,y,maxWidth,size=9,color=[33,44,62],weight='normal',line=4.3){
 doc.setFont('helvetica',weight);doc.setFontSize(size);doc.setTextColor(...color);
 const lines=wrap(doc,value,maxWidth);doc.text(lines,x,y);return y+lines.length*line;
}
function panel(doc,x,y,w,h,fill=[247,249,252]){doc.setFillColor(...fill);doc.roundedRect(x,y,w,h,2,2,'F');}
async function create(){
 if(!window.jspdf?.jsPDF){alert('No se cargo el generador PDF. Vuelve a abrir la aplicacion con internet.');return;}
 const data=await getTitularReportData();if(!data)return;
 const {student:s,week:w,map}=data;
 const {jsPDF}=window.jspdf,doc=new jsPDF({unit:'mm',format:'letter',compress:true});
 const pw=215.9,ph=279.4,left=14,right=201.9,usable=187.9;
 doc.setFillColor(255,255,255);doc.rect(0,0,pw,ph,'F');
 // Identidad institucional, sin sustituir logos oficiales con imitaciones.
 doc.setFont('helvetica','bold');doc.setFontSize(16);doc.setTextColor(8,42,99);
 doc.text('La Salle',left,18);doc.setFontSize(8.4);doc.text('CONSTRUYENDO UN MUNDO FRATERNO',65,17);
 doc.setDrawColor(8,42,99);doc.setLineWidth(.6);doc.line(left,23,right,23);
 text(doc,'REPORTE INDIVIDUAL DE SEGUIMIENTO ACADEMICO',left,32,usable,12,[8,42,99],'bold');
 const period=typeof titularPeriodLabel==='function'?titularPeriodLabel(w):(w.month||'Periodo seleccionado');
 panel(doc,left,37,usable,24,[241,245,250]);
 text(doc,'ALUMNO: '+(s.name||s.id),left+4,44,usable-8,10,[24,42,68],'bold');
 text(doc,'GRUPO: 3.º A    No. DE LISTA: '+(s.number||'—')+'    PERIODO: '+period,left+4,51,usable-8,8.6);
 text(doc,'TITULAR: PROFR. JAIME ARMANDO PEREZ VAZQUEZ',left+4,57,usable-8,8.2);
 const subs=Array.isArray(subjects)?subjects:Array.from(map.keys()).filter(x=>x!=='OBS');
 const entries=subs.map(sub=>({sub,state:['green','yellow','red'].includes(map.get(sub)?.status)?map.get(sub).status:'white'}));
 const counts={green:0,yellow:0,red:0,white:0};entries.forEach(x=>counts[x.state]++);
 text(doc,'PANORAMA DEL PERIODO',left,69,usable,10,[8,42,99],'bold');
 const badges=[['AL CORRIENTE',counts.green,'green'],['REQUIEREN ATENCION',counts.yellow,'yellow'],['PRIORITARIAS',counts.red,'red'],['SIN CONFIRMAR',counts.white,'white']];
 badges.forEach((b,i)=>{const x=left+i*47.3;panel(doc,x,73,44.4,17,[246,248,251]);doc.setFillColor(...COLORS[b[2]]);doc.circle(x+5,78.2,2.1,'F');text(doc,String(b[1]),x+10,80,28,13,COLORS[b[2]],'bold');text(doc,b[0],x+3,87,40,6.1,[65,77,96],'bold');});
 text(doc,'RESULTADOS POR ASIGNATURA',left,99,usable,10,[8,42,99],'bold');
 doc.autoTable({startY:103,margin:{left,right:14},tableWidth:usable,head:[['ASIGNATURA','SEMAFORO','QUE SIGNIFICA']],body:entries.map(e=>[e.sub,LABEL[e.state],e.state==='green'?'Se encuentra al corriente en este periodo.':e.state==='yellow'?'Hay aspectos que debe revisar con su docente.':e.state==='red'?'Necesita atencion y seguimiento prioritario.':'Calificacion o seguimiento pendiente de confirmar.']),theme:'grid',styles:{font:'helvetica',fontSize:7.7,cellPadding:1.6,minCellHeight:7.3,valign:'middle',lineColor:[226,231,238],lineWidth:.2,textColor:[33,44,62]},headStyles:{fillColor:[8,42,99],textColor:255,fontStyle:'bold',fontSize:8},columnStyles:{0:{cellWidth:52},1:{cellWidth:47,fontStyle:'bold'},2:{cellWidth:88.9}},didParseCell(d){if(d.section==='body'&&d.column.index===1){const e=entries[d.row.index];d.cell.styles.textColor=COLORS[e.state];}},pageBreak:'avoid'});
 const priority=entries.filter(e=>e.state==='red').map(e=>e.sub),attention=entries.filter(e=>e.state==='yellow').map(e=>e.sub),pending=entries.filter(e=>e.state==='white').map(e=>e.sub);
 const blocks=[];
 if(priority.length)blocks.push('Atencion prioritaria en '+priority.join(', ')+'. Es importante hablar cuanto antes con los docentes para conocer los pendientes y las opciones de mejora.');
 if(attention.length)blocks.push('Conviene revisar '+attention.join(', ')+' para identificar los aspectos que requieren refuerzo.');
 if(counts.green)blocks.push('En '+counts.green+' asignatura'+(counts.green===1?'':'s')+' se encuentra al corriente; es importante mantener ese desempeño.');
 if(pending.length)blocks.push('En '+pending.join(', ')+' falta confirmar informacion. No se interpreta como reprobacion ni como calificacion de cero.');
 if(!blocks.length)blocks.push('No hay registros suficientes para emitir una valoracion del periodo.');
 let y=doc.lastAutoTable.finalY+8;
 text(doc,'INTERPRETACION PARA LA FAMILIA',left,y,usable,10,[8,42,99],'bold');y+=5;
 const interpretation=blocks.join(' ');
 const interpLines=wrap(doc,interpretation,usable-9);const h=Math.max(21,interpLines.length*4.4+9);
 panel(doc,left,y,usable,h,[243,247,251]);text(doc,interpretation,left+4,y+6,usable-8,8.6,[33,44,62],'normal',4.4);y+=h+7;
 text(doc,'ACUERDOS Y PROXIMOS PASOS',left,y,usable,10,[8,42,99],'bold');y+=5;
 const actions=priority.length||attention.length?'1. Consultar a los docentes de las materias señaladas.  2. Identificar pendientes y fechas de entrega.  3. Revisar los avances durante el siguiente periodo.':'1. Mantener habitos de trabajo y entrega.  2. Revisar las actualizaciones del siguiente periodo.';
 const actionLines=wrap(doc,actions,usable-8),ah=Math.max(17,actionLines.length*4.3+9);panel(doc,left,y,usable,ah,[248,249,252]);text(doc,actions,left+4,y+6,usable-8,8.4);y+=ah+6;
 const obs=map.get('OBS')?.text;
 if(obs&&y<237){text(doc,'OBSERVACIONES REGISTRADAS',left,y,usable,8.6,[8,42,99],'bold');y+=5;y=text(doc,obs,left,y,usable,8.1,[42,51,67],'normal',4);}
 const note='IMPORTANTE: Los estados corresponden al seguimiento del periodo seleccionado; no equivalen por si solos a calificaciones trimestrales. Los datos sin confirmar no se consideran cero. Este reporte no sustituye las calificaciones oficiales de Systelar.';
 const noteY=Math.min(241,Math.max(y+3,226));panel(doc,left,noteY,usable,20,[244,246,250]);text(doc,note,left+4,noteY+5,usable-8,7.6,[67,77,94],'normal',3.6);
 doc.setDrawColor(120,134,155);doc.line(left,265,84,265);doc.line(131,265,right,265);text(doc,'Firma del titular',left+16,270,65,7.4,[74,82,96]);text(doc,'Firma de enterado (madre, padre o tutor)',131,270,71,7.4,[74,82,96]);
 doc.setFillColor(7,38,91);doc.rect(0,274.5,pw,4.9,'F');
 doc.save('Seguimiento_3A_'+String(s.name||s.id).replace(/[^a-z0-9]+/gi,'_')+'.pdf');
}
document.addEventListener('click',function(e){const btn=e.target.closest('#titPdf');if(!btn)return;e.preventDefault();e.stopImmediatePropagation();create().catch(err=>{console.error(err);alert('No fue posible generar el reporte: '+err.message);});},true);
})();

/* Risk report v82471: intercept the actual "Imprimir reporte individual" action, not the fortnightly report. */
(function(){
let currentUrl=null;
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
function getRiskArea(btn){let el=btn;for(let i=0;i<8&&el;i++,el=el.parentElement){if(el.querySelectorAll('table tbody tr').length>=5&&/riesgo de acreditaci[oó]n/i.test(norm(el.innerText)))return el;}return null;}
function n(s){const t=norm(s).replace(',','.');if(!t||/sin informaci|pendiente|—|^-$/.test(t.toLowerCase()))return null;const x=Number(t);return Number.isFinite(x)?x:null;}
function words(doc,t,w){return doc.splitTextToSize(t,w);}
function drawLines(doc,t,x,y,w,size=8.7,line=4.2){doc.setFontSize(size);const lines=words(doc,t,w);doc.text(lines,x,y);return y+lines.length*line;}
function make(area){
const table=area.querySelector('table');if(!table)throw Error('No se encontro la tabla de calificaciones');
const rows=[...table.querySelectorAll('tbody tr')].map(tr=>[...tr.querySelectorAll('td')].map(td=>td.innerText.trim())).filter(x=>x.length>=3);
if(!rows.length)throw Error('La tabla no tiene resultados');
const selected=area.querySelector('select');const name=selected?.selectedOptions?.[0]?.textContent?.trim()||'Alumno seleccionado';
const id=(area.innerText.match(/Matr[ií]cula:\s*(\d+)/i)||[])[1]||'';
const data=rows.map(r=>{const a=n(r[1]),b=n(r[2]);let needed=a===null||b===null?null:Math.max(0,Math.round((18-a-b)*10)/10);let status=needed===null?'pending':needed>10?'red':needed>5?'red':needed<=0?'green':'yellow';return {subject:r[0],a,b,needed,status};});
const pending=data.filter(x=>x.status==='pending'),red=data.filter(x=>x.status==='red'),yellow=data.filter(x=>x.status==='yellow'),green=data.filter(x=>x.status==='green');
const top=data.filter(x=>x.a!==null&&x.b!==null&&x.a>=9&&x.b>=9);
const concerns=data.filter(x=>x.needed!==null&&x.needed>0).sort((a,b)=>b.needed-a.needed);
const {jsPDF}=window.jspdf,doc=new jsPDF({unit:'mm',format:'letter',compress:true});
for(let copyIndex=0;copyIndex<2;copyIndex++){
if(copyIndex===1)doc.addPage('letter','portrait');
const navy=[9,43,98];
doc.setTextColor(...navy);
if(window.JAIME_LASALLE_LOGO_JPEG){doc.addImage(window.JAIME_LASALLE_LOGO_JPEG,'JPEG',82,2,52,23);}else{doc.setFont('helvetica','bold');doc.setFontSize(12);doc.text('La Salle Galicia-Mixcoac',108,17,{align:'center'});}
doc.setDrawColor(...navy);doc.setLineWidth(.5);doc.line(13,31,203,31);
doc.setFontSize(15);doc.text('REPORTE DE TRIMESTRE',108,39,{align:'center'});
doc.setFontSize(9);doc.text('Seguimiento academico individual · 3.º A',108,45,{align:'center'});
doc.setFillColor(242,246,252);doc.roundedRect(13,49,190,17,2,2,'F');doc.setTextColor(25,40,65);
doc.setFontSize(10);doc.text('Alumno: '+name.slice(0,65),17,56);doc.setFontSize(8.5);doc.text('Matricula: '+id+'     Grupo: 3.º A',17,62);
doc.setFont('helvetica','normal');doc.setFontSize(8);doc.text('Para acreditar el trimestre se requieren 18 puntos entre septiembre, octubre y noviembre.',13,71);
const cards=[['ACREDITACION ASEGURADA',green.length,[20,118,74]],['ALCANZABLE',yellow.length,[176,113,18]],['PONER ATENCION',red.length,[185,48,52]],['POR CONFIRMAR',pending.length,[103,113,128]]];
cards.forEach((c,i)=>{let x=13+i*48;doc.setFillColor(245,247,251);doc.roundedRect(x,75,45.5,17,1.5,1.5,'F');doc.setFont('helvetica','bold');doc.setFontSize(15);doc.setTextColor(...c[2]);doc.text(String(c[1]),x+4,83);doc.setFontSize(6.2);doc.text(c[0],x+4,88.7);});
doc.autoTable({startY:97,margin:{left:13,right:13},tableWidth:190,
head:[['MATERIA','SEPT.','OCT.','ACUM.','NECESITA NOV.','SITUACION']],
body:data.map(x=>[x.subject,x.a===null?'—':String(x.a),x.b===null?'—':String(x.b),x.a===null||x.b===null?'—':String(Math.round((x.a+x.b)*10)/10),x.needed===null?'Por confirmar':x.needed===0?'0':String(x.needed),x.status==='green'?'ASEGURADA':x.status==='yellow'?'ALCANZABLE':x.status==='red'?(x.needed>10?'NO ALCANZABLE':'PONER ATENCION'):'POR CONFIRMAR']),
theme:'grid',styles:{fontSize:7.2,cellPadding:1.4,minCellHeight:7.2,lineColor:[218,226,235],lineWidth:.2,textColor:[33,45,64]},
headStyles:{fillColor:navy,textColor:255,fontStyle:'bold',fontSize:7.1},
columnStyles:{0:{cellWidth:49},1:{cellWidth:17},2:{cellWidth:17},3:{cellWidth:20},4:{cellWidth:32},5:{cellWidth:55}},
didParseCell(h){if(h.section==='body'&&h.column.index===5){const st=data[h.row.index].status;const col=st==='green'?[20,118,74]:st==='yellow'?[176,113,18]:st==='red'?[185,48,52]:[103,113,128];h.cell.styles.textColor=col;h.cell.styles.fillColor=st==='green'?[230,246,235]:st==='yellow'?[255,246,224]:st==='red'?[255,234,235]:[239,241,245];h.cell.styles.fontStyle='bold';}}
});
let y=doc.lastAutoTable.finalY+7;doc.setFont('helvetica','bold');doc.setTextColor(...navy);doc.setFontSize(10);doc.text('INTERPRETACION INDIVIDUAL',13,y);y+=6;doc.setFont('helvetica','normal');doc.setTextColor(30,43,61);
let msg='';
if(data.every(x=>x.a===10&&x.b===10))msg='Desempeno academico sobresaliente: el alumno obtuvo 10 en septiembre y octubre en todas las materias registradas. Tiene asegurada la acreditacion del trimestre. No presenta pendientes academicos en estos resultados; se recomienda mantener su excelente nivel de aprovechamiento.';
else{
 if(green.length)msg+='La acreditacion del trimestre ya esta asegurada en '+green.length+' materia(s), incluso sin puntos adicionales en noviembre. ';
 if(top.length)msg+='Destaca el alto desempeno en '+top.slice(0,3).map(x=>x.subject).join(', ')+'. ';
 if(concerns.length)msg+='Para acreditar las materias restantes, noviembre es decisivo: '+concerns.slice(0,4).map(x=>x.subject+' requiere '+x.needed).join('; ')+'. ';
 if(red.length)msg+='En '+red.map(x=>x.subject).join(', ')+' no es matematicamente posible llegar a 18 puntos con un maximo de 10 en noviembre; es necesario hablar con el docente sobre la situacion. ';
 if(pending.length)msg+='En '+pending.map(x=>x.subject).join(', ')+' la calificacion esta pendiente de confirmacion; no significa cero ni reprobacion. ';
 if(!concerns.length&&!red.length&&!pending.length)msg+='Los resultados actuales permiten acreditar todas las materias. Conviene mantener el buen rendimiento y la constancia.';
}
y=drawLines(doc,msg,13,y,190,8.7,4.25)+6;
doc.setFont('helvetica','bold');doc.setTextColor(...navy);doc.setFontSize(10);doc.text('ORIENTACIONES PARA LA FAMILIA',13,y);y+=6;doc.setFont('helvetica','normal');doc.setTextColor(30,43,61);
let advice=red.length?'Solicitar una entrevista con los docentes de las materias en rojo para conocer las alternativas institucionales.':concerns.length?'Dar seguimiento a las materias que requieren una calificacion especifica en noviembre y verificar las evaluaciones programadas.':'Mantener los habitos de estudio y la entrega oportuna de actividades; no se identifican materias que requieran recuperacion en los registros disponibles.';
if(pending.length)advice+=' Confirmar directamente con el docente las calificaciones que aun no aparecen registradas.';
y=drawLines(doc,advice,13,y,190,8.5,4.2);
const footY=Math.max(241,Math.min(y+6,250));doc.setFontSize(7.2);doc.setTextColor(90,100,115);
drawLines(doc,'Nota: los minimos de noviembre son calculos matematicos, no calificaciones ya obtenidas. La informacion pendiente no se considera cero. Consultar las calificaciones oficiales en Systelar.',13,footY,190,7.2,3.6);
doc.setFontSize(8);doc.setTextColor(...navy);
if(copyIndex===1){doc.setDrawColor(130,140,154);doc.line(22,266,125,266);doc.text('Firma de enterado: madre, padre o tutor',73.5,271,{align:'center'});}
else{doc.text('COPIA PARA LA FAMILIA',13,266);}
doc.text('Fecha de entrega: '+new Date().toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit',year:'numeric'}),203,266,{align:'right'});
doc.setFillColor(...navy);doc.rect(0,275,215.9,4.4,'F');
}
return {blob:doc.output('blob'),name:'Seguimiento_3A_'+norm(name).replace(/[^a-z0-9]+/gi,'_')+'.pdf'};
}
function show(result){
if(currentUrl)URL.revokeObjectURL(currentUrl);currentUrl=URL.createObjectURL(result.blob);
document.getElementById('jaimeRiskPdfOverlay')?.remove();
const overlay=document.createElement('div');overlay.id='jaimeRiskPdfOverlay';overlay.style.cssText='position:fixed;inset:0;z-index:2147483647;background:#fff;display:flex;flex-direction:column;';
const bar=document.createElement('div');bar.style.cssText='display:flex;gap:10px;align-items:center;padding:12px;background:#092b62;color:white;flex-wrap:wrap;';
const close=document.createElement('button');close.textContent='✕ Cerrar y elegir otro alumno';close.style.cssText='background:#fff;color:#092b62;padding:11px;border-radius:8px;font-weight:bold';close.onclick=()=>{overlay.remove();URL.revokeObjectURL(currentUrl);currentUrl=null;};
const save=document.createElement('a');save.href=currentUrl;save.download=result.name;save.textContent='Descargar PDF';save.style.cssText='background:#f5c400;color:#092b62;padding:12px;border-radius:8px;font-weight:bold;text-decoration:none;';
const print=document.createElement('button');print.textContent='Imprimir';print.style.cssText='background:#fff;color:#092b62;padding:11px;border-radius:8px;';print.onclick=()=>{const w=window.open(currentUrl,'_blank');if(!w)alert('Usa Descargar PDF para imprimir.');};
bar.append(close,save,print);const frame=document.createElement('iframe');frame.src=currentUrl;frame.style.cssText='border:0;flex:1;width:100%;background:white;';overlay.append(bar,frame);document.body.append(overlay);
}
document.addEventListener('click',function(e){
const b=e.target.closest('button,input[type=button]');if(!b||!norm(b.textContent||b.value).toLowerCase().includes('imprimir reporte individual'))return;
const area=getRiskArea(b);if(!area)return;
e.preventDefault();e.stopImmediatePropagation();
try{if(!window.jspdf?.jsPDF||!window.jspdf.jsPDF.API.autoTable)throw Error('El generador PDF no se cargo.');show(make(area));}catch(err){console.error(err);alert('No se pudo generar el reporte: '+err.message);}
},true);
})();