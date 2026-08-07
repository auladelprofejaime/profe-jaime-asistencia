
const $$=s=>[...document.querySelectorAll(s)];
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const same=(a,b)=>String(a||'').replace(/\s+/g,'').toUpperCase()===String(b||'').replace(/\s+/g,'').toUpperCase();
function setView(id){$$('.view').forEach(v=>v.classList.toggle('active',v.id===id));$$('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===id));window.scrollTo({top:0,behavior:'smooth'})}
$$('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));

import {all,getStudentBundle,getAvailability,put} from '../shared/local-adapter.js';
let currentId='',bundle=null;
function recordMap(){return new Map((bundle?.activityRecords||[]).map(r=>[r.key,r]))}
async function init(){
 const list=(await all('students')).sort((a,b)=>String(a.name).localeCompare(String(b.name),'es'));
 $('#studentPicker').innerHTML=list.length?list.map(s=>`<option value="${esc(s.id)}">${esc(s.name||s.id)} · ${esc(s.group)}</option>`).join(''):'<option>Sin alumnos en este dispositivo</option>';
 if(list.length){currentId=list[0].id;$('#studentPicker').value=currentId;await load()}
 $('#studentPicker').onchange=async e=>{currentId=e.target.value;await load()};
 $('#acceptChat').onclick=()=>{$('#chatPolicy').hidden=true;$('#chatComposer').hidden=false};
 $('#writeTeacher').onclick=()=>$('#messageBox').hidden=false;
 $$('[data-faq]').forEach(b=>b.onclick=()=>showFaq(b.dataset.faq));
 $('#sendStudentMessage').onclick=sendMessage;
}
function showFaq(q){
 const answers={'¿Cuándo se entrega?':'Revisa la tarjeta de la actividad: ahí aparece la fecha registrada por el profesor.','¿Qué debo hacer?':'Abre la actividad y revisa la descripción o el material asociado. Si no es suficiente, puedes escribir al profesor.','¿Cómo se califica?':'Consulta Calificaciones. La metodología y los criterios dependen del periodo configurado por el profesor.','¿Dónde encuentro el material?':'En la sección Materiales encontrarás los enlaces publicados para tu grupo.'};
 $('#faqAnswer').textContent=answers[q]||''}
async function load(){
 bundle=await getStudentBundle(currentId);if(!bundle)return;
 $('#hello').textContent=`Hola, ${(bundle.student.name||'').split(' ')[0]||'alumno'}.`;
 renderSummary();renderNotices();renderActivities();renderAttendance();renderGrades();renderMaterials();renderStudy();renderReports();
}
function currentGrade(){
 const closed=(bundle.methodologies||[]).filter(m=>m.closed&&m.gradeRecords?.[currentId]?.finalDecimal!=null).sort((a,b)=>String(b.closedAt||b.updated||'').localeCompare(String(a.closedAt||a.updated||'')));
 return closed[0]?.gradeRecords?.[currentId]||null;
}
function pointsAvailable(){
 let earned=0,used=0;(bundle.methodologies||[]).forEach(m=>{let r=m.gradeRecords?.[currentId];if(r){earned+=Number(r.pointsGenerated||0);used+=Number(r.pointsUsed||0)}});return Math.max(0,earned-used)
}
function renderSummary(){let g=currentGrade(),present=bundle.attendance.filter(a=>(a.status||'Presente')!=='Falta').length;
 $('#summaryCards').innerHTML=[['Asistencia',present],['Actividades',bundle.activities.length],['Calificación actual',g?.finalDecimal?.toFixed(2)||'—'],['Puntos disponibles',pointsAvailable().toFixed(2)],['Reportes',bundle.reports.length],['Materiales',bundle.materials.length],['Avisos',bundle.notices.length]].map(x=>`<div class="tile"><b>${x[1]}</b><span>${x[0]}</span></div>`).join('')}
function renderNotices(){$('#homeNotices').innerHTML=bundle.notices.length?bundle.notices.map(n=>`<div class="card"><b>${esc(n.title)}</b><p>${esc(n.text)}</p></div>`).join(''):'<div class="card muted">Sin avisos nuevos.</div>'}
function renderActivities(){let map=recordMap();$('#activityCards').innerHTML=bundle.activities.length?bundle.activities.sort((a,b)=>String(b.date).localeCompare(String(a.date))).map(a=>{let r=map.get(`${a.id}|${currentId}`),mode=a.evaluationMode||'delivery',done=mode==='numeric'?typeof r?.score==='number':r?.status==='yes',pending=mode==='delivery'&&r?.status==='no';return `<div class="card activity"><div><b>${esc(a.name)}</b><p class="muted">${esc(a.type||'Actividad')} · ${esc(a.date||'Sin fecha')}</p></div><div>${done?'<span class="pill green">Entregada</span>':pending?'<span class="pill red">Pendiente</span>':'<span class="pill yellow">Sin registro</span>'}${typeof r?.score==='number'?`<p><b>${r.score}</b>/10</p>`:''}</div></div>`}).join(''):'<div class="card muted">No hay actividades publicadas.</div>'}
function renderAttendance(){let now=new Date(),y=now.getFullYear(),m=now.getMonth(),days=new Date(y,m+1,0).getDate(),map=new Map(bundle.attendance.filter(a=>{let d=new Date(a.date+'T12:00:00');return d.getFullYear()===y&&d.getMonth()===m}).map(a=>[Number(a.date.slice(-2)),a]));let first=new Date(y,m,1).getDay();let cells='';for(let i=0;i<first;i++)cells+='<div></div>';for(let d=1;d<=days;d++){let a=map.get(d),st=a?.status||'',c=st==='Falta'?'#ef4555':st==='Retardo'?'#ffd43b':a?'#43d17d':'';cells+=`<div class="day"><b>${d}</b>${c?`<div><span class="dot" style="background:${c}"></span> ${esc(st||'Presente')}</div>`:''}</div>`}$('#attendanceCalendar').innerHTML=cells}
function renderGrades(){let g=currentGrade(),pct=g?Math.min(100,(Number(g.finalDecimal||0)/10)*100):0;$('#gradeContent').innerHTML=`<div class="card"><h3>Calificación actual</h3><h1>${g?.finalDecimal?.toFixed(2)||'—'}</h1><div class="progress"><i style="width:${pct}%"></i></div><p>Redondeada: <b>${g?.rounded??'—'}</b></p><p>Puntos disponibles: <b>${pointsAvailable().toFixed(2)}</b></p></div>`}
function renderMaterials(){
 $('#materialCards').innerHTML=bundle.materials.length?bundle.materials.map(m=>`<button class="card action" data-material="${esc(m.id)}"><b>${esc(m.title)}</b><p class="muted">${esc(m.type)} · ${m.source==='file'?'Archivo':'Enlace'}</p>${m.fileName?`<small class="muted">${esc(m.fileName)}</small>`:''}</button>`).join(''):'<div class="card muted">Sin materiales publicados.</div>';
 $$('[data-material]').forEach(b=>b.onclick=()=>openMaterial(b.dataset.material));
}
function openMaterial(id){
 const m=bundle.materials.find(x=>x.id===id);if(!m)return;
 if(m.source==='file'&&m.fileData){
   const blob=new Blob([m.fileData],{type:m.mime||'application/octet-stream'}),url=URL.createObjectURL(blob);
   window.open(url,'_blank');
 }else if(m.url)window.open(m.url,'_blank');
 else alert('Este material todavía no tiene un archivo o enlace disponible.');
}
function renderStudy(){$('#studyTopics').innerHTML=bundle.studyTopics.length?bundle.studyTopics.map(t=>`<div class="card"><b>${esc(t.title)}</b><p class="muted">${esc(t.notes||'Tema trabajado')}</p><div class="question-actions"><button class="action">Trivia rápida</button><button class="action">Examen</button><button class="action">Pregunta del día</button><button class="action">Repaso</button></div><small class="muted">Generación automática con IA: preparada para una versión futura.</small></div>`).join(''):'<div class="card muted">Todavía no hay temas publicados.</div>'}
function renderReports(){$('#studentReports').innerHTML=bundle.reports.length?bundle.reports.map(r=>`<button class="card action" data-report-id="${r.id}"><b>${esc(r.title)}</b><p class="muted">${new Date(r.created).toLocaleString('es-MX')}</p></button>`).join(''):'<div class="card muted">Sin reportes archivados.</div>';$$('[data-report-id]').forEach(b=>b.onclick=()=>openReport(b.dataset.reportId))}
async function openReport(id){let reports=await all('portalReports'),r=reports.find(x=>x.id===id);if(!r?.data)return;let blob=new Blob([r.data],{type:'application/pdf'}),url=URL.createObjectURL(blob);window.open(url,'_blank')}
async function sendMessage(){
 let text=$('#studentMessage').value.trim();if(!text)return;
 let a=await getAvailability(),now=new Date(),day=now.getDay(),hm=now.toTimeString().slice(0,5),date=now.toISOString().slice(0,10),vac=a.vacationStart&&a.vacationEnd&&date>=a.vacationStart&&date<=a.vacationEnd,closed=a.suspended||vac||(a.technicalCouncilDates||[]).includes(date)||!(a.days||[]).includes(day)||hm<a.start||hm>a.end;
 await put('studentMessages',{id:crypto.randomUUID(),studentId:currentId,category:$('#chatCategory').value,text,created:new Date().toISOString(),teacherRead:false,reply:''});
 $('#studentMessage').value='';$('#chatStatus').textContent=closed?'Tu mensaje fue recibido. Será respondido el siguiente día hábil dentro del horario de atención.':'Tu mensaje fue recibido dentro del horario de atención.';
}
init();
