/* Independent, read-only narrative report. Existing quarterly reports are untouched. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
function init(){
 const parent=$('quarterPdfBtn')?.parentElement;
 if(!parent||$('quarterNarrativeReportBtn'))return;
 const btn=document.createElement('button');btn.id='quarterNarrativeReportBtn';btn.type='button';btn.className='secondary';btn.textContent='Informe explicativo de reprobados (PDF)';
 parent.appendChild(btn);
 btn.addEventListener('click',async()=>{
  const get=window.__quarterNarrativeReadOnly;
  const ctx=typeof get==='function'?get():null;
  if(!ctx?.state||!ctx.roster?.length||ctx.p.shift!=='Matutino'){alert('Selecciona un grupo matutino y pulsa Calcular trimestre.');return}
  const failed=ctx.roster.map(s=>({s,c:ctx.calc(String(s.id))})).filter(x=>x.c.complete&&x.c.rounded<6);
  if(!failed.length){alert('No hay alumnos reprobados con evaluación completa en este grupo.');return}
  if(!window.jspdf?.jsPDF){alert('No está disponible el generador de PDF.');return}
  btn.disabled=true;const old=btn.textContent;btn.textContent='Preparando informe…';
  try{
   const p=ctx.p;
   const meth=await ProfeSupabase.select('methodologies','select=*&shift=eq.'+encodeURIComponent(p.shift)+'&group_name=eq.'+encodeURIComponent(p.group)+'&cycle=eq.'+encodeURIComponent(p.cycle)+'&quarter=eq.'+encodeURIComponent(p.quarter)+'&subject=eq.'+encodeURIComponent(p.subject));
   const months=(meth||[]).map(ctx.monthDataFromRow).filter(m=>['Septiembre','Octubre'].includes(m.month));
   const acts=await all('activities'),records=await all('activityRecords');
   const map=new Map(records.map(r=>[ctx.recordKey(r),r]));
   const doc=new window.jspdf.jsPDF({orientation:'portrait',unit:'mm',format:'letter'});
   const H=doc.internal.pageSize.getHeight(),W=doc.internal.pageSize.getWidth();
   function para(t,y){doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(40,40,40);const lines=doc.splitTextToSize(t,W-32);if(y+lines.length*4.4>H-22)throw Error('El texto excede una hoja; no se generó un documento incompleto.');doc.text(lines,16,y);return y+lines.length*4.4+5}
   for(let i=0;i<failed.length;i++){
    if(i)doc.addPage();
    const {s,c}=failed[i];
    if(typeof pdfHeader==='function')pdfHeader(doc,'Informe de desempeño trimestral','ESPAÑOL');
    else{doc.setFillColor(245,196,0);doc.rect(0,0,W,4,'F');doc.setFont('helvetica','bold');doc.setFontSize(15);doc.text('Informe de desempeño trimestral',16,19)}
    let y=38;doc.setFont('helvetica','bold');doc.setFontSize(11);doc.setTextColor(33,27,18);
    doc.text(doc.splitTextToSize(ctx.displayName(s),W-32)[0],16,y);y+=7;
    y=para('Grupo '+p.group+' · Trimestre '+p.quarter+' · Ciclo '+p.cycle+' · Calificación final: '+c.rounded.toFixed(1),y);
    doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text('Resultado trimestral',16,y);y+=6;
    y=para('La calificación final de '+c.rounded.toFixed(1)+' es inferior al mínimo aprobatorio de 6. Se calcula con proyecto integrador (35%), evaluaciones mensuales (30%), examen (22%) y responsabilidad (13%).',y);
    const missingProjects=c.items.filter(it=>!c.statuses[String(it.id)]);
    y=para('Proyecto integrador: '+(c.items.length-missingProjects.length)+' de '+c.items.length+' trabajos registrados; aportó '+c.projectContribution.toFixed(2)+' de 3.50 puntos.'+(missingProjects.length?' Pendientes: '+missingProjects.map(it=>it.name).join(', ')+'.':'')+(c.lateCount?' Entregas extemporáneas: '+c.lateCount+'.':''),y);
    y=para('Evaluaciones mensuales: '+c.months.map(m=>m.month+' '+m.value.toFixed(1)).join('; ')+'. Promedio '+c.monthlyAvg.toFixed(2)+'; aportación '+c.monthlyContribution.toFixed(2)+' de 3.00 puntos.',y);
    const pending=[];
    for(const m of months)for(const cm of ctx.monthlyCriterionModel(m,String(s.id),acts,map))if(cm.missing)pending.push([m.month,cm.criterion.name||'Criterio',String(cm.done)+' / '+cm.total,String(cm.missing)]);
    if(pending.length){
     doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text('Desglose de actividades pendientes',16,y);y+=6;
     y=para('Se muestran los registros sin entrega o sin calificación, únicamente de las actividades aplicables a este alumno.',y);
     const cols=[16,45,131,166],heads=['Mes','Criterio','Entregadas','Pend.'];
     const tableHeight=9+pending.reduce((sum,row)=>sum+Math.max(8,doc.splitTextToSize(row[1],80).length*4+3),0);
     if(y+tableHeight>H-62)throw Error('La tabla de '+ctx.displayName(s)+' no cabe en una hoja carta.');
     doc.setFillColor(245,196,0);doc.rect(16,y-4,W-32,8,'F');
     doc.setFont('helvetica','bold');doc.setFontSize(8);doc.setTextColor(33,27,18);heads.forEach((h,j)=>doc.text(h,cols[j],y));y+=8;
     pending.forEach((row,k)=>{
      const lines=doc.splitTextToSize(row[1],80),rh=Math.max(8,lines.length*4+3);
      if(k%2===0){doc.setFillColor(249,247,240);doc.rect(16,y-4,W-32,rh,'F')}
      doc.setFont('helvetica','normal');doc.setFontSize(7.7);doc.setTextColor(45,45,45);
      doc.text(row[0],cols[0],y);doc.text(lines,cols[1],y);doc.text(row[2],cols[2],y);
      doc.setFont('helvetica','bold');doc.setTextColor(170,40,40);doc.text(row[3],cols[3],y);y+=rh;
     });y+=5;
    }
    y=para('Examen trimestral: '+c.exam.toFixed(1)+' (aporta '+c.examContribution.toFixed(2)+' de 2.20). Responsabilidad: '+c.resp.toFixed(1)+' (aporta '+c.respContribution.toFixed(2)+' de 1.30).'+(c.quarterPoints?' Puntos adicionales: '+c.quarterPoints.toFixed(2)+'.':''),y);
    doc.setFont('helvetica','bold');doc.setFontSize(10);doc.setTextColor(33,27,18);doc.text('Conclusión',16,y);y+=6;
    const causes=[];if(missingProjects.length)causes.push(missingProjects.length+' trabajos del proyecto no entregados');if(pending.length)causes.push(pending.reduce((n,r)=>n+Number(r[3]),0)+' registros mensuales pendientes');if(c.exam<6)causes.push('examen trimestral inferior a 6');
    y=para('La calificación resulta de la ponderación registrada.'+(causes.length?' Los principales factores identificados son: '+causes.join('; ')+'.':' Se recomienda revisar cada componente con el desglose trimestral.')+' Se recomienda dar seguimiento a las entregas del siguiente trimestre.',y);
    doc.setFontSize(7);doc.setTextColor(90,90,90);doc.text('Documento informativo · No modifica calificaciones.',16,H-12);
   }
   if(typeof pdfFooter==='function')pdfFooter(doc);
   if(typeof printContent==='function')printContent('Informe explicativo de reprobados','<p>'+failed.length+' alumnos; una hoja carta por estudiante.</p>',doc.output('blob'),'informe_explicativo_'+p.group+'_T'+p.quarter+'.pdf');
   else doc.save('informe_explicativo_'+p.group+'_T'+p.quarter+'.pdf');
  }catch(e){console.error(e);alert('No se pudo generar el informe: '+(e.message||e))}
  finally{btn.disabled=false;btn.textContent=old}
 });
}
window.addEventListener('load',init);
})();
