
const $$=s=>[...document.querySelectorAll(s)];
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const same=(a,b)=>String(a||'').replace(/\s+/g,'').toUpperCase()===String(b||'').replace(/\s+/g,'').toUpperCase();
function setView(id){$$('.view').forEach(v=>v.classList.toggle('active',v.id===id));$$('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===id));window.scrollTo({top:0,behavior:'smooth'})}
$$('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));

import {all,getStudentBundle,getAvailability} from '../shared/local-adapter.js';
import {verifyPin,changePin} from '../shared/auth-utils.js';
import {normalizePhone} from '../shared/data-contract.js';
let id='',bundle=null;
let scanner=null;
async function init(){
 $('#loginBtn').onclick=doLogin;$('#logoutBtn').onclick=logout;$('#scanIdBtn').onclick=startScanner;$('#stopScanBtn').onclick=stopScanner;$('#contactTeacher').onclick=openWhatsApp;
 const saved=localStorage.getItem('familySession')||sessionStorage.getItem('familySession');if(saved){try{let s=JSON.parse(saved);id=s.studentId;await enterPortal()}catch(e){clearSession()}}
}
function saveSession(remember){const data=JSON.stringify({studentId:id,role:'parent'});(remember?localStorage:sessionStorage).setItem('familySession',data)}
function clearSession(){localStorage.removeItem('familySession');sessionStorage.removeItem('familySession')}
async function doLogin(){
 const sid=$('#loginId').value.trim(),pin=$('#loginPin').value.trim(),error=$('#loginError');error.textContent='';
 if(!sid||!pin){error.textContent='Escribe el ID del alumno y tu PIN.';return}
 const result=await verifyPin(sid,'parent',pin);
 if(!result.ok){if(result.reason==='locked'){let mins=Math.max(1,Math.ceil((result.lockedUntil-Date.now())/60000));error.textContent=`Has excedido el número de intentos permitidos. Intenta nuevamente en ${mins} minutos.`}else if(result.reason==='shift')error.textContent='Seguimiento Familiar solo está disponible para el turno matutino.';else if(result.reason==='not_provisioned')error.textContent='El acceso familiar todavía no ha sido preparado por el profesor.';else error.textContent='ID o PIN incorrecto.';return}
 id=sid;if(result.mustChange){await forceChangePin();return}saveSession($('#rememberSession').checked);await enterPortal();
}
async function forceChangePin(){
 $('#loginGate').innerHTML=`<div class="login-card"><div class="change-pin"><h2>Bienvenido</h2><p>Por seguridad debes crear un PIN personal para la familia.</p><label>Nuevo PIN<input id="newPersonalPin" type="password" inputmode="numeric" maxlength="8"></label><label>Confirmar PIN<input id="confirmPersonalPin" type="password" inputmode="numeric" maxlength="8"></label><button id="savePersonalPin" class="action">Guardar nuevo PIN</button><div id="changePinError" class="login-error"></div></div></div>`;
 $('#savePersonalPin').onclick=async()=>{let a=$('#newPersonalPin').value.trim(),b=$('#confirmPersonalPin').value.trim();if(!/^\d{4,8}$/.test(a))return $('#changePinError').textContent='El PIN debe tener de 4 a 8 números.';if(a!==b)return $('#changePinError').textContent='Los PIN no coinciden.';await changePin(id,'parent',a);saveSession(false);await enterPortal()};
}
async function enterPortal(){bundle=await getStudentBundle(id);if(!bundle){clearSession();return}$('#loginGate').classList.add('hidden');$('#portalApp').classList.remove('hidden');await load()}
function logout(){clearSession();location.reload()}
async function startScanner(){
 if(typeof Html5Qrcode==='undefined'){return $('#loginError').textContent='No fue posible cargar el lector. Puedes escribir el ID manualmente.'}
 $('#scanIdBtn').classList.add('hidden');$('#stopScanBtn').classList.remove('hidden');scanner=new Html5Qrcode('barcodeReader');
 const formats=[Html5QrcodeSupportedFormats.CODE_128,Html5QrcodeSupportedFormats.CODE_39,Html5QrcodeSupportedFormats.EAN_13,Html5QrcodeSupportedFormats.EAN_8,Html5QrcodeSupportedFormats.UPC_A,Html5QrcodeSupportedFormats.UPC_E,Html5QrcodeSupportedFormats.ITF];
 try{await scanner.start({facingMode:'environment'},{fps:10,qrbox:{width:280,height:120},formatsToSupport:formats},decoded=>{$('#loginId').value=decoded;stopScanner()},()=>{})}catch(e){$('#loginError').textContent='No se pudo abrir la cámara. Revisa el permiso de cámara.';stopScanner()}
}
async function stopScanner(){if(scanner){try{await scanner.stop();await scanner.clear()}catch(e){}scanner=null}$('#scanIdBtn')?.classList.remove('hidden');$('#stopScanBtn')?.classList.add('hidden')}
function grade(){let list=(bundle?.methodologies||[]).filter(m=>m.closed&&m.gradeRecords?.[id]?.finalDecimal!=null).sort((a,b)=>String(b.closedAt||b.updated||'').localeCompare(String(a.closedAt||a.updated||'')));return list[0]?.gradeRecords?.[id]||null}
async function load(){bundle=await getStudentBundle(id);if(!bundle)return;$('#familyHello').textContent=`Familia de ${bundle.student.name||'alumno'}`;renderAll();await updateContact()}
function renderAll(){let g=grade(),att=bundle.attendance,missing=bundle.activities.filter(a=>{let r=bundle.activityRecords.find(x=>x.key===`${a.id}|${id}`);return (a.evaluationMode||'delivery')==='delivery'&&r?.status==='no'}).length;
 $('#familySummary').innerHTML=[['Asistencia',att.length],['Actividades pendientes',missing],['Promedio',g?.finalDecimal?.toFixed(2)||'—'],['Avisos',bundle.notices.length],['Reportes',bundle.reports.length]].map(x=>`<button class="big-button"><b>${x[1]}</b><span>${x[0]}</span></button>`).join('');
 $('#familyNotice').innerHTML=bundle.notices.slice(0,2).map(n=>`<div class="notice"><b>${esc(n.title)}</b><p>${esc(n.text)}</p></div>`).join('');
 $('#familyAttendance').innerHTML=att.length?att.sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,40).map(a=>`<div class="card"><b>${esc(a.date)}</b> <span class="status ${a.status==='Falta'?'bad':a.status==='Retardo'?'warn':'ok'}">${esc(a.status||'Presente')}</span></div>`).join(''):'<div class="card muted">Sin registros.</div>';
 $('#familyActivities').innerHTML=bundle.activities.length?bundle.activities.map(a=>{let r=bundle.activityRecords.find(x=>x.key===`${a.id}|${id}`),done=(a.evaluationMode||'delivery')==='numeric'?typeof r?.score==='number':r?.status==='yes';return `<div class="card"><b>${esc(a.name)}</b><p class="muted">${esc(a.date||'Sin fecha')}</p><span class="status ${done?'ok':'warn'}">${done?'Registrada':'Pendiente / sin registro'}</span></div>`}).join(''):'<div class="card muted">Sin actividades.</div>';
 $('#familyGrades').innerHTML=`<div class="card"><h3>Promedio actual</h3><h1>${g?.finalDecimal?.toFixed(2)||'—'}</h1><p>Calificación redondeada: <b>${g?.rounded??'—'}</b></p></div>`;
 $('#familyReports').innerHTML=bundle.reports.length?bundle.reports.map(r=>`<button class="big-button" data-r="${r.id}"><b>PDF</b><span>${esc(r.title)}</span></button>`).join(''):'<div class="card muted">Sin reportes disponibles.</div>';$$('[data-r]').forEach(b=>b.onclick=()=>openReport(b.dataset.r));
}
async function openReport(rid){let reports=await all('portalReports'),r=reports.find(x=>x.id===rid);if(!r?.data)return;let url=URL.createObjectURL(new Blob([r.data],{type:'application/pdf'}));window.open(url,'_blank')}
async function isAvailable(){let a=await getAvailability(),now=new Date(),date=now.toISOString().slice(0,10),hm=now.toTimeString().slice(0,5),vac=a.vacationStart&&a.vacationEnd&&date>=a.vacationStart&&date<=a.vacationEnd;return {a,open:!a.suspended&&!vac&&!(a.technicalCouncilDates||[]).includes(date)&&(a.days||[]).includes(now.getDay())&&hm>=a.start&&hm<=a.end}}
async function updateContact(){let {a,open}=await isAvailable();$('#contactSchedule').textContent=`Horario de atención: lunes a viernes, ${a.start||'12:00'} a ${a.end||'15:00'}.`;$('#contactTeacher').disabled=!open;$('#contactMessage').textContent=open?'El botón está disponible dentro del horario de atención.':'El horario de atención es de lunes a viernes de 12:00 p.m. a 3:00 p.m. Los mensajes enviados fuera de este horario serán respondidos el siguiente día hábil.'}
async function openWhatsApp(){let {open}=await isAvailable();if(!open)return updateContact();let s=bundle.student,msg=`Buenas tardes, profesor Jaime.%0A%0ASoy el padre/madre de ${encodeURIComponent(s.name||'')} del grupo ${encodeURIComponent(s.group||'')}.%0A%0AMe comunico para realizar la siguiente consulta:%0A`;window.open(`https://wa.me/?text=${msg}`,'_blank')}
init();
