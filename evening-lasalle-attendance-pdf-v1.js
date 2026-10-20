/* Reporte vespertino La Salle: carta vertical, cuadrícula fija y fechas registradas */
(function(){
'use strict';
const $=s=>document.querySelector(s), G=['1C','3A','3B','3C'],COLS=20;
const MATR={"1C":"222316 202196 263324 263290 202336 212259 263391 202133 263157 263040 263320 263175 202082 263270 263353 263218 263321 263311 263041 263080 263284 202042 252244 263263 263224 202084 192179 222142 202263 263389 263370 222377","3A":"182144 243403 243358 243172 212097 243378 182047 243145 182105 182279 182087 222095 243062 243160 182262 192090 243007 243005 243098 263378 192075 243009 182006 182134 212235 192105 182140 182066 243424 243060","3B":"182173 243102 182119 192045 243355 232232 243113 243096 243057 243112 182267 253329 243064 243344 243257 243058 243395 182135 182145 243169 263356 182207 243134 182033 243267 243263 182025 243063 182036 243099 243050","3C":"243072 182154 182009 232263 182048 243356 253099 212289 243230 243180 243322 253325 263325 243323 202220 243061 243390 243377 222198 253297 243266 182043 182102 182240 253162 182169 192280 243008 202287 263395"};
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
 const W=215.9,left=18,right=8,tableW=W-left-right;
 const nW=5,nameW=63,idW=10,rightNoW=5,dateW=(tableW-nW-nameW-idW-rightNoW)/COLS;
 const x0=left,x1=x0+nW,x2=x1+nameW,x3=x2+idW,yTop=35,rowH=3.6,headerH=22;
 const maxRows=40;
 function page(chunk,part,total){
  doc.setLineWidth(.18);doc.setDrawColor(20);
  doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.text('Colegio La Salle - Mixcoac',left+10,16);
  doc.setFontSize(6);doc.text('Secundaria Vespertina     2026-2027',left+10,20);
  doc.text('Jaime Pérez Vázquez',left+10,24);
  doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text('ESPAÑOL '+(group[0]==='1'?'I':'III')+' - '+group[0]+'°'+group[1]+'C',W/2,18,{align:'center'});
  doc.setFont('helvetica','bold');doc.setFontSize(13);doc.setTextColor(28,45,91);doc.text('La',W-right-19,16,{align:'left'});doc.setTextColor(194,25,55);doc.text('★',W-right-11,16,{align:'center'});doc.setTextColor(28,45,91);doc.text('Salle',W-right-8,16,{align:'left'});
  doc.setFontSize(5);doc.text('Calidad · Mixcoac',W-right,21,{align:'right'});doc.setTextColor(20,20,20);
  doc.setFontSize(5.5);doc.text('Fechas registradas: '+from+' a '+to+'   ·   Hoja '+part+' de '+total,left,30);
  const bottom=yTop+headerH+maxRows*rowH;
  [x0,x1,x2,x3,...Array.from({length:COLS+1},(_,i)=>x3+i*dateW),W-right].forEach(x=>doc.line(x,yTop,x,bottom));
  doc.line(x0,yTop,W-right,yTop);doc.line(x0,yTop+headerH,W-right,yTop+headerH);
  for(let i=1;i<=maxRows;i++)doc.line(x0,yTop+headerH+i*rowH,W-right,yTop+headerH+i*rowH);
  doc.setFontSize(5.6);doc.text('NO. LISTA',x0+.5,yTop+headerH-2);
  doc.text('NOMBRE DEL ALUMNO',x1+nameW/2,yTop+headerH-2,{align:'center'});
  doc.text('Matrícula',x2+idW/2,yTop+headerH-2,{align:'center'});
  chunk.forEach((day,j)=>{doc.setFontSize(5);doc.text(day.slice(8,10)+'-'+day.slice(5,7),x3+j*dateW+dateW/2,yTop+headerH-1,{angle:90,align:'left'})});
  roster.slice(0,maxRows).forEach((p,i)=>{
   const y=yTop+headerH+i*rowH;
   doc.setFont('helvetica','normal');doc.setFontSize(6.1);doc.text(txt(p.list_number),x0+.6,y+2.5);doc.text(txt(p.list_number),W-right-3,y+2.5);
   let name=txt(p.name).toUpperCase();while(doc.getTextWidth(name)>nameW-2&&name.length>3)name=name.slice(0,-1);
   doc.text(name,x1+.6,y+2.5);doc.setFontSize(5.2);doc.text(txt(p.enrollment||p.matricula||p.student_number||(MATR[group]?.split(' ')[Number(p.list_number)-1])||''),x2+.3,y+2.5);
   chunk.forEach((day,j)=>{
    const status=byDay.get(day)?.get(txt(p.id));if(!status)return;
    const cx=x3+j*dateW+dateW/2,cy=y+rowH/2;
    if(/falta|ausen|inasisten/i.test(status)){doc.setLineWidth(.35);doc.line(cx-1.2,cy+1.2,cx+1.2,cy-1.2)}
    else if(/retardo/i.test(status)){doc.setFontSize(6);doc.text('R',cx,cy+1,{align:'center'})}
    else{doc.setFillColor(0);doc.circle(cx,cy,.42,'F')}
   });
  });
  doc.setFont('helvetica','bold');doc.setTextColor(29,54,104);doc.setFontSize(10);doc.text('COMUNIDAD',W-right-1,253,{align:'right'});doc.setTextColor(201,28,54);doc.setFontSize(7);doc.text('QUE TRASCIENDE',W-right-1,257,{align:'right'});doc.setTextColor(20,20,20);
 }
 const chunks=[];for(let i=0;i<dates.length;i+=COLS)chunks.push(dates.slice(i,i+COLS));
 chunks.forEach((c,i)=>{if(i)doc.addPage();page(c,i+1,chunks.length)});
 doc.save('Asistencia_LaSalle_'+group+'_'+from+'_'+to+'.pdf');
 notice.textContent='PDF generado: '+roster.length+' alumnos, '+dates.length+' fechas con registros, '+chunks.length+' hoja(s).';
 }catch(e){notice.textContent='No se pudo generar el reporte: '+(e.message||e)}finally{b.disabled=false}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();