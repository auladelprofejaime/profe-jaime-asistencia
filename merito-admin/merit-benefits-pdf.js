(function(){
 const $=s=>document.querySelector(s);
 const safe=v=>String(v??'').replace(/\s+/g,' ').trim();
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
   const {jsPDF}=window.jspdf,doc=new jsPDF({unit:'mm',format:'letter'});
   const W=215.9,H=279.4,margin=16,usable=184;
   let y=0,page=0;
   const heading=()=>{
    page++;doc.setFillColor(11,29,58);doc.rect(0,0,W,27,'F');
    doc.setFont('helvetica','bold');doc.setTextColor(255,255,255);doc.setFontSize(13);
    doc.text('MÉRITO GABINO A. PALMA',margin,11);
    doc.setFont('helvetica','normal');doc.setFontSize(9);
    doc.text('Relación de beneficios docentes · '+safe($('#meritBenefitsPeriod')?.selectedOptions?.[0]?.textContent||''),margin,19);
    y=35;
   };
   heading();
   doc.setTextColor(11,29,58);doc.setFont('helvetica','bold');doc.setFontSize(11);
   doc.text('Beneficios registrados para el grupo ganador',margin,y);y+=7;
   doc.setFont('helvetica','normal');doc.setFontSize(8.8);
   const notice='Compañeras y compañeros: les compartimos los beneficios registrados para el grupo ganador. Les invitamos a revisarlos y, si desean mantenerlos o cambiarlos, pueden hacerlo desde su aplicación docente. Quienes aún no han registrado un beneficio también pueden sumarse. Gracias por apoyar este reconocimiento.';
   const lines=doc.splitTextToSize(notice,usable);
   doc.text(lines,margin,y);y+=lines.length*4.2+8;
   rows.forEach((r,i)=>{
    const name=safe(r.display_name),benefit=safe(r.benefit);
    doc.setFontSize(9);doc.setFont('helvetica','normal');
    const desc=doc.splitTextToSize(benefit,usable-7);
    const needed=7+desc.length*4.2+4;
    if(y+needed>H-21){heading()}
    doc.setFillColor(245,247,251);doc.rect(margin,y-4,usable,7,'F');
    doc.setFont('helvetica','bold');doc.setTextColor(11,29,58);doc.text((i+1)+'. '+name,margin+2,y+1);y+=8;
    doc.setFont('helvetica','normal');doc.setTextColor(32,42,58);doc.text(desc,margin+4,y);
    y+=desc.length*4.2+5;
   });
   const total=doc.getNumberOfPages();
   for(let p=1;p<=total;p++){doc.setPage(p);doc.setDrawColor(215,220,229);doc.line(margin,H-16,W-margin,H-16);doc.setFontSize(7.5);doc.setTextColor(90,100,118);doc.text('Administración del proyecto Mérito Gabino A. Palma',margin,H-11);doc.text('Página '+p+' de '+total,W-margin,H-11,{align:'right'})}
   doc.save('Beneficios_Merito_'+safe($('#meritBenefitsPeriod')?.selectedOptions?.[0]?.textContent||'periodo').replace(/[^a-zA-Z0-9]/g,'_')+'.pdf');
   status.textContent='PDF generado con '+rows.length+' beneficios registrados.';
  }catch(e){status.textContent='No se pudo generar el PDF: '+(e.message||e)}finally{btn.disabled=false}
 }
 function init(){$('#meritBenefitsPdfBtn')?.addEventListener('click',generate)}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();