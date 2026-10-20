/* Reporte vespertino La Salle: carta vertical, cuadrícula fija y fechas registradas */
(function(){
'use strict';
const $=s=>document.querySelector(s), G=['1C','3A','3B','3C'],COLS=20;
const txt=v=>String(v??'');
function init(){
 const box=$('.attendance-report-tools');if(!box)return;
 const b=document.createElement('button');b.id='lasallePdfBtn';b.type='button';b.className='secondary';b.textContent='PDF La Salle · formato original';b.style.marginTop='10px';box.appendChild(b);
 const hint=document.createElement('p');hint.id='lasallePdfStatus';hint.className='hint';hint.textContent='Turno vespertino: hoja carta vertical, fechas con lista registrada, punto para asistencia y diagonal para falta.';box.appendChild(hint);
 b.addEventListener('click',generate);
}
async function generate(){
 const b=$('#lasallePdfBtn'),notice=$('#lasallePdfStatus');b.disabled=true;
 try{
 const shift=$('#attShift')?.value||'',group=txt($('#attGroup')?.value).replace(/[^a-z0-9]/gi,'').toUpperCase();
 if(!/vespertino/i.test(shift)||!G.includes(group))throw Error('Selecciona turno Vespertino y uno de los grupos 1C, 3A, 3B o 3C.');
 const from=$('#attReportFrom')?.value,to=$('#attReportTo')?.value;
 if(!from||!to||from>to)throw Error('Selecciona un rango válido en Desde y Hasta.');
 const api=window.ProfeSupabase;if(!api?.select)throw Error('No hay conexión con la base de datos.');
 notice.textContent='Consultando asistencia guardada…';
 const students=await api.select('students','select=*&shift=eq.Vespertino&group_name=eq.'+encodeURIComponent(group)+'&order=list_number.asc');
 const roster=(students||[]).filter(x=>x.group_name===group&&x.shift==='Vespertino').sort((a,b)=>Number(a.list_number)-Number(b.list_number));
 if(!roster.length)throw Error('No hay alumnos registrados para '+group+'.');
 const ids=roster.map(x=>x.id);
 const all=[];
 for(let i=0;i<ids.length;i+=35){
  const part=ids.slice(i,i+35);
  const data=await api.select('attendance','select=student_id,attendance_date,status&attendance_date=gte.'+from+'&attendance_date=lte.'+to+'&student_id=in.('+part.map(encodeURIComponent).join(',')+')&order=attendance_date.asc');
  all.push(...(data||[]));
 }
 const byDay=new Map();
 for(const x of all){if(!byDay.has(x.attendance_date))byDay.set(x.attendance_date,new Map());byDay.get(x.attendance_date).set(txt(x.student_id),x.status)}
 const dates=[...byDay.keys()].sort();
 if(!dates.length)throw Error('No hay pases de lista guardados dentro del rango seleccionado.');
 const jsPDF=window.jspdf?.jsPDF;if(!jsPDF)throw Error('No se pudo cargar el generador de PDF.');
 const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'letter'});
 const W=215.9,left=13,right=13,tableW=W-left-right;
 const nW=7,nameW=65,idW=12,dateW=(tableW-nW-nameW-idW)/COLS;
 const x0=left,x1=x0+nW,x2=x1+nameW,x3=x2+idW,yTop=34,rowH=3.9,headerH=22;
 const maxRows=40;
 function page(chunk,part,total){
  doc.setLineWidth(.18);doc.setDrawColor(20);
  doc.setFont('helvetica','normal');doc.setFontSize(9);doc.text('Colegio La Salle - Mixcoac',left+26,16);
  doc.setFontSize(7);doc.text('Secundaria Vespertina   2026-2027',left+26,21);
  doc.text('Jaime Pérez Vázquez',left+26,25);
  doc.setFont('helvetica','bold');doc.setFontSize(11);doc.text('ESPAÑOL '+(group[0]==='1'?'I':'III')+' - '+group[0]+'°'+group[1],W/2+26,19,{align:'center'});
  doc.setFont('helvetica','bold');doc.setFontSize(13);doc.text('La Salle',W-right,18,{align:'right'});
  doc.setFontSize(6);doc.text('Calidad · Mixcoac',W-right,22,{align:'right'});
  doc.setFontSize(6);doc.text('Fechas registradas: '+from+' a '+to+'   ·   Hoja '+part+' de '+total,left,30);
  const bottom=yTop+headerH+maxRows*rowH;
  [x0,x1,x2,x3,...Array.from({length:COLS+1},(_,i)=>x3+i*dateW)].forEach(x=>doc.line(x,yTop,x,bottom));
  doc.line(x0,yTop,W-right,yTop);doc.line(x0,yTop+headerH,W-right,yTop+headerH);
  for(let i=1;i<=maxRows;i++)doc.line(x0,yTop+headerH+i*rowH,W-right,yTop+headerH+i*rowH);
  doc.setFontSize(5.6);doc.text('No.',x0+1,yTop+headerH-2);
  doc.text('NOMBRE DEL ALUMNO',x1+nameW/2,yTop+headerH-2,{align:'center'});
  doc.text('MATRÍC.',x2+idW/2,yTop+headerH-2,{align:'center'});
  chunk.forEach((day,j)=>{doc.setFontSize(6);doc.text(day.slice(8,10)+'-'+day.slice(5,7),x3+j*dateW+dateW/2,yTop+headerH-2,{angle:90,align:'left'})});
  roster.slice(0,maxRows).forEach((p,i)=>{
   const y=yTop+headerH+i*rowH;
   doc.setFont('helvetica','normal');doc.setFontSize(6.4);doc.text(txt(p.list_number),x0+1,y+2.8);
   let name=txt(p.name).toUpperCase();while(doc.getTextWidth(name)>nameW-2&&name.length>3)name=name.slice(0,-1);
   doc.text(name,x1+1,y+2.8);doc.setFontSize(6);doc.text(txt(p.enrollment||p.matricula||p.student_number||''),x2+.5,y+2.8);
   chunk.forEach((day,j)=>{
    const status=byDay.get(day)?.get(txt(p.id));if(!status)return;
    const cx=x3+j*dateW+dateW/2,cy=y+rowH/2;
    if(/falta|ausen|inasisten/i.test(status)){doc.setLineWidth(.35);doc.line(cx-1.2,cy+1.2,cx+1.2,cy-1.2)}
    else if(/retardo/i.test(status)){doc.setFontSize(6);doc.text('R',cx,cy+1,{align:'center'})}
    else{doc.setFillColor(0);doc.circle(cx,cy,.42,'F')}
   });
  });
  doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text('COMUNIDAD',W-right,251,{align:'right'});doc.setFontSize(7);doc.text('QUE TRASCIENDE',W-right,255,{align:'right'});
 }
 const chunks=[];for(let i=0;i<dates.length;i+=COLS)chunks.push(dates.slice(i,i+COLS));
 chunks.forEach((c,i)=>{if(i)doc.addPage();page(c,i+1,chunks.length)});
 doc.save('Asistencia_LaSalle_'+group+'_'+from+'_'+to+'.pdf');
 notice.textContent='PDF generado: '+roster.length+' alumnos, '+dates.length+' fechas con registros, '+chunks.length+' hoja(s).';
 }catch(e){notice.textContent='No se pudo generar el reporte: '+(e.message||e)}finally{b.disabled=false}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();