(function(){
 const $=s=>document.querySelector(s);
 async function rpc(name,args={}){
   window.ProfeSupabase?.restore?.();
   if(!window.ProfeSupabase)throw new Error('No hay sesión administrativa');
   return window.ProfeSupabase.rpc(name,args);
 }
 function clean(v){return String(v??'').replace(/\s+/g,' ').trim()}
 function signed(n){n=Number(n||0);return (n>0?'+':'')+n}
 function sum(list){return (Array.isArray(list)?list:[]).reduce((a,x)=>a+Number(x.points||0),0)}
 function normalizedReason(reason){
   const r=clean(reason);
   if(r==='Descuento general de 15 puntos por situaciones recientes de indisciplina a nivel escolar'){
     return 'Ajuste general de convivencia escolar';
   }
   return r;
 }
 function compactReasons(list,limit=5){
   const a=(Array.isArray(list)?list:[]).map(x=>({...x,reason:normalizedReason(x.reason)}));
   if(a.length<=limit)return a;
   const keep=a.slice(0,limit);
   const rest=a.slice(limit);
   keep.push({reason:'Otros movimientos',points:sum(rest)});
   return keep;
 }
 function ordinalRank(n){
   n=Number(n||0);
   return n===1?'1.er lugar':n+'.º lugar';
 }
 function strengthsText(g){
   const pos=Array.isArray(g.positive_reasons)?g.positive_reasons:[];
   const strengths=pos.slice(0,3).map(x=>clean(x.reason)).filter(Boolean);
   if(strengths.length)return strengths.join(', ');
   return 'la participación y el esfuerzo sostenido del grupo';
 }
 function motivationalText(g){
   const rank=Number(g.rank||0);
   if(rank===1)return '¡Felicidades! Su constancia los llevó al primer lugar. Sigan cuidando lo que ya hacen bien y busquen superarse todavía más el próximo mes.';
   if(rank<=3)return 'Van por muy buen camino. Mantengan sus fortalezas, sigan participando y trabajen en los pequeños detalles que pueden llevarlos todavía más arriba.';
   if(Number(g.final_score||0)>=0)return 'El grupo tiene elementos positivos sobre los cuales seguir construyendo. Con constancia, organización y trabajo en equipo pueden subir posiciones el próximo mes.';
   return 'Hay mucho margen para crecer. Organícense, trabajen como equipo y tomen este resultado como un punto de partida para demostrar de lo que son capaces el próximo mes.';
 }
 function analysisText(g){
   const neg=(Array.isArray(g.negative_reasons)?g.negative_reasons:[])
     .filter(x=>clean(x.reason)!=='Descuento general de 15 puntos por situaciones recientes de indisciplina a nivel escolar')
     .map(x=>({...x,reason:normalizedReason(x.reason)}));
   const b=g.bitacora||{};
   const follow=Number(b.quality_adjustment||0)+Number(b.followup_extra||0);
   const loss=Number(b.loss_adjustment||0);
   const obs=Number(b.deduction||0);
   const issues=neg.slice(0,2).map(x=>clean(x.reason)).filter(Boolean);
   if(obs<0)issues.push('observaciones de bitácora');
   if(follow<0)issues.push('seguimiento de bitácora');
   if(loss<0)issues.push('no entrega o extravío de bitácora');
   let t='El grupo cerró el periodo en '+ordinalRank(g.rank)+' con '+signed(g.final_score)+' puntos.';
   t+=' Entre sus fortalezas destacaron '+strengthsText(g)+'.';
   if(issues.length)t+=' El próximo mes pueden enfocarse especialmente en '+[...new Set(issues)].slice(0,3).join(', ')+'.';
   else t+=' El reto para el próximo mes será mantener la constancia y seguir participando con la misma actitud.';
   return t;
 }
 async function imageData(url){
   return new Promise((resolve,reject)=>{
     const img=new Image();img.crossOrigin='anonymous';
     img.onload=()=>{
       try{const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const x=c.getContext('2d');x.drawImage(img,0,0);resolve(c.toDataURL('image/png'))}catch(e){reject(e)}
     };
     img.onerror=reject;img.src=url+'?v=report1';
   });
 }
 function blockTitle(doc,title,y){
   doc.setFont('helvetica','bold');doc.setFontSize(11);doc.setTextColor(11,29,58);doc.text(title,16,y);
   doc.setDrawColor(201,164,73);doc.setLineWidth(.5);doc.line(16,y+2,200,y+2);
   return y+7;
 }
 function reasonList(doc,list,x,y,w,max=6){
   const rows=compactReasons(list,max);
   doc.setFontSize(8.5);
   if(!rows.length){doc.setFont('helvetica','normal');doc.setTextColor(102,112,133);doc.text('Sin movimientos registrados.',x,y);return y+5}
   rows.forEach(r=>{
     doc.setFont('helvetica','normal');doc.setTextColor(21,32,51);
     const txt=doc.splitTextToSize(clean(r.reason),w-25);
     doc.text(txt,x,y);
     doc.setFont('helvetica','bold');
     doc.text(signed(r.points),x+w,y,{align:'right'});
     y+=Math.max(4,txt.length*3.6);
   });
   return y;
 }
 function addPage(doc,g,label,logo){
   const W=215.9,H=279.4;
   doc.setFillColor(11,29,58);doc.rect(0,0,W,28,'F');
   if(logo){try{doc.addImage(logo,'PNG',14,5,18,18)}catch(_){}}
   doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(15);
   doc.text('MÉRITO GABINO A. PALMA',38,11);
   doc.setFontSize(9);doc.setFont('helvetica','normal');doc.text('Reporte mensual de desempeño grupal',38,17);
   doc.text(label,38,22);

   doc.setTextColor(11,29,58);doc.setFont('helvetica','bold');doc.setFontSize(22);
   doc.text('Grupo '+g.group_code,16,42);
   doc.setFontSize(9);doc.setFont('helvetica','normal');doc.setTextColor(102,112,133);
   doc.text('Resumen para el jefe de grupo',16,48);

   doc.setFillColor(251,247,236);doc.roundedRect(16,54,184,27,3,3,'F');
   doc.setTextColor(139,107,32);doc.setFont('helvetica','bold');doc.setFontSize(9);
   doc.text('PUNTUACIÓN FINAL',24,63);doc.text('LUGAR OBTENIDO',114,63);
   doc.setTextColor(11,29,58);doc.setFontSize(18);
   doc.text(signed(g.final_score)+' pts',24,73);doc.text(ordinalRank(g.rank),114,73);

   let y=91;
   y=blockTitle(doc,'Así cerró tu grupo este mes',y);
   doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(21,32,51);
   const ana=doc.splitTextToSize(analysisText(g),184);doc.text(ana,16,y);y+=ana.length*4+4;
   doc.setFont('helvetica','bold');doc.setTextColor(139,107,32);
   const mot=doc.splitTextToSize(motivationalText(g),184);doc.text(mot,16,y);y+=mot.length*4+5;

   y=blockTitle(doc,'Movimientos que sumaron puntos',y);
   y=reasonList(doc,g.positive_reasons,18,y,178,5)+3;

   y=blockTitle(doc,'Movimientos que restaron puntos',y);
   y=reasonList(doc,g.negative_reasons,18,y,178,5)+2;
   const generalConv=(Array.isArray(g.negative_reasons)?g.negative_reasons:[]).some(x=>clean(x.reason)==='Descuento general de 15 puntos por situaciones recientes de indisciplina a nivel escolar');
   if(generalConv){
     doc.setFillColor(247,248,250);doc.roundedRect(16,y,184,16,2,2,'F');
     doc.setFont('helvetica','bold');doc.setFontSize(8.3);doc.setTextColor(11,29,58);
     doc.text('Ajuste general del periodo',20,y+6);
     doc.setFont('helvetica','normal');doc.setFontSize(7.8);doc.setTextColor(21,32,51);
     const convivencia=doc.splitTextToSize('Se aplicó un ajuste general de -15 puntos a todos los grupos por situaciones de convivencia escolar a nivel general. Este ajuste no corresponde a una falta específica de este grupo.',174);
     doc.text(convivencia,20,y+11);
     y+=19;
   }else y+=1;

   const b=g.bitacora||{};
   const follow=Number(b.quality_adjustment||0)+Number(b.followup_extra||0);
   const loss=Number(b.loss_adjustment||0);
   const bitTotal=Number(b.deduction||0)+follow+loss;
   y=blockTitle(doc,'Bitácora del grupo',y);
   doc.setFontSize(8.8);doc.setTextColor(21,32,51);doc.setFont('helvetica','normal');
   const bitLines=[
     'Observaciones registradas: '+Number(b.observations||0),
     'Ajuste por número de observaciones: '+signed(b.deduction),
     'Seguimiento de la bitácora: '+signed(follow),
     'No entrega o extravío: '+signed(loss),
     'Resultado total de bitácora: '+signed(bitTotal)+' puntos'
   ];
   bitLines.forEach((t,i)=>{if(i===4)doc.setFont('helvetica','bold');doc.text(t,18,y);y+=4.2});

   y+=2;y=blockTitle(doc,'Recomendación para el próximo mes',y);
   doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(21,32,51);
   const recBase=clean(g.recommendation)||'Mantengan el buen trabajo en equipo y concéntrense en los aspectos que pueden ayudarles a seguir avanzando el próximo mes.';
   const rec=doc.splitTextToSize(recBase+' Confíen en el trabajo del grupo: con constancia y organización pueden mejorar su resultado.',184);
   doc.text(rec,16,y);

   doc.setDrawColor(220,226,236);doc.line(16,H-30,200,H-30);
   doc.setFont('helvetica','bold');doc.setFontSize(8.5);doc.setTextColor(11,29,58);
   doc.text('Administración del proyecto Mérito Gabino A. Palma',16,H-23);
   doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(21,32,51);
   doc.text('Jaime Armando Pérez Vázquez',16,H-18);
   doc.setFontSize(7.2);doc.setTextColor(102,112,133);
   doc.text('Este reporte resume los registros del periodo y busca orientar al grupo para seguir mejorando.',16,H-11);
 }
 async function generate(){
   const btn=$('#meritMonthlyGroupPdfBtn'),st=$('#meritMonthlyStatus'),sel=$('#meritMonthlyPeriod');
   if(!sel?.value)return;
   if(!window.jspdf?.jsPDF){if(st)st.textContent='No se pudo cargar el generador de PDF.';return}
   if(btn)btn.disabled=true;if(st)st.textContent='Generando reportes por grupo…';
   try{
     const data=await rpc('teacher_merit_monthly_group_report_data',{p_period_id:sel.value});
     if(!Array.isArray(data)||!data.length)throw new Error('No hay datos del periodo.');
     const {jsPDF}=window.jspdf;
     const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'letter'});
     let logo=null;try{logo=await imageData('./icon-192.png')}catch(_){}
     const label=(sel.options[sel.selectedIndex]?.textContent||'Periodo').split(' · ')[0];
     data.forEach((g,i)=>{if(i)doc.addPage('letter','portrait');addPage(doc,g,label,logo)});
     const name='Reporte_Merito_'+label.replace(/\s+/g,'_').replace(/[^\wáéíóúÁÉÍÓÚñÑ-]/g,'')+'.pdf';
     doc.save(name);
     if(st)st.innerHTML='<span class="success">✓ Reporte generado: una página por grupo.</span>';
   }catch(e){if(st)st.textContent='No se pudo generar el reporte: '+(e.message||e)}
   finally{if(btn)btn.disabled=false}
 }
 function wire(){
   const b=$('#meritMonthlyGroupPdfBtn');if(b)b.addEventListener('click',generate);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
})();