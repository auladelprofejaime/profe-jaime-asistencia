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
 async function generate(){
   const btn=$('#meritMonthlyBonusPdfBtn'),st=$('#meritMonthlyStatus'),sel=$('#meritMonthlyPeriod');
   if(!sel?.value)return;
   if(!window.jspdf?.jsPDF){if(st)st.textContent='No se pudo cargar el generador de PDF.';return}
   if(btn)btn.disabled=true;
   if(st)st.textContent='Generando PDF de bonos de arranque…';
   try{
     const d=await rpc('teacher_merit_monthly_result',{p_period_id:sel.value});
     if(!d?.overall?.group)throw new Error('El mes todavía no está cerrado.');
     const ranking=Array.isArray(d.ranking)?d.ranking:[];
     if(!ranking.length)throw new Error('No hay ranking mensual cerrado.');
     const rows=ranking.map(r=>({
       group_code:r.group_code,
       grade:Number(String(r.group_code||'').charAt(0)),
       score:Number(r.score??r.monthly_score??0)
     })).filter(r=>[1,2,3].includes(r.grade));
     const byGrade={1:[],2:[],3:[]};
     Object.keys(byGrade).forEach(g=>{
       byGrade[g]=rows.filter(r=>r.grade===Number(g)).sort((a,b)=>b.score-a.score||String(a.group_code).localeCompare(String(b.group_code),'es',{numeric:true}));
     });
     const awards=[];
     [1,2,3].forEach(g=>{
       byGrade[g].slice(0,3).forEach((r,i)=>awards.push({...r,grade_rank:i+1,bonus:bonus(i+1)}));
     });
     const {jsPDF}=window.jspdf;
     const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'letter'});
     const W=215.9,H=279.4;
     doc.setFillColor(11,29,58);doc.rect(0,0,W,30,'F');
     doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(16);
     doc.text('MÉRITO GABINO A. PALMA',16,12);
     doc.setFontSize(10);doc.setFont('helvetica','normal');
     doc.text('Bonos de arranque del siguiente mes',16,20);
     const label=(sel.options[sel.selectedIndex]?.textContent||'Periodo').split(' · ')[0];
     doc.text('Resultados oficiales de '+label,16,26);

     let y=42;
     doc.setTextColor(11,29,58);doc.setFont('helvetica','bold');doc.setFontSize(11);
     doc.text('Criterio de asignación',16,y);y+=6;
     doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(21,32,51);
     const intro=doc.splitTextToSize('Se reconoce a los tres grupos con mejor puntaje final de cada grado. El 1.er lugar inicia el siguiente mes con +10 puntos, el 2.º con +7 y el 3.º con +5. Los bonos no se acumulan por otros reconocimientos.',184);
     doc.text(intro,16,y);y+=intro.length*4+7;

     [1,2,3].forEach(g=>{
       doc.setFont('helvetica','bold');doc.setFontSize(12);doc.setTextColor(139,107,32);
       doc.text(g+'er grado'.replace('1er','1.er').replace('2er','2.º').replace('3er','3.er'),16,y);
       y+=4;
       doc.setDrawColor(201,164,73);doc.line(16,y,200,y);y+=6;
       doc.setFontSize(9);doc.setTextColor(11,29,58);
       doc.text('Lugar',18,y);doc.text('Grupo',50,y);doc.text('Puntaje final',95,y);doc.text('Bono siguiente mes',150,y);
       y+=5;
       awards.filter(a=>a.grade===g).forEach(a=>{
         doc.setFont('helvetica','normal');doc.setTextColor(21,32,51);
         doc.text(ordinal(a.grade_rank)+' lugar',18,y);
         doc.setFont('helvetica','bold');doc.text('Grupo '+a.group_code,50,y);
         doc.setFont('helvetica','normal');doc.text(String(a.score),100,y);
         doc.setFont('helvetica','bold');doc.setTextColor(139,107,32);doc.text('+'+a.bonus+' puntos',150,y);
         y+=6;
       });
       y+=5;
     });

     doc.setDrawColor(220,226,236);doc.line(16,H-34,200,H-34);
     doc.setFont('helvetica','bold');doc.setFontSize(8.5);doc.setTextColor(11,29,58);
     doc.text('Administración del proyecto Mérito Gabino A. Palma',16,H-26);
     doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(21,32,51);
     doc.text('Jaime Armando Pérez Vázquez',16,H-21);
     doc.setFontSize(7.3);doc.setTextColor(102,112,133);
     doc.text('Documento generado con base en el cierre oficial del periodo.',16,H-14);

     const name='Bonos_arranque_'+clean(label).replace(/\s+/g,'_')+'.pdf';
     doc.save(name);
     if(st)st.innerHTML='<span class="success">✓ PDF de bonos de arranque generado correctamente.</span>';
   }catch(e){
     if(st)st.textContent='No se pudo generar el PDF de bonos: '+(e.message||e);
   }finally{
     if(btn)btn.disabled=false;
   }
 }
 function wire(){
   const b=$('#meritMonthlyBonusPdfBtn');if(b)b.addEventListener('click',generate);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
})();