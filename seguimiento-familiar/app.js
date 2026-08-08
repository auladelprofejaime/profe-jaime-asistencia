
const $$=s=>[...document.querySelectorAll(s)];
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const same=(a,b)=>String(a||'').replace(/\s+/g,'').toUpperCase()===String(b||'').replace(/\s+/g,'').toUpperCase();
function setView(id){$$('.view').forEach(v=>v.classList.toggle('active',v.id===id));$$('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===id));window.scrollTo({top:0,behavior:'smooth'})}
$$('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));

import {portalLogin,changePortalPin,portalLogout,portalGetBundle,registerPortalPush,WEB_PUSH_VAPID_PUBLIC_KEY} from '../shared/supabase-adapter.js?v=810';
import {normalizePhone} from '../shared/data-contract.js';
let id='',bundle=null,currentToken='';
let scanner=null;
let familySWRegistration=null;

async function ensureFamilyServiceWorker(){
 if(!('serviceWorker' in navigator))throw new Error('Este navegador no admite service workers.');
 familySWRegistration=await navigator.serviceWorker.register('./service-worker.js?v=810',{scope:'./'});
 await navigator.serviceWorker.ready;
 return familySWRegistration;
}
function vapidBytes(base64String){
 const padding='='.repeat((4-base64String.length%4)%4),base64=(base64String+padding).replace(/-/g,'+').replace(/_/g,'/');
 const raw=atob(base64);return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));
}
async function syncFamilyPushSubscription(){
 if(!currentToken)throw new Error('Primero inicia sesión en Seguimiento Familiar.');
 if(!('Notification' in window))throw new Error('Este dispositivo no admite notificaciones web.');
 if(Notification.permission!=='granted')throw new Error('El permiso de notificaciones no está concedido.');
 if(!('PushManager' in window))throw new Error('Web Push no está disponible. En iPhone abre Seguimiento Familiar desde el icono agregado a la pantalla de inicio.');
 const reg=familySWRegistration||await ensureFamilyServiceWorker();
 let sub=await reg.pushManager.getSubscription();
 if(!sub){
   sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:vapidBytes(WEB_PUSH_VAPID_PUBLIC_KEY)});
 }
 await registerPortalPush(currentToken,sub);
 localStorage.setItem(`familyPushRegistered:${id}`,'1');
 updateFamilyPushStatus();
 return true;
}
function updateFamilyPushStatus(){
 const el=$('#familyPushStatus');if(!el)return;
 if(Notification.permission==='granted'&&localStorage.getItem(`familyPushRegistered:${id}`)==='1'){
   el.innerHTML='<b>✓ Este dispositivo está registrado para recibir notificaciones push.</b>';
 }else if(Notification.permission==='denied'){
   el.textContent='Las notificaciones están bloqueadas en este dispositivo.';
 }else{
   el.textContent='Las notificaciones todavía no están activadas en este dispositivo.';
 }
}
async function enableFamilyNotifications(){
 const status=$('#familyPushStatus');
 try{
   if(status)status.textContent='Preparando notificaciones…';
   await ensureFamilyServiceWorker();
   if(!('Notification' in window))throw new Error('Este dispositivo no admite notificaciones web.');
   let permission=Notification.permission;
   if(permission!=='granted')permission=await Notification.requestPermission();
   if(permission!=='granted')throw new Error('No se concedió permiso para notificaciones.');
   await syncFamilyPushSubscription();
   alert('Notificaciones de Seguimiento Familiar activadas correctamente.');
 }catch(e){
   console.error(e);
   if(status)status.textContent='No se pudo activar: '+(e.message||e);
   alert('No se pudo activar las notificaciones: '+(e.message||e));
 }
}

async function init(){
 const loading=$('#sessionLoading');
 const login=$('#loginGate');
 let released=false;

 const releaseToLogin=()=>{
   if(released)return;
   released=true;
   loading?.classList.add('hidden');
   login?.classList.remove('hidden');
 };

 // Seguro anti-bloqueo: nunca quedarse en Recuperando sesión.
 const hardTimeout=setTimeout(releaseToLogin,4000);

 try{
   // El service worker se prepara EN SEGUNDO PLANO.
   // Nunca debe bloquear la entrada a la app.
   ensureFamilyServiceWorker().catch(e=>console.warn('SW',e));

   $('#loginBtn').onclick=doLogin;
   $('#logoutBtn').onclick=logout;
   $('#scanIdBtn').onclick=startScanner;
   $('#stopScanBtn').onclick=stopScanner;
   $('#contactTeacher').onclick=openWhatsApp;
   $('#enableFamilyNotif')&&($('#enableFamilyNotif').onclick=enableFamilyNotifications);

   const tm=$('#contactTestMode');
   if(tm){
     tm.checked=localStorage.getItem('familyContactTestMode')==='1';
     tm.onchange=()=>localStorage.setItem('familyContactTestMode',tm.checked?'1':'0');
   }

   const saved=localStorage.getItem('familySession')||sessionStorage.getItem('familySession');

   if(saved){
     try{
       const s=JSON.parse(saved);
       id=s.studentId||'';
       currentToken=s.token||'';

       if(currentToken){
         // La validación también tiene límite de tiempo.
         const entered=await Promise.race([
           enterPortal(),
           new Promise(resolve=>setTimeout(()=>resolve(false),3500))
         ]);

         if(entered){
           clearTimeout(hardTimeout);
           released=true;
           return;
         }
       }
     }catch(e){
       console.warn('Sesión familiar guardada inválida',e);
     }
   }
 }catch(e){
   console.warn('Inicio App padres',e);
 }

 clearTimeout(hardTimeout);
 releaseToLogin();
}
function saveSession(remember){const data=JSON.stringify({studentId:id,role:'parent',token:currentToken});(remember?localStorage:sessionStorage).setItem('familySession',data)}
function clearSession(){localStorage.removeItem('familySession');sessionStorage.removeItem('familySession')}
async function doLogin(){
 const sid=$('#loginId').value.trim(),pin=$('#loginPin').value.trim(),error=$('#loginError');error.textContent='';
 if(!sid||!pin){error.textContent='Escribe el ID del alumno y tu PIN.';return}
 try{
   const result=await portalLogin(sid,'parent',pin,$('#rememberSession').checked);
   if(!result.ok){if(result.reason==='locked')error.textContent='Has excedido el número de intentos permitidos. Intenta nuevamente en 10 minutos.';else if(result.reason==='shift')error.textContent='Seguimiento Familiar solo está disponible para el turno matutino.';else if(result.reason==='not_provisioned')error.textContent='El acceso familiar todavía no ha sido preparado por el profesor.';else error.textContent='ID o PIN incorrecto.';return}
   id=sid;currentToken=result.token;if(result.must_change){await forceChangePin();return}saveSession($('#rememberSession').checked);await enterPortal();
 }catch(e){error.textContent='No se pudo conectar con el sistema. Revisa tu internet e intenta nuevamente.'}
}
async function forceChangePin(){
 const remember=$('#rememberSession')?.checked||false;
 $('#loginGate').innerHTML=`<div class="login-card"><div class="change-pin"><h2>Bienvenido</h2><p>Por seguridad debes crear un PIN personal para la familia.</p><label>Nuevo PIN<input id="newPersonalPin" type="password" inputmode="numeric" maxlength="8"></label><label>Confirmar PIN<input id="confirmPersonalPin" type="password" inputmode="numeric" maxlength="8"></label><button id="savePersonalPin" class="action">Guardar nuevo PIN</button><div id="changePinError" class="login-error"></div></div></div>`;
 $('#savePersonalPin').onclick=async()=>{let a=$('#newPersonalPin').value.trim(),b=$('#confirmPersonalPin').value.trim();if(!/^\d{4,8}$/.test(a))return $('#changePinError').textContent='El PIN debe tener de 4 a 8 números.';if(a!==b)return $('#changePinError').textContent='Los PIN no coinciden.';let r=await changePortalPin(currentToken,a);if(!r?.ok)return $('#changePinError').textContent='No se pudo guardar el PIN.';saveSession(remember);await enterPortal()};
}
async function enterPortal(){
 try{
   const raw=await portalGetBundle(currentToken);
   if(!raw?.ok)return false;

   bundle=raw;
   id=bundle.student.id;

   $('#sessionLoading')?.classList.add('hidden');
   $('#loginGate')?.classList.add('hidden');
   $('#portalApp')?.classList.remove('hidden');

   await load();
   return true;
 }catch(e){
   console.warn('No se pudo recuperar la sesión',e);
   return false;
 }
}
async function logout(){try{if(currentToken)await portalLogout(currentToken)}catch(e){}clearSession();location.reload()}
async function startScanner(){
 if(typeof Html5Qrcode==='undefined'){return $('#loginError').textContent='No fue posible cargar el lector. Puedes escribir el ID manualmente.'}
 $('#scanIdBtn').classList.add('hidden');$('#stopScanBtn').classList.remove('hidden');scanner=new Html5Qrcode('barcodeReader');
 const formats=[Html5QrcodeSupportedFormats.CODE_128,Html5QrcodeSupportedFormats.CODE_39,Html5QrcodeSupportedFormats.EAN_13,Html5QrcodeSupportedFormats.EAN_8,Html5QrcodeSupportedFormats.UPC_A,Html5QrcodeSupportedFormats.UPC_E,Html5QrcodeSupportedFormats.ITF];
 try{await scanner.start({facingMode:'environment'},{fps:10,qrbox:{width:280,height:120},formatsToSupport:formats},decoded=>{$('#loginId').value=decoded;stopScanner()},()=>{})}catch(e){$('#loginError').textContent='No se pudo abrir la cámara. Revisa el permiso de cámara.';stopScanner()}
}
async function stopScanner(){if(scanner){try{await scanner.stop();await scanner.clear()}catch(e){}scanner=null}$('#scanIdBtn')?.classList.remove('hidden');$('#stopScanBtn')?.classList.add('hidden')}
function grade(){let list=(bundle?.methodologies||[]).filter(m=>m.closed&&m.gradeRecords?.[id]?.finalDecimal!=null).sort((a,b)=>String(b.closedAt||b.updated||'').localeCompare(String(a.closedAt||a.updated||'')));return list[0]?.gradeRecords?.[id]||null}
async function load(){bundle=await portalGetBundle(currentToken);if(!bundle?.ok)return;$('#familyHello').textContent=`Familia de ${bundle.student.name||'alumno'}`;renderAll();await updateContact();updateFamilyPushStatus();if(Notification.permission==='granted')syncFamilyPushSubscription().catch(()=>{})}
function portalDate(v){
 if(!v)return 'Sin fecha';
 const d=new Date(v+'T12:00:00');
 if(Number.isNaN(d.getTime()))return String(v);
 return d.toLocaleDateString('es-MX',{day:'numeric',month:'long'});
}
function familyActivityState(a,r){
 const mode=a.evaluationMode||'delivery';
 if(mode==='numeric'&&typeof r?.score==='number')return {label:'Entregada',cls:'ok'};
 if(r?.status==='yes')return {label:'Entregada',cls:'ok'};
 if(r?.status==='no')return {label:'No entregada',cls:'bad'};
 if(a.dueDate){
   const today=new Date();today.setHours(0,0,0,0);
   const due=new Date(a.dueDate+'T23:59:59');
   if(due<today)return {label:'Vencida',cls:'bad'};
 }
 return {label:'Pendiente',cls:'warn'};
}
function renderAll(){
 let g=grade(),att=bundle.attendance,map=new Map((bundle.activityRecords||[]).map(r=>[r.key,r]));
 let pending=(bundle.activities||[]).filter(a=>{
   let r=map.get(`${a.id}|${id}`),st=familyActivityState(a,r);
   return st.label==='Pendiente'||st.label==='Vencida'||st.label==='No entregada';
 }).length;

 $('#familyStats').innerHTML=[
   ['Asistencia',att.length],
   ['Pendientes',pending],
   ['Promedio',g?.finalDecimal?.toFixed(2)||'—'],
   ['Avisos',bundle.notices.length]
 ].map(x=>`<div class="stat-card"><b>${x[1]}</b><span>${x[0]}</span></div>`).join('');

 $('#familyNotice').innerHTML=bundle.notices.slice(0,2).map(n=>`<div class="notice"><b>${esc(n.title)}</b><p>${esc(n.text)}</p></div>`).join('')||'<div class="notice muted">Sin avisos recientes.</div>';

 $('#familyNotices').innerHTML=bundle.notices.length?bundle.notices.map(n=>`<div class="card"><b>${esc(n.title)}</b><p>${esc(n.text)}</p></div>`).join(''):'<div class="card muted">Sin avisos.</div>';

 $('#familyMaterials').innerHTML=bundle.materials.length?bundle.materials.map(m=>`<div class="card"><b>${esc(m.title)}</b><p class="muted">${esc(m.type||'Material')}</p>${m.publicUrl||m.url?`<button class="action material-open" data-url="${esc(m.publicUrl||m.url)}">Abrir material</button>`:''}</div>`).join(''):'<div class="card muted">Sin materiales.</div>';
 $$('.material-open').forEach(b=>b.onclick=()=>window.open(b.dataset.url,'_blank'));

 $('#familyAttendance').innerHTML=att.length?att.sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,40).map(a=>`<div class="card"><b>${esc(a.date)}</b> <span class="status ${a.status==='Falta'?'bad':a.status==='Retardo'?'warn':'ok'}">${esc(a.status||'Presente')}</span></div>`).join(''):'<div class="card muted">Sin registros.</div>';

 let acts=[...(bundle.activities||[])].sort((a,b)=>{
   const ad=a.dueDate||'9999-12-31',bd=b.dueDate||'9999-12-31';
   return ad.localeCompare(bd)||String(b.date||'').localeCompare(String(a.date||''));
 });
 $('#familyActivities').innerHTML=acts.length?acts.map(a=>{
   let r=map.get(`${a.id}|${id}`),st=familyActivityState(a,r);
   return `<div class="card delivery-card">
     <div class="delivery-title">${esc(a.name)}</div>
     <div class="delivery-line"><b>Actividad:</b> ${esc(a.name)}</div>
     <div class="delivery-line"><b>Asignada:</b> ${esc(portalDate(a.date))}</div>
     <div class="delivery-line"><b>Entrega:</b> ${esc(portalDate(a.dueDate))}</div>
     <div class="delivery-line"><b>Estado:</b> <span class="status ${st.cls}">${st.label}</span></div>
     ${typeof r?.score==='number'?`<div class="delivery-line"><b>Calificación:</b> ${r.score}/10</div>`:''}
   </div>`;
 }).join(''):'<div class="card muted">No hay próximas entregas publicadas.</div>';

 $('#familyGrades').innerHTML=`<div class="card"><h3>Promedio actual</h3><h1>${g?.finalDecimal?.toFixed(2)||'—'}</h1><p>Calificación redondeada: <b>${g?.rounded??'—'}</b></p></div>`;
 $('#familyReports').innerHTML=bundle.reports.length?bundle.reports.map(r=>`<button class="big-button" data-r="${r.id}"><b>PDF</b><span>${esc(r.title)}</span></button>`).join(''):'<div class="card muted">Sin reportes disponibles.</div>';
 $$('[data-r]').forEach(b=>b.onclick=()=>openReport(b.dataset.r));
}
async function openReport(rid){alert('El reporte está registrado, pero la apertura segura de PDF se habilitará en la siguiente actualización.')}
async function isAvailable(){let a=bundle.availability||{},now=new Date(),date=now.toISOString().slice(0,10),hm=now.toTimeString().slice(0,5),vac=a.vacationStart&&a.vacationEnd&&date>=a.vacationStart&&date<=a.vacationEnd;return {a,open:!a.suspended&&!vac&&!(a.technicalCouncilDates||[]).includes(date)&&(a.days||[]).includes(now.getDay())&&hm>=a.start&&hm<=a.end}}
async function updateContact(){let {a,open}=await isAvailable();$('#contactSchedule').textContent=`Horario de atención: lunes a viernes, ${a.start||'12:00'} a ${a.end||'15:00'}.`;$('#contactTeacher').disabled=!open;$('#contactMessage').textContent=open?'El botón está disponible dentro del horario de atención.':'El horario de atención es de lunes a viernes de 12:00 p.m. a 3:00 p.m. Los mensajes enviados fuera de este horario serán respondidos el siguiente día hábil.'}
async async function openWhatsApp(){
 const box=$('#contactMessage');
 try{
   if(!bundle?.student){
     if(box)box.textContent='No se pudieron cargar los datos del alumno.';
     return;
   }

   const testMode=$('#contactTestMode')?.checked || localStorage.getItem('familyContactTestMode')==='1';

   if(!testMode){
     const available=await isAvailable();
     if(!available){
       if(box)box.textContent='El horario de atención es de lunes a viernes de 12:00 p.m. a 3:00 p.m. Fuera de este horario no se abrirá WhatsApp.';
       return;
     }
   }

   const studentName=String(bundle.student.name||'').trim()||'el alumno';
   const group=String(bundle.student.group_name||bundle.student.group||'').trim()||'sin grupo';
   const teacherPhone='527731931419';

   const message=`Buen día, profesor Jaime. Soy padre, madre o tutor de ${studentName}, del grupo ${group}. Me comunico por el siguiente motivo:`;
   const url=`https://wa.me/${teacherPhone}?text=${encodeURIComponent(message)}`;

   if(box){
     box.innerHTML=testMode
       ? '<b>Modo prueba activo.</b><br>Se abrirá WhatsApp ignorando el horario.'
       : '<b>Abriendo WhatsApp…</b><br>El mensaje incluye automáticamente el nombre y grupo del alumno.';
   }

   window.location.href=url;
 }catch(e){
   console.error(e);
   if(box)box.textContent='No se pudo abrir WhatsApp. Inténtalo nuevamente.';
 }
}=await isAvailable();if(!open)return updateContact();let s=bundle.student,msg=`Buenas tardes, profesor Jaime.%0A%0ASoy el padre/madre de ${encodeURIComponent(s.name||'')} del grupo ${encodeURIComponent(s.group||'')}.%0A%0AMe comunico para realizar la siguiente consulta:%0A`;window.open(`https://wa.me/?text=${msg}`,'_blank')}
init();
