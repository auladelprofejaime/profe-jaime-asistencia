/* Amplía únicamente reportes individuales del Matutino; no altera el PDF del Vespertino. */
(()=>{
'use strict';
const original=window.printWeeklyIndividuals;
if(typeof original!=='function')return;
window.printWeeklyIndividuals=async function(selectedIds=null,reportTitle='Reporte de actividades',fromDate=null,toDate=null){
 const shift=document.querySelector('#gridShift')?.value||'';
 if(!/matutino/i.test(shift))return original.apply(this,arguments);
 if(!fromDate||!toDate)throw Error('Selecciona el rango de fechas para el reporte quincenal.');
 if(!window.MorningIncidents)throw Error('No está disponible el registro de incidencias.');
 const {group,week,students:sts,acts,map}=await weeklyReportData(selectedIds,fromDate,toDate);
 if(!acts.length)throw Error('No hay actividades seleccionadas.');
 if(!window.jspdf?.jsPDF?.API?.autoTable)throw Error('El generador PDF no está disponible.');
 // La consulta debe completarse antes de crear el PDF. Nunca se omiten incidencias silenciosamente.
 const incidents=await window.MorningIncidents.read(sts.map(x=>String(x.id)),fromDate,toDate);
 const byStudent=new Map();
 for(const r of incidents){const id=String(r.student_id);if(!byStudent.has(id))byStudent.set(id,[]);byStudent.get(id).push(r)}
 const {jsPDF}=window.jspdf,doc=new jsPDF({unit:'mm',format:'letter'});
 const bottom=doc.internal.pageSize.getHeight()-17;
 const addPage=()=>{doc.addPage();pdfHeader(doc,reportTitle,'ESPAÑOL')};
 const ensure=(y,need)=>{if(y+need>bottom){addPage();return 37}return y};
 sts.forEach((st,index)=>{
  if(index)addPage();else pdfHeader(doc,reportTitle,'ESPAÑOL');
  const info=individualWeeklyRows(st,acts,map);
  doc.setFont('helvetica','normal');doc.setFontSize(10);
  doc.text('Alumno: '+String(st.name||st.id),14,34);
  doc.text('Grupo: '+group+'    No. de lista: '+(st.number||'—')+'    Periodo: '+week,14,40);
  doc.autoTable({startY:46,head:[['Actividad','Tipo','Asignada','Entrega','Estado']],
   body:info.rows.map(r=>[r.name,r.type,r.assigned||'—',r.due||'—',r.status]),
   styles:{fontSize:8,cellPadding:2,valign:'middle'},
   headStyles:{fillColor:[245,196,0],textColor:[33,27,18]},
   columnStyles:{0:{cellWidth:65},1:{cellWidth:27},2:{cellWidth:27},3:{cellWidth:27},4:{cellWidth:38}}});
  let y=ensure(doc.lastAutoTable.finalY+8,24);
  doc.setFont('helvetica','bold');doc.setFontSize(11);
  doc.text('Entregadas / registradas: '+info.delivered+' de '+info.total,14,y);
  doc.setFont('helvetica','normal');doc.setFontSize(9);
  const note=doc.splitTextToSize('Este reporte corresponde al seguimiento de entregas del periodo seleccionado registrado en Español.',180);
  doc.text(note,14,y+8);y+=13+note.length*4;
  const rows=byStudent.get(String(st.id))||[];
  if(rows.length){
   y=ensure(y+3,13);
   doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text('Incidencias de comportamiento',14,y);y+=3;
   doc.autoTable({startY:y,head:[['Fecha','Incidencia registrada']],
    body:rows.map(r=>[String(r.incident_date).split('-').reverse().join('/'),window.MorningIncidents.labels[r.incident_code]||r.incident_code]),
    styles:{fontSize:8,cellPadding:2,valign:'middle'},headStyles:{fillColor:[245,196,0],textColor:[33,27,18]},
    columnStyles:{0:{cellWidth:28}},margin:{left:14,right:14,top:36,bottom:19},
    didDrawPage:()=>{}});
   y=doc.lastAutoTable.finalY+8;
  }
  y=ensure(y+6,24);
  doc.setDrawColor(70);doc.line(45,y+13,170,y+13);
  doc.setFont('helvetica','normal');doc.setFontSize(8);
  doc.text('Nombre y firma del padre, madre o tutor (de enterado)',107.5,y+18,{align:'center'});
 });
 pdfFooter(doc);
 const filename='reportes_individuales_'+shift+'_'+group+'_'+week.replace(/[^a-z0-9]+/gi,'_')+'.pdf';
 printContent('Reportes individuales de entregas', '<p>'+sts.length+' reportes individuales · Grupo '+safe(group)+' · Periodo '+safe(week)+'</p>',pdfBlob(doc),filename);
};
})();
