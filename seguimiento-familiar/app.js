
const $$=s=>[...document.querySelectorAll(s)];
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const same=(a,b)=>String(a||'').replace(/\s+/g,'').toUpperCase()===String(b||'').replace(/\s+/g,'').toUpperCase();
function setView(id){$$('.view').forEach(v=>v.classList.toggle('active',v.id===id));$$('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===id));window.scrollTo({top:0,behavior:'smooth'})}

async function openFamilyPushTarget(target){
 if(target==='reports'){await openPortalView('reports');return}
 if(target==='activities'){setView('activities');return}
 if(target==='materials'){setView('materials');return}
 if(target==='notices'){setView('notices');return}
 setView('home');
}
navigator.serviceWorker?.addEventListener('message',e=>{
 if(e.data?.type==='OPEN_PUSH_TARGET')openFamilyPushTarget(e.data.target);
});
document.addEventListener('visibilitychange',async()=>{
 if(document.visibilityState==='visible'&&currentToken&&bundle){
   try{
     const fresh=await portalGetBundle(currentToken);
     if(fresh?.ok)bundle=fresh;
     await refreshPortalContentNow();
   }catch(e){console.warn('Actualización al volver a la app',e);}
 }
});

const initialPush=new URLSearchParams(location.search).get('push');
if(initialPush)setTimeout(()=>openFamilyPushTarget(initialPush),500);


async function rawPortalBundle(){
 if(!currentToken)return null;
 try{
   const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/portal_get_updates`,{
     method:'POST',
     headers:{
       apikey:SUPABASE_PUBLISHABLE_KEY,
       'Content-Type':'application/json'
     },
     body:JSON.stringify({p_token:currentToken})
   });
   if(!r.ok){console.warn('portal_get_updates HTTP',r.status);return null}
   return await r.json();
 }catch(e){console.warn('portal updates',e);return null}
}
function mergeFreshPortalContent(raw){
 if(!raw?.ok||!bundle)return;
 if(Array.isArray(raw.notices)){
   bundle.notices=raw.notices.map(n=>({...n,text:n.text??n.body??'',body:n.body??n.text??''}));
 }
 if(Array.isArray(raw.reports)) bundle.reports=raw.reports;
}
async function refreshPortalContentNow(){
 const raw=await rawPortalBundle();
 if(raw?.ok){
   mergeFreshPortalContent(raw);
   renderAll();
   return true;
 }
 return false;
}

async function openPortalView(id){
 if((id==='reports'||id==='notices'||id==='home')&&currentToken){
   try{
     const fresh=await portalGetBundle(currentToken);
     if(fresh?.ok)bundle=fresh;
     await refreshPortalContentNow();
   }catch(e){console.warn('No se pudo actualizar el contenido del portal',e);}
 }
 setView(id);
}
$$('[data-view]').forEach(b=>b.onclick=()=>openPortalView(b.dataset.view));

import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,portalLogin,changePortalPin,portalLogout,portalGetBundle,registerPortalPush,WEB_PUSH_VAPID_PUBLIC_KEY} from '../shared/supabase-adapter.js?v=810';
import {normalizePhone} from '../shared/data-contract.js';
let id='',bundle=null,currentToken='';

let familySWRegistration=null;

async function ensureFamilyServiceWorker(){
 if(!('serviceWorker' in navigator))throw new Error('Este navegador no admite service workers.');
 familySWRegistration=await navigator.serviceWorker.register('./service-worker.js?v=8120',{scope:'./'});
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
   const portal=$('#portalApp');
   if(portal && !portal.classList.contains('hidden')){
     released=true;
     loading?.classList.add('hidden');
     login?.classList.add('hidden');
     return;
   }
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
   normalizePortalMethodologies();

   $('#sessionLoading')?.classList.add('hidden');
   $('#loginGate')?.classList.add('hidden');
   $('#portalApp')?.classList.remove('hidden');

   await load();
   $('#sessionLoading')?.classList.add('hidden');
   $('#loginGate')?.classList.add('hidden');
   $('#portalApp')?.classList.remove('hidden');
   return true;
 }catch(e){
   console.warn('No se pudo recuperar la sesión',e);
   return false;
 }
}
async function load(){
 bundle=await portalGetBundle(currentToken);
 if(!bundle?.ok)return;
 normalizePortalMethodologies();
 const raw=await rawPortalBundle();
 if(raw?.ok)mergeFreshPortalContent(raw);
 $('#familyHello').textContent=`Familia de ${bundle.student.name||'alumno'}`;
 renderAll();
 await updateContact();
 updateFamilyPushStatus();
 if(Notification.permission==='granted')syncFamilyPushSubscription().catch(()=>{});
}
async function logout(){try{if(currentToken)await portalLogout(currentToken)}catch(e){}clearSession();location.reload()}
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

function normalizePortalMethodologies(){
 if(!bundle)return;
 bundle.methodologies=(bundle.methodologies||[]).map(m=>{
   if(m?.data&&typeof m.data==='object'){
     return {
       ...m.data,
       id:m.id??m.data.id,
       closed:m.closed??m.data.closed,
       cycle:m.cycle??m.data.cycle,
       quarter:m.quarter??m.data.quarter,
       month:m.month??m.data.month,
       shift:m.shift??m.data.shift,
       group:m.group_name??m.data.group
     };
   }
   return m;
 });
}
const FAMILY_MONTH_ORDER=['Agosto','Septiembre','Octubre','Noviembre','Diciembre','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio'];
function familyMethodTimestamp(m){return String(m.updated||m.closedAt||m.created||'')}
function familyIsQuarterSummary(m){return !!(m?.isQuarterSummary||m?.periodType==='quarter'||m?.data?.isQuarterSummary)}
function familyGradeModel(){
 normalizePortalMethodologies();
 const all=bundle?.methodologies||[];
 const monthly=all.filter(m=>!familyIsQuarterSummary(m)&&m.gradeRecords?.[id]?.finalDecimal!=null)
   .sort((a,b)=>String(b.cycle||'').localeCompare(String(a.cycle||''))||
     Number(b.quarter||0)-Number(a.quarter||0)||
     FAMILY_MONTH_ORDER.indexOf(b.month)-FAMILY_MONTH_ORDER.indexOf(a.month)||
     familyMethodTimestamp(b).localeCompare(familyMethodTimestamp(a)));
 const quarters=all.filter(m=>familyIsQuarterSummary(m)&&m.gradeRecords?.[id]?.finalDecimal!=null)
   .sort((a,b)=>String(b.cycle||'').localeCompare(String(a.cycle||''))||
     Number(b.quarter||0)-Number(a.quarter||0)||
     familyMethodTimestamp(b).localeCompare(familyMethodTimestamp(a)));
 const current=monthly.slice().sort((a,b)=>familyMethodTimestamp(b).localeCompare(familyMethodTimestamp(a)))[0]||null;
 return {monthly,quarters,current};
}
function grade(){
 const m=familyGradeModel().current;
 return m?.gradeRecords?.[id]||null;
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

 $('#familyNotice').innerHTML=bundle.notices.slice(0,2).map(n=>`<div class="notice"><b>${esc(n.title)}</b><p>${esc(n.text??n.body??'')}</p></div>`).join('')||'<div class="notice muted">Sin avisos recientes.</div>';

 $('#familyNotices').innerHTML=bundle.notices.length?bundle.notices.map(n=>`<div class="card"><b>${esc(n.title)}</b><p>${esc(n.text??n.body??'')}</p></div>`).join(''):'<div class="card muted">Sin avisos.</div>';

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

 {
   const gm=familyGradeModel();
   const months=gm.monthly.map(m=>{
     const x=m.gradeRecords?.[id];
     return `<div class="card">
       <div style="display:flex;justify-content:space-between;gap:10px;align-items:start">
         <div><h3 style="margin:0">${esc(m.month||'Mes')}</h3><p class="muted" style="margin:4px 0 0">Trimestre ${esc(m.quarter||'—')} · ${esc(m.cycle||'')}</p></div>
         <span class="status ${m.closed?'ok':'warn'}">${m.closed?'Definitiva':'En curso'}</span>
       </div>
       <h1 style="margin-bottom:4px">${Number(x.finalDecimal).toFixed(2)}</h1>
       <p>Redondeada: <b>${x.rounded??'—'}</b></p>
     </div>`;
   }).join('');
   const quarters=gm.quarters.map(m=>{
     const x=m.gradeRecords?.[id];
     return `<div class="card">
       <h3 style="margin-top:0">Trimestre ${esc(m.quarter||'—')}</h3>
       <p class="muted">${esc(m.cycle||'')}</p>
       <h1 style="margin-bottom:4px">${Number(x.finalDecimal).toFixed(2)}</h1>
       <p>Calificación trimestral redondeada: <b>${x.rounded??'—'}</b></p>
     </div>`;
   }).join('');
   $('#familyGrades').innerHTML=`
     <h3>Calificaciones mensuales</h3>
     ${months||'<div class="card muted">Todavía no hay una calificación mensual calculada.</div>'}
     <h3 style="margin-top:22px">Calificación trimestral</h3>
     ${quarters||'<div class="card muted">Aparecerá cuando el profesor calcule el cierre del trimestre.</div>'}`;
 }
 $('#familyReports').innerHTML=bundle.reports.length?bundle.reports.map(r=>`<button class="big-button" data-r="${r.id}"><b>📄</b><span>${esc(r.title)}${r.report_date?`<small>${esc(portalDate(r.report_date))}</small>`:''}</span></button>`).join(''):'<div class="card muted">Sin reportes disponibles.</div>';
 $$('[data-r]').forEach(b=>b.onclick=()=>openReport(b.dataset.r));
}
async function openReport(rid){
 const r=(bundle?.reports||[]).find(x=>String(x.id)===String(rid));
 if(!r)return alert('No se encontró el reporte.');
 const d=r.data||{};
 if(r.report_type==='weekly_deliveries'||d.activities){
   const acts=Array.isArray(d.activities)?d.activities:[];
   const rows=acts.map(a=>{
     const cls=a.code==='yes'?'ok':a.code==='no'?'bad':a.code==='numeric'?'ok':'warn';
     return `<div class="card delivery-card">
       <div class="delivery-title">${esc(a.name||'Actividad')}</div>
       <div class="delivery-line"><b>Tipo:</b> ${esc(a.type||'Actividad')}</div>
       <div class="delivery-line"><b>Asignada:</b> ${esc(portalDate(a.assigned)||'—')}</div>
       <div class="delivery-line"><b>Entrega:</b> ${esc(portalDate(a.due)||'—')}</div>
       <div class="delivery-line"><b>Estado:</b> <span class="status ${cls}">${esc(a.status||'Pendiente')}</span></div>
     </div>`;
   }).join('');
   const html=`<button class="back-home" id="backReports">← Reportes</button>
     <h2>${esc(r.title||'Reporte semanal de entregas')}</h2>
     <div class="card">
       <p><b>Alumno:</b> ${esc(d.student_name||bundle?.student?.name||'')}</p>
       <p><b>Grupo:</b> ${esc(d.group_name||bundle?.student?.group_name||'')}</p>
       <p><b>Semana:</b> ${esc(d.week||'')}</p>
       <p><b>Entregadas / registradas:</b> ${esc(d.delivered??0)} de ${esc(d.total??acts.length)}</p>
     </div>${rows||'<div class="card muted">Sin actividades en este reporte.</div>'}`;
   const view=$('#reports');
   view.innerHTML=html;
   $('#backReports').onclick=()=>{view.innerHTML='<button class="back-home" data-view="home">← Inicio</button><h2>Reportes</h2><div id="familyReports" class="cards"></div>';view.querySelector('[data-view="home"]').onclick=()=>setView('home');renderAll();openPortalView('reports')};
   return;
 }
 alert('Este reporte no tiene un formato compatible con esta versión.');
}
async function isAvailable(){let a=bundle.availability||{},now=new Date(),date=now.toISOString().slice(0,10),hm=now.toTimeString().slice(0,5),vac=a.vacationStart&&a.vacationEnd&&date>=a.vacationStart&&date<=a.vacationEnd;return {a,open:!a.suspended&&!vac&&!(a.technicalCouncilDates||[]).includes(date)&&(a.days||[]).includes(now.getDay())&&hm>=a.start&&hm<=a.end}}
async function updateContact(){let {a,open}=await isAvailable();$('#contactSchedule').textContent=`Horario de atención: lunes a viernes, ${a.start||'12:00'} a ${a.end||'15:00'}.`;$('#contactTeacher').disabled=!open;$('#contactMessage').textContent=open?'El botón está disponible dentro del horario de atención.':'El horario de atención es de lunes a viernes de 12:00 p.m. a 3:00 p.m. Los mensajes enviados fuera de este horario serán respondidos el siguiente día hábil.'}
async function openWhatsApp(){
 const box=$('#contactMessage');
 try{
   if(!bundle?.student){
     if(box)box.textContent='No se pudieron cargar los datos del alumno.';
     return;
   }

   const available=await isAvailable();
   if(!available.open){
     await updateContact();
     return;
   }

   const studentName=String(bundle.student.name||'').trim()||'el alumno';
   const group=String(bundle.student.group_name||bundle.student.group||'').trim()||'sin grupo';
   const teacherPhone='527731931419';
   const message=`Buen día, profesor Jaime. Soy padre, madre o tutor de ${studentName}, del grupo ${group}. Me comunico por el siguiente motivo:`;
   window.location.href=`https://wa.me/${teacherPhone}?text=${encodeURIComponent(message)}`;
 }catch(e){
   console.error(e);
   if(box)box.textContent='No se pudo abrir WhatsApp. Inténtalo nuevamente.';
 }
}

init();
