(function(){
 const $=s=>document.querySelector(s);
 const safe=v=>String(v??'').replace(/\s+/g,' ').trim();
 const LOGO="data:image/jpeg;base64,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";
 async function generate(){
  const btn=$('#meritBenefitsPdfBtn'),status=$('#meritBenefitsPdfStatus'),period=$('#meritBenefitsPeriod')?.value;
  if(!period){status.textContent='Selecciona un periodo.';return}
  if(!window.jspdf?.jsPDF){status.textContent='No se cargó el generador PDF.';return}
  btn.disabled=true;status.textContent='Preparando relación de beneficios…';
  try{
   window.ProfeSupabase?.restore?.();
   const data=await window.ProfeSupabase.rpc('teacher_merit_benefits',{p_period_id:period});
   if(!Array.isArray(data))throw new Error('No se recibió el listado.');
   const rows=data.filter(r=>r.benefit&&r.review_status!=='rejected').sort((a,b)=>safe(a.display_name).localeCompare(safe(b.display_name),'es'));
   const {jsPDF}=window.jspdf,doc=new jsPDF({unit:'mm',format:'letter',orientation:'portrait'});
   const W=215.9,H=279.4,margin=15,usable=W-margin*2,footerY=267;
   const navy=[11,29,58],gold=[183,139,48],ink=[32,42,58],muted=[96,105,120],soft=[246,248,251];
   const rawPeriod=safe($('#meritBenefitsPeriod')?.selectedOptions?.[0]?.textContent||'');
   const periodLabel=(rawPeriod.split('·')[0]||rawPeriod).trim();
   let y=0;
   function header(){
    doc.setFillColor(...navy);doc.rect(0,0,W,33,'F');
    try{doc.addImage(LOGO,'JPEG',margin,5,22,22)}catch(_){}
    doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(14);
    doc.text('MÉRITO GABINO A. PALMA',43,13);
    doc.setFont('helvetica','normal');doc.setFontSize(9);
    doc.text('Relación de beneficios docentes',43,20);
    doc.setFontSize(8.5);doc.text(periodLabel?('Periodo: '+periodLabel):'',43,26);
    doc.setDrawColor(...gold);doc.setLineWidth(.8);doc.line(margin,33,W-margin,33);
    y=41;
   }
   function footer(){
    doc.setDrawColor(220,224,230);doc.setLineWidth(.3);doc.line(margin,footerY-4,W-margin,footerY-4);
    doc.setTextColor(...muted);doc.setFont('helvetica','normal');doc.setFontSize(7.3);
    doc.text('Administración del proyecto Mérito Gabino A. Palma',margin,footerY);
   }
   function newPage(){
    if(doc.getNumberOfPages()>0)footer();
    doc.addPage();header();
   }
   header();
   doc.setTextColor(...navy);doc.setFont('helvetica','bold');doc.setFontSize(11.5);
   doc.text('Beneficios registrados para el grupo ganador',margin,y);y+=6;
   const notice='Compañeras y compañeros: les compartimos los beneficios registrados para el grupo ganador. Les invitamos a revisarlos y, si desean mantenerlos o cambiarlos, pueden hacerlo desde su aplicación docente. Quienes aún no han registrado un beneficio también pueden sumarse. Gracias por apoyar este reconocimiento.';
   doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.setTextColor(...ink);
   const noticeLines=doc.splitTextToSize(notice,usable-8);
   const noticeH=noticeLines.length*4+8;
   doc.setFillColor(249,247,240);doc.roundedRect(margin,y,usable,noticeH,2,2,'F');
   doc.text(noticeLines,margin+4,y+5,{baseline:'top'});y+=noticeH+7;
   rows.forEach((r,i)=>{
    const name=safe(r.display_name),benefit=safe(r.benefit);
    doc.setFont('helvetica','normal');doc.setFontSize(8.8);
    const desc=doc.splitTextToSize(benefit,usable-10);
    const cardH=11+desc.length*4.2+6;
    if(y+cardH>footerY-8){footer();doc.addPage();header()}
    doc.setFillColor(...soft);doc.roundedRect(margin,y,usable,cardH,1.5,1.5,'F');
    doc.setFillColor(...gold);doc.rect(margin,y,2.2,cardH,'F');
    doc.setTextColor(...navy);doc.setFont('helvetica','bold');doc.setFontSize(9.7);
    doc.text((i+1)+'. '+name,margin+6,y+6.5);
    doc.setTextColor(...ink);doc.setFont('helvetica','normal');doc.setFontSize(8.8);
    doc.text(desc,margin+6,y+12,{baseline:'top'});
    y+=cardH+4;
   });
   footer();
   const total=doc.getNumberOfPages();
   for(let p=1;p<=total;p++){
    doc.setPage(p);doc.setTextColor(...muted);doc.setFont('helvetica','normal');doc.setFontSize(7.3);
    doc.text('Página '+p+' de '+total,W-margin,footerY,{align:'right'});
   }
   const filePeriod=(periodLabel||'periodo').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'_').replace(/^_+|_+$/g,'');
   doc.save('Beneficios_Merito_'+filePeriod+'.pdf');
   status.textContent='PDF generado correctamente con '+rows.length+' beneficios registrados.';
  }catch(e){status.textContent='No se pudo generar el PDF: '+(e.message||e)}
  finally{btn.disabled=false}
 }
 function init(){$('#meritBenefitsPdfBtn')?.addEventListener('click',generate)}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();