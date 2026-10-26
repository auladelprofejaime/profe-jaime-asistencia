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