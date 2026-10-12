/* Read-only book report: combine multiple fulfillment/payment states in one PDF. */
(function(){
 'use strict';
 const box=document.getElementById('bookReportStatuses');
 if(!box)return;
 const style=document.createElement('style');
 style.textContent='#bookReportStatuses label{display:inline-flex;align-items:center;gap:5px;margin:0;cursor:pointer;font-size:.9rem}#bookReportStatuses input{width:18px;height:18px;margin:0;flex-shrink:0}@media(max-width:650px){#bookReportStatuses{grid-column:1/-1!important}}';
 document.head.appendChild(style);
 const all=box.querySelector('input[value="all"]');
 box.addEventListener('change',event=>{
   if(!event.target.matches('input[type="checkbox"]'))return;
   if(event.target===all&&all.checked)box.querySelectorAll('input:not([value="all"])').forEach(input=>input.checked=false);
   else if(event.target!==all&&event.target.checked)all.checked=false;
 });
 function generate(){
   const filters=[...box.querySelectorAll('input:checked')].map(input=>input.value);
   if(!filters.length)return alert('Selecciona al menos un estado para el reporte.');
   if(!bookFulfillmentDashboard)return alert('Primero actualiza el seguimiento de libros.');
   const jsPDF=window.jspdf?.jsPDF;if(!jsPDF)return alert('No se pudo cargar el generador PDF.');
   const g=document.getElementById('bookReportGroup')?.value||'__ALL__';
   const statusOf=r=>r.fulfillment_status==='external'?'external':r.fulfillment_status==='delivered'?'delivered':r.fulfillment_status==='requested'?'requested':r.payment_status==='paid'?'paid':r.payment_status==='partial'?'partial':'unpaid';
   const includeAll=filters.includes('all');
   const rows=(bookFulfillmentDashboard.students||[]).filter(r=>(g==='__ALL__'||String(r.group_name)===g)&&(includeAll||filters.includes(statusOf(r))));
   if(!rows.length)return alert('No hay alumnos con los estados seleccionados para generar el reporte.');
   const labels={all:'Todos los estados',unpaid:'Pendientes de pago',partial:'Pagos en proceso',paid:'Libros liquidados',requested:'Libros solicitados',delivered:'Libros entregados',external:'Adquirido por cuenta propia'};
   const label=includeAll?labels.all:filters.map(filter=>labels[filter]).join(' + ');
   const title=includeAll?'Estado de libros':filters.length===1?labels[filters[0]]:'Estados seleccionados';
   const doc=new jsPDF({unit:'mm',format:'letter'});pdfHeader(doc,'Reporte de libros · '+title,'ESPAÑOL');
   doc.setFont('helvetica','normal');doc.setFontSize(10);doc.setTextColor(33,27,18);
   doc.text(g==='__ALL__'?'Grupos de Español':`Grupo ${g}`,14,36);
   doc.setFontSize(8);
   const lines=doc.splitTextToSize('Incluye: '+label,182);
   doc.text(lines,14,41);
   const body=rows.map(r=>{const s=statusOf(r);const rowLabel=s==='unpaid'?'Pendiente de pago':s==='partial'?'Pago en proceso':s==='paid'?'Liquidado':s==='requested'?'Libro solicitado':s==='delivered'?'Libro entregado':'Adquirido por cuenta propia';return [r.list_number||'—',r.name,r.group_name,rowLabel]});
   const rowFill=s=>s==='partial'?[255,250,225]:s==='paid'?[235,248,238]:s==='requested'?[235,243,255]:s==='delivered'?[235,248,238]:s==='external'?[244,246,248]:[250,250,250];
   const dotColor=s=>s==='partial'?[220,168,0]:s==='paid'?[45,150,75]:s==='requested'?[45,105,190]:s==='delivered'?[45,150,75]:s==='external'?[95,105,115]:[185,185,185];
   doc.autoTable({startY:45+lines.length*3.5,tableWidth:182,head:[['No.','Alumno(a)','Grupo','Estado']],body,
     styles:{fontSize:9,cellPadding:2.4,valign:'middle',lineColor:[222,224,228],lineWidth:.18,textColor:[33,27,18]},
     headStyles:{fillColor:[245,196,0],textColor:[33,27,18],lineColor:[190,160,30],lineWidth:.25},
     columnStyles:{0:{cellWidth:18},1:{cellWidth:92},2:{cellWidth:24},3:{cellWidth:48,cellPadding:{left:8,right:2,top:2.4,bottom:2.4}}},
     margin:{bottom:22},
     willDrawCell:data=>{if(data.section==='body')data.cell.styles.fillColor=rowFill(statusOf(rows[data.row.index]));},
     didDrawCell:data=>{if(data.section!=='body'||data.column.index!==3)return;const s=statusOf(rows[data.row.index]);doc.setFillColor(...dotColor(s));doc.circle(data.cell.x+4,data.cell.y+data.cell.height/2,1.7,'F');if(s==='delivered'){doc.setDrawColor(255,255,255);doc.setLineWidth(.55);const cy=data.cell.y+data.cell.height/2;doc.line(data.cell.x+3.1,cy,data.cell.x+3.8,cy+.7);doc.line(data.cell.x+3.8,cy+.7,data.cell.x+5.1,cy-.8);}}
   });
   if(includeAll||filters.includes('partial')){
     let y=doc.lastAutoTable.finalY+7;
     if(y>doc.internal.pageSize.getHeight()-22){doc.addPage();y=20;}
     doc.setFontSize(8);doc.setTextColor(80,80,80);
     doc.text(doc.splitTextToSize('Pago en proceso indica que ya existe un abono dentro del esquema de pago establecido.',180),14,y);
   }
   pdfFooter(doc);
   const file=`Reporte_libros_${includeAll?'all':filters.join('_')}_${g==='__ALL__'?'todos':g}_${today()}.pdf`;
   printContent('Reporte de libros',`<p><b>${safe(label)}</b> · ${g==='__ALL__'?'Todos los grupos':'Grupo '+safe(g)}</p>`,pdfBlob(doc),file);
 }
 // Capture replaces the original single-select handler without touching book/payment writes.
 document.getElementById('bookFamilyPdf')?.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();generate();},true);
})();
