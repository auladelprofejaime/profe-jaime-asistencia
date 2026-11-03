(function(){
 const $=s=>document.querySelector(s);
 async function rpc(name,args={}){
   window.ProfeSupabase?.restore?.();
   if(!window.ProfeSupabase)throw new Error('No hay sesión administrativa');
   return window.ProfeSupabase.rpc(name,args);
 }
 function clean(v){return String(v??'').replace(/\s+/g,' ').trim()}
 function ordinal(n){n=Number(n||0);return n===1?'1.er':n+'.º'}
 function bonus(rank){return rank===1?10:rank===2?7:rank===3?5:0}
 const labels={cleanliness:'Limpieza',uniform:'Uniforme',punctuality:'Puntualidad',coexistence:'Convivencia',responsibility:'Responsabilidad',attitude:'Actitud',institutional_participation:'Participación'};
 async function generate(){
   const btn=$('#meritMonthlyBonusPdfBtn'),st=$('#meritMonthlyStatus'),sel=$('#meritMonthlyPeriod');
   if(!sel?.value)return;
   if(!window.jspdf?.jsPDF){if(st)st.textContent='No se pudo cargar el generador de PDF.';return}
   if(btn)btn.disabled=true;
   if(st)st.textContent='Generando reporte final del cierre mensual…';
   try{
     const [d,groupData,vote]=await Promise.all([rpc('teacher_merit_monthly_result',{p_period_id:sel.value}),rpc('teacher_merit_monthly_group_report_data',{p_period_id:sel.value}),rpc('teacher_merit_category_vote_status',{p_period_id:sel.value})]);
     if(!d?.overall?.group)throw new Error('No se encontró el ganador oficial del mes.');
     if(!Array.isArray(groupData)||groupData.length<18)throw new Error('No están disponibles los 18 resultados grupales.');
     if(vote?.status!=='closed'||!Array.isArray(vote.results)||vote.results.length!==7)throw new Error('Faltan los siete resultados definitivos de categorías.');
     const ranking=groupData.map(g=>({group_code:g.group_code,score:g.final_score}));
     const categories=vote.results;

     const rows=ranking.map(r=>({
       group_code:r.group_code,
       grade:Number(String(r.group_code||'').charAt(0)),
       score:Number(r.score??r.monthly_score??0)
     })).filter(r=>[1,2,3].includes(r.grade));

     const awards=[];
     [1,2,3].forEach(g=>{
       rows.filter(r=>r.grade===g)
         .sort((a,b)=>b.score-a.score||String(a.group_code).localeCompare(String(b.group_code),'es',{numeric:true}))
         .slice(0,3)
         .forEach((r,i)=>awards.push({...r,grade_rank:i+1,bonus:bonus(i+1)}));
     });

     const {jsPDF}=window.jspdf;
     const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'letter'});
     const W=215.9,H=279.4;
     const label=(sel.options[sel.selectedIndex]?.textContent||'Periodo').split(' · ')[0];
     // Embed the existing official app icon; never redraw or modify the logo.
     const logo=await new Promise((resolve,reject)=>{
       const img=new Image();
       img.onload=()=>{try{const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;c.getContext('2d').drawImage(img,0,0);resolve(c.toDataURL('image/png'))}catch(e){reject(e)}};
       img.onerror=()=>reject(new Error('No se pudo cargar el logo del Mérito.'));
       img.src='./icon-192.png';
     });
     doc.setFillColor(11,29,58);doc.rect(0,0,W,29,'F');
     doc.addImage(logo,'PNG',15,4,21,21);
     doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(15);
     doc.text('MÉRITO GABINO A. PALMA',42,12);
     doc.setFont('helvetica','normal');doc.setFontSize(9);
     doc.text('Reporte final del cierre mensual · '+clean(label),42,20);
     let y=36;
     doc.setFont('helvetica','bold');doc.setFontSize(11);doc.setTextColor(139,107,32);
     doc.text('Ganador del Mérito del Mes',16,y);y+=4;
     doc.setFillColor(251,247,236);doc.roundedRect(16,y,184,19,3,3,'F');
     doc.setTextColor(11,29,58);doc.setFontSize(16);
     doc.text('Grupo '+clean(d.overall.group),23,y+12);
     doc.setFont('helvetica','normal');doc.setFontSize(9.5);
     doc.text('Puntaje final: '+String(d.overall.score??'—')+' puntos',120,y+12);
     y+=26;
     doc.setFont('helvetica','bold');doc.setFontSize(11);doc.setTextColor(139,107,32);
     doc.text('Ganadores por categoría',16,y);y+=5;
     doc.setDrawColor(201,164,73);doc.line(16,y,200,y);y+=5;
     doc.setFont('helvetica','bold');doc.setFontSize(8.5);doc.setTextColor(11,29,58);
     doc.text('Categoría',18,y);doc.text('Grupo ganador',105,y);y+=4.5;
     categories.forEach(cat=>{
       doc.setFont('helvetica','normal');doc.setTextColor(21,32,51);doc.setFontSize(9);
       doc.text(clean(labels[cat.criterion_code]||cat.label||cat.criterion_code||'Categoría'),18,y);
       doc.setFont('helvetica','bold');doc.text('Grupo '+clean(cat.winner_group||cat.group_code||'—'),105,y);
       y+=5;
     });
     y+=4;
     doc.setFont('helvetica','bold');doc.setFontSize(11);doc.setTextColor(139,107,32);
     doc.text('Reconocimiento por grado y bono de arranque',16,y);y+=5;
     doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(21,32,51);
     const intro=doc.splitTextToSize('Los tres mejores grupos de cada grado iniciarán el siguiente mes con +10, +7 y +5 puntos, respectivamente. Los bonos no son acumulables.',184);
     doc.text(intro,16,y);y+=intro.length*3.5+5;
     [1,2,3].forEach(g=>{
       doc.setFont('helvetica','bold');doc.setFontSize(10);doc.setTextColor(11,29,58);
       doc.text(g===1?'1.er grado':g===2?'2.º grado':'3.er grado',16,y);y+=4;
       doc.setDrawColor(220,226,236);doc.line(16,y,200,y);y+=4;
       doc.setFontSize(8);doc.text('Lugar',18,y);doc.text('Grupo',54,y);doc.text('Puntaje',108,y);doc.text('Bono',158,y);y+=4;
       awards.filter(a=>a.grade===g).forEach(a=>{
         doc.setFont('helvetica','normal');doc.setTextColor(21,32,51);doc.setFontSize(8.6);
         doc.text(clean(ordinal(a.grade_rank)+' lugar'),18,y);
         doc.setFont('helvetica','bold');doc.text('Grupo '+clean(a.group_code),54,y);
         doc.setFont('helvetica','normal');doc.text(String(a.score),110,y);
         doc.setFont('helvetica','bold');doc.setTextColor(139,107,32);doc.text('+'+a.bonus+' puntos',158,y);
         y+=5;
       });
       y+=4;
     });
     if(y>H-32)throw new Error('El contenido excede una hoja; se canceló para evitar superposiciones.');
     doc.setDrawColor(220,226,236);doc.line(16,H-29,200,H-29);
     doc.setFont('helvetica','bold');doc.setFontSize(8);doc.setTextColor(11,29,58);
     doc.text('Administración del proyecto Mérito Gabino A. Palma',16,H-23);
     doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(21,32,51);
     doc.text('Jaime Armando Pérez Vázquez',16,H-18);
     doc.setFontSize(7);doc.setTextColor(102,112,133);
     doc.text('Documento generado con base en el cierre oficial del periodo.',16,H-11);

     const name='Cierre_Merito_'+clean(label).replace(/\s+/g,'_')+'.pdf';
     doc.save(name);
     if(st)st.innerHTML='<span class="success">✓ Reporte final del cierre generado correctamente.</span>';
   }catch(e){
     if(st)st.textContent='No se pudo generar el reporte final: '+(e.message||e);
   }finally{
     if(btn)btn.disabled=false;
   }
 }
 function wire(){
   const b=$('#meritMonthlyBonusPdfBtn');if(b)b.addEventListener('click',generate);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
})();