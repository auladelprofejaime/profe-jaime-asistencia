
const $$=s=>[...document.querySelectorAll(s)];
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const same=(a,b)=>String(a||'').replace(/\s+/g,'').toUpperCase()===String(b||'').replace(/\s+/g,'').toUpperCase();
function setView(id){$$('.view').forEach(v=>v.classList.toggle('active',v.id===id));$$('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===id));window.scrollTo({top:0,behavior:'smooth'})}
$$('[data-view]').forEach(b=>b.onclick=()=>openStudentView(b.dataset.view));


async function rawStudentPortalBundle(){
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
 }catch(e){console.warn('student updates',e);return null}
}
async function refreshStudentNotices(){
 const raw=await rawStudentPortalBundle();
 if(raw?.ok&&Array.isArray(raw.notices)&&bundle){
   bundle.notices=raw.notices.map(n=>({...n,text:n.text??n.body??'',body:n.body??n.text??''}));
   renderSummary();renderNotices();
 }
}
async function openStudentView(id){
 if((id==='home'||id==='notices')&&currentToken)await refreshStudentNotices();
 if(id==='points'&&currentToken) await refreshStudentPoints();
 setView(id);
}

import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,portalLogin,changePortalPin,portalLogout,portalGetBundle,portalSendMessage,registerPortalPush,sendPortalPushEvent,WEB_PUSH_VAPID_PUBLIC_KEY} from '../shared/supabase-adapter.js?v=899';
let currentId='',bundle=null,currentToken='';
let studentPointsData=null;
let studentSWRegistration=null;

async function ensureStudentServiceWorker(){
  if(!('serviceWorker' in navigator)) throw new Error('Este navegador no admite service workers.');
  studentSWRegistration = await navigator.serviceWorker.register('./service-worker.js?v=8142',{scope:'./'});
  await navigator.serviceWorker.ready;
  return studentSWRegistration;
}

function recordMap(){return new Map((bundle?.activityRecords||[]).map(r=>[r.key,r]))}
let selectedChatTopic='';
let newChatDraftOpen=false;
let chatCloseTimer=null;
const CHAT_REPLY_WINDOW_MS=5*60*1000;
async function init(){
 try{await ensureStudentServiceWorker()}catch(e){console.warn('SW',e)}
 $('#loginBtn').onclick=doLogin;$('#logoutBtn').onclick=logout;
 $('#studentNotifBtn').onclick=openStudentNotifications;
 $('#refreshStudentChat').onclick=refreshStudentPortal;
 $('#sendStudentMessage').onclick=sendMessage;
 $('#chatTopicSelect').onchange=e=>selectChatTopic(e.target.value);

 const saved=localStorage.getItem('miEspanolSession')||sessionStorage.getItem('miEspanolSession');
 if(saved){
   try{
     const s=JSON.parse(saved);
     currentId=s.studentId;
     currentToken=s.token||'';
     if(currentToken && await enterPortal())return;
   }catch(e){console.warn('Sesión guardada inválida',e)}
   clearSession();
 }
 $('#sessionLoading')?.classList.add('hidden');
 $('#portalApp')?.classList.add('hidden');
 $('#loginGate')?.classList.remove('hidden');
}
function saveSession(remember){const data=JSON.stringify({studentId:currentId,role:'student',token:currentToken});(remember?localStorage:sessionStorage).setItem('miEspanolSession',data)}
function clearSession(){localStorage.removeItem('miEspanolSession');sessionStorage.removeItem('miEspanolSession')}
async function doLogin(){
 const id=$('#loginId').value.trim(),pin=$('#loginPin').value.trim(),error=$('#loginError');error.textContent='';
 if(!id||!pin){error.textContent='Escribe tu ID y PIN.';return}
 try{
   const result=await portalLogin(id,'student',pin,$('#rememberSession').checked);
   if(!result.ok){if(result.reason==='locked'){error.textContent='Has excedido el número de intentos permitidos. Intenta nuevamente en 10 minutos.'}else if(result.reason==='shift')error.textContent='Mi Español solo está disponible para el turno matutino.';else if(result.reason==='not_provisioned')error.textContent='Tu acceso todavía no ha sido preparado por el profesor.';else error.textContent='ID o PIN incorrecto.';return}
   currentId=id;currentToken=result.token;
   if(result.must_change){await forceChangePin();return}
   saveSession($('#rememberSession').checked);await enterPortal();
 }catch(e){error.textContent='No se pudo conectar con el sistema. Revisa tu internet e intenta nuevamente.'}
}
async function forceChangePin(){
 const remember=$('#rememberSession')?.checked||false;
 const html=`<div class="change-pin"><h2>Bienvenido</h2><p>Por seguridad debes crear un PIN personal.</p><label>Nuevo PIN<input id="newPersonalPin" type="password" inputmode="numeric" maxlength="8"></label><label>Confirmar PIN<input id="confirmPersonalPin" type="password" inputmode="numeric" maxlength="8"></label><button id="savePersonalPin" class="action primary">Guardar nuevo PIN</button><div id="changePinError" class="login-error"></div></div>`;
 $('#loginGate').innerHTML=`<div class="login-card">${html}</div>`;
 $('#savePersonalPin').onclick=async()=>{let a=$('#newPersonalPin').value.trim(),b=$('#confirmPersonalPin').value.trim();if(!/^\d{4,8}$/.test(a))return $('#changePinError').textContent='El PIN debe tener de 4 a 8 números.';if(a!==b)return $('#changePinError').textContent='Los PIN no coinciden.';let r=await changePortalPin(currentToken,a);if(!r?.ok)return $('#changePinError').textContent='No se pudo guardar el PIN.';saveSession(remember);await enterPortal()};
}
async function enterPortal(){
 let raw;
 try{raw=await portalGetBundle(currentToken)}catch(e){raw=null}
 if(!raw?.ok){
   clearSession();currentToken='';
   $('#sessionLoading')?.classList.add('hidden');
   $('#portalApp')?.classList.add('hidden');
   $('#loginGate')?.classList.remove('hidden');
   return false;
 }

 // La sesión YA fue validada por Supabase. A partir de aquí,
 // ningún error secundario de carga debe devolver al login.
 bundle=raw;currentId=bundle.student.id;
 $('#loginGate')?.classList.add('hidden');
 $('#sessionLoading')?.classList.add('hidden');
 $('#portalApp')?.classList.remove('hidden');

 try{
   await load();
 }catch(e){
   console.warn('Una sección no terminó de cargar, pero la sesión sigue activa',e);
   // Mantener la app abierta. El usuario puede actualizar/reintentar.
 }

 $('#loginGate')?.classList.add('hidden');
 $('#sessionLoading')?.classList.add('hidden');
 $('#portalApp')?.classList.remove('hidden');
 return true;
}
async function logout(){try{if(currentToken)await portalLogout(currentToken)}catch(e){}clearSession();location.reload()}
function showFaq(q){
 const answers={'¿Cuándo se entrega?':'Revisa la tarjeta de la actividad: ahí aparece la fecha registrada por el profesor.','¿Qué debo hacer?':'Abre la actividad y revisa la descripción o el material asociado. Si no es suficiente, puedes escribir al profesor.','¿Cómo se califica?':'Consulta Calificaciones. La metodología y los criterios dependen del periodo configurado por el profesor.','¿Dónde encuentro el material?':'En la sección Materiales encontrarás los enlaces publicados para tu grupo.'};
 $('#faqAnswer').textContent=answers[q]||''}

let studentPollTimer=null;
function vapidBytes(base64String){
 const padding='='.repeat((4-base64String.length%4)%4),base64=(base64String+padding).replace(/-/g,'+').replace(/_/g,'/');
 const raw=atob(base64);return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));
}
async function syncStudentPushSubscription(){
  if(!currentToken) throw new Error('Primero inicia sesión en Mi Español.');
  if(!('Notification' in window)) throw new Error('Este dispositivo no admite notificaciones web.');
  if(Notification.permission!=='granted') throw new Error('El permiso de notificaciones no está concedido.');
  if(!('PushManager' in window)) throw new Error('Web Push no está disponible. En iPhone abre Mi Español desde el icono agregado a la pantalla de inicio.');

  const reg=studentSWRegistration || await ensureStudentServiceWorker();
  let sub=await reg.pushManager.getSubscription();
  if(!sub){
    sub=await reg.pushManager.subscribe({
      userVisibleOnly:true,
      applicationServerKey:vapidBytes(WEB_PUSH_VAPID_PUBLIC_KEY)
    });
  }

  const ok=await registerPortalPush(currentToken,sub);
  localStorage.setItem(`miEspanolPushRegistered:${currentId}`,'1');
  return ok;
}
function studentNotifKey(){return `miEspanolNotificationsV78:${currentId||'none'}`}
function studentSnapshotKey(){return `miEspanolSnapshotV78:${currentId||'none'}`}
function readStudentNotifs(){try{const c=Date.now()-7*24*60*60*1000;return JSON.parse(localStorage.getItem(studentNotifKey())||'[]').filter(n=>new Date(n.created||0).getTime()>=c)}catch{return []}}
function saveStudentNotifs(list){localStorage.setItem(studentNotifKey(),JSON.stringify(list.slice(0,120)));renderStudentNotifBadge()}
function renderStudentNotifBadge(){let c=readStudentNotifs().filter(x=>!x.read).length,el=$('#studentNotifCount');if(!el)return;el.textContent=c;el.classList.toggle('hidden',!c)}
async function studentSystemNotification(title,body,target='home'){
 if(!('Notification' in window)||Notification.permission!=='granted')return;
 try{let reg=await navigator.serviceWorker.ready;await reg.showNotification(title,{body,icon:'icon.png',badge:'icon.png',tag:'student-'+Date.now(),data:{target}})}catch(e){console.warn(e)}
}
function addStudentNotification(n){
 let list=readStudentNotifs();if(list.some(x=>x.id===n.id))return;
 // Se conserva en el centro interno de notificaciones.
 // La notificación del sistema ya la entrega Web Push; no la repetimos aquí.
 list.unshift({...n,read:false,created:n.created||new Date().toISOString()});
 saveStudentNotifs(list);
}
async function enableStudentNotifications(){
  const status=$('#studentPushStatus');
  try{
    if(status) status.textContent='Preparando notificaciones…';
    await ensureStudentServiceWorker();

    if(!('Notification' in window)) throw new Error('Este dispositivo no admite notificaciones web.');

    let permission=Notification.permission;
    if(permission!=='granted') permission=await Notification.requestPermission();
    if(permission!=='granted') throw new Error('No se concedió permiso para notificaciones.');

    await syncStudentPushSubscription();
    if(status) status.innerHTML='<b>✓ Este dispositivo está registrado para recibir notificaciones push.</b>';
    alert('Notificaciones push activadas correctamente.');
  }catch(e){
    console.error(e);
    if(status) status.textContent='No se pudo activar: '+(e.message||e);
    alert('No se pudo activar las notificaciones: '+(e.message||e));
  }
}
function openStudentNotifications(){
 let list=readStudentNotifs();
 let panel=$('#studentNotifPanel');
 if(!panel){document.body.insertAdjacentHTML('beforeend',`<div id="studentNotifPanel" class="student-notif-panel hidden"><div class="student-notif-card"><button id="studentNotifClose" class="student-notif-close">×</button><h2>Notificaciones</h2><div class="student-notif-tools"><button id="enableStudentNotif" class="action primary">Activar notificaciones</button><button id="readStudentNotif" class="action">Marcar todo leído</button></div><div id="studentPushStatus" class="push-status muted"></div><div id="studentNotifList"></div></div></div>`);panel=$('#studentNotifPanel');$('#studentNotifClose').onclick=()=>panel.classList.add('hidden')}
 panel.classList.remove('hidden');
 $('#studentNotifList').innerHTML=list.length?list.map(n=>`<div class="student-notif-item ${n.read?'':'unread'}"><b>${esc(n.title)}</b><p>${esc(n.body||'')}</p><small>${new Date(n.created).toLocaleString('es-MX')}</small></div>`).join(''):'<div class="muted">No hay notificaciones.</div>';
 $('#enableStudentNotif').onclick=enableStudentNotifications;
 const pushStatus=$('#studentPushStatus');
 if(pushStatus){
   pushStatus.textContent=localStorage.getItem(`miEspanolPushRegistered:${currentId}`)==='1'
     ? '✓ Este dispositivo ya está registrado para Web Push.'
     : 'Este dispositivo todavía no está registrado para Web Push.';
 }
 $('#readStudentNotif').onclick=()=>{saveStudentNotifs(readStudentNotifs().map(n=>({...n,read:true})));openStudentNotifications()};
}
function snapshotFromBundle(b){
 return {
   notices:Object.fromEntries((b.notices||[]).map(x=>[String(x.id),x.created||x.published_at||''])),
   materials:Object.fromEntries((b.materials||[]).map(x=>[String(x.id),x.title||''])),
   activities:Object.fromEntries((b.activities||[]).map(x=>[String(x.id),x.date||x.name||''])),
   topics:Object.fromEntries((b.studyTopics||[]).map(x=>[String(x.id),x.title||''])),
   replies:Object.fromEntries((b.messages||[]).filter(x=>x.teacher_reply).map(x=>[String(x.id),x.replied_at||x.teacher_reply]))
 };
}
function processStudentChanges(b){
 const key=studentSnapshotKey(),now=snapshotFromBundle(b),raw=localStorage.getItem(key);
 if(!raw){localStorage.setItem(key,JSON.stringify(now));renderStudentNotifBadge();return}
 let old={};try{old=JSON.parse(raw)||{}}catch{}
 for(const n of b.notices||[])if(!(String(n.id) in (old.notices||{})))addStudentNotification({id:'notice-'+n.id,title:'Nuevo aviso',body:n.title||n.text||'Hay un aviso nuevo.',target:'home'});
 for(const m of b.materials||[])if(!(String(m.id) in (old.materials||{})))addStudentNotification({id:'material-'+m.id,title:'Nuevo material',body:m.title||'Se publicó un material nuevo.',target:'materials'});
 for(const a of b.activities||[])if(!(String(a.id) in (old.activities||{})))addStudentNotification({id:'activity-'+a.id,title:'Nueva actividad',body:a.name||'Se publicó una actividad nueva.',target:'activities'});
 for(const t of b.studyTopics||[])if(!(String(t.id) in (old.topics||{})))addStudentNotification({id:'topic-'+t.id,title:'Nuevo tema para estudiar',body:t.title||'Hay un tema nuevo en Estudiar.',target:'study'});
 for(const m of b.messages||[])if(m.teacher_reply && (old.replies||{})[String(m.id)]!==(m.replied_at||m.teacher_reply))addStudentNotification({id:'reply-'+m.id+'-'+(m.replied_at||m.teacher_reply),title:'El profesor respondió',body:String(m.teacher_reply).slice(0,120),target:'chat'});
 localStorage.setItem(key,JSON.stringify(now));
}

const CHAT_SCHOOL_WEEK_ANCHOR='2026-08-31';
function currentChatWeekStartISO(now=new Date()){
  const anchor=new Date(CHAT_SCHOOL_WEEK_ANCHOR+'T00:00:00');
  const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  // Antes del inicio del ciclo permitimos ver los mensajes de prueba.
  if(today<anchor)return null;
  const days=Math.floor((today-anchor)/(24*60*60*1000));
  const start=new Date(anchor);
  start.setDate(anchor.getDate()+Math.floor(days/7)*7);
  return `${start.getFullYear()}-${String(start.getMonth()+1).padStart(2,'0')}-${String(start.getDate()).padStart(2,'0')}`;
}
function chatMessageIsCurrentWeek(m){
  const weekStart=currentChatWeekStartISO();
  if(!weekStart)return true;
  const cutoff=new Date(weekStart+'T00:00:00').getTime();
  const value=m?.replied_at||m?.sent_at||m?.created_at||m?.repliedAt||m?.created||0;
  const ts=new Date(value).getTime();
  return Number.isFinite(ts)&&ts>=cutoff;
}

function sortedChatMessages(){
 return (bundle?.messages||[])
   .filter(chatMessageIsCurrentWeek)
   .slice()
   .sort((a,b)=>String(a.sent_at||a.created_at||'').localeCompare(String(b.sent_at||b.created_at||'')));
}
function latestChatMessage(){
 const msgs=sortedChatMessages();
 return msgs[msgs.length-1]||null;
}
function chatConversationState(){
 const latest=latestChatMessage();
 if(!latest)return {active:false,closed:false,latest:null,remaining:0};

 if(!latest.teacher_reply){
   return {active:true,closed:false,latest,remaining:null};
 }

 const repliedAt=new Date(latest.replied_at||latest.updated_at||latest.sent_at||latest.created_at||0).getTime();
 if(!Number.isFinite(repliedAt)||repliedAt<=0){
   return {active:false,closed:true,latest,remaining:0};
 }

 const remaining=(repliedAt+CHAT_REPLY_WINDOW_MS)-Date.now();
 return {
   active:remaining>0,
   closed:remaining<=0,
   latest,
   remaining:Math.max(0,remaining)
 };
}
function selectChatTopic(topic){
 selectedChatTopic=String(topic||'').trim();
 if(!selectedChatTopic){
   newChatDraftOpen=false;
   $('#chatWindowState').textContent='Nuevo chat';
   $('#chatWaitingNotice').textContent='Elige un tema para iniciar una conversación.';
   return;
 }
 const state=chatConversationState();
 if(!state.active){
   newChatDraftOpen=true;
   $('#chatWindowState').textContent='Nuevo chat';
   $('#chatWaitingNotice').textContent='Escribe tu mensaje. Al enviarlo, el chat quedará abierto mientras esperas respuesta del profesor.';
 }
}
function scheduleChatClose(remaining){
 if(chatCloseTimer){clearTimeout(chatCloseTimer);chatCloseTimer=null}
 if(remaining==null||remaining<=0)return;
 chatCloseTimer=setTimeout(()=>renderChatState(),Math.min(remaining+250,2147483647));
}
function renderChatState(){
 const state=chatConversationState();
 const topicSelect=$('#chatTopicSelect');

 if(state.active){
   const topic=state.latest?.category||selectedChatTopic||'';
   selectedChatTopic=topic;
   newChatDraftOpen=false;
   if(topicSelect)topicSelect.value=topic;

   if(state.latest?.teacher_reply){
     $('#chatWindowState').textContent='5 min para responder';
     const mins=Math.max(1,Math.ceil(state.remaining/60000));
     $('#chatWaitingNotice').textContent=`El profesor ya respondió. Puedes continuar esta conversación durante aproximadamente ${mins} min.`;
     scheduleChatClose(state.remaining);
   }else{
     $('#chatWindowState').textContent='Esperando respuesta';
     $('#chatWaitingNotice').textContent='Tu conversación sigue abierta hasta que el profesor responda.';
     if(chatCloseTimer){clearTimeout(chatCloseTimer);chatCloseTimer=null}
   }
   return;
 }

 if(state.closed){
   newChatDraftOpen=false;
   selectedChatTopic='';
   if(topicSelect)topicSelect.value='';
   $('#chatWindowState').textContent='Chat cerrado';
   $('#chatWaitingNotice').textContent='La conversación anterior terminó. Selecciona un tema para iniciar una nueva.';
   if(chatCloseTimer){clearTimeout(chatCloseTimer);chatCloseTimer=null}
   return;
 }

 $('#chatWindowState').textContent='Nuevo chat';
 $('#chatWaitingNotice').textContent=selectedChatTopic
   ?'Escribe tu mensaje y envíalo.'
   :'Elige un tema para iniciar una conversación.';
}
function renderChatHistory(){
 const box=$('#studentChatHistory');if(!box)return;
 let msgs=sortedChatMessages();
 box.innerHTML=msgs.length?msgs.map(m=>`<div class="chat-entry"><div class="bubble student"><b>${esc(m.category||'Consulta')}</b><div>${esc(m.message||'')}</div><small>${m.sent_at?new Date(m.sent_at).toLocaleString('es-MX'):''}</small></div>${m.teacher_reply?`<div class="bubble teacher"><b>Profe Jaime</b><div>${esc(m.teacher_reply)}</div><small>${m.replied_at?new Date(m.replied_at).toLocaleString('es-MX'):''}</small></div>`:'<div class="reply-pending">Pendiente de respuesta</div>'}</div>`).join(''):'<div class="muted">Todavía no hay mensajes.</div>';
 renderChatState();
}
async function refreshStudentPortal(){
 let fresh=await portalGetBundle(currentToken);if(!fresh?.ok)return;
 processStudentChanges(fresh);bundle=fresh;
 renderSummary();renderNotices();renderActivities();renderAttendance();renderGrades();renderMaterials();renderStudy();renderChatHistory();renderStudentChatAvailability();showBirthdayGreetingIfNeeded().catch(()=>{});await refreshStudentPoints();
}
function startStudentPolling(){
 if(studentPollTimer)clearInterval(studentPollTimer);
 studentPollTimer=setInterval(()=>refreshStudentPortal().catch(()=>{}),20000);
}

async function refreshStudentBirthday(){
 if(!currentToken)return null;
 try{
   const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/portal_get_birth_date`,{
     method:'POST',
     headers:{
       apikey:SUPABASE_PUBLISHABLE_KEY,
       'Content-Type':'application/json'
     },
     body:JSON.stringify({p_token:currentToken})
   });
   if(!r.ok)return null;
   const data=await r.json();
   if(bundle?.student){
     if(data?.birth_day!=null)bundle.student.birth_day=Number(data.birth_day)||null;
     if(data?.birth_month!=null)bundle.student.birth_month=Number(data.birth_month)||null;
     // Compatibilidad temporal mientras Supabase todavía tenga el RPC antiguo.
     const legacy=data?.birth_date||data?.birthdate||'';
     if(legacy)bundle.student.birthdate=legacy;
   }
   return data;
 }catch(e){
   console.warn('birthday refresh',e);
   return null;
 }
}

function studentBirthdayParts(){
 const d=Number(bundle?.student?.birth_day||0);
 const m=Number(bundle?.student?.birth_month||0);
 if(d>=1&&d<=31&&m>=1&&m<=12)return {day:d,month:m};

 // Compatibilidad temporal con birth_date hasta completar Etapa 2.
 const raw=bundle?.student?.birthdate ?? bundle?.student?.birth_date ?? '';
 if(!raw)return null;
 const s=String(raw).trim();
 let x=s.match(/^(\d{4})-(\d{2})-(\d{2})/);
 if(x)return {month:Number(x[2]),day:Number(x[3])};
 x=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
 if(x)return {day:Number(x[1]),month:Number(x[2])};
 return null;
}
function isStudentBirthdayToday(){
 const bd=studentBirthdayParts();
 if(!bd)return false;
 const now=new Date();
 return bd.month===now.getMonth()+1 && bd.day===now.getDate();
}
function birthdayShownKey(){
 const now=new Date();
 const date=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
 return `birthdayGreetingV893:${currentId}:${date}`;
}
async function showBirthdayGreetingIfNeeded(){
 await refreshStudentBirthday();
 if(!isStudentBirthdayToday())return;
 const key=birthdayShownKey();

 // Se muestra una vez por sesión/apertura de la app. El nuevo prefijo evita
 // que una prueba anterior guardada en localStorage bloquee la felicitación.
 if(sessionStorage.getItem(key)==='1')return;

 const first=(bundle?.student?.name||'').trim().split(/\s+/)[0]||'';
 $('#birthdayGreetingTitle').textContent=first?`¡Feliz cumpleaños, ${first}!`:'¡Feliz cumpleaños!';
 $('#birthdayGreeting').classList.remove('hidden');

 $('#closeBirthdayGreeting').onclick=()=>{
   sessionStorage.setItem(key,'1');
   $('#birthdayGreeting').classList.add('hidden');
 };
}

async function load(){
 bundle=await portalGetBundle(currentToken);if(!bundle?.ok)return;normalizeStudentMethodologies();await refreshStudentNotices();
 processStudentChanges(bundle);
 $('#hello').textContent=`Hola, ${(bundle.student.name||'').split(' ')[0]||'alumno'}.`;
 renderSummary();renderNotices();renderActivities();renderAttendance();renderGrades();renderMaterials();renderStudy();renderChatHistory();renderStudentChatAvailability();renderStudentNotifBadge();await refreshStudentPoints();await showBirthdayGreetingIfNeeded();startStudentPolling();if(Notification.permission==='granted')syncStudentPushSubscription().catch(()=>{});
}


async function studentPointsRpc(name,payload={}){
 if(!currentToken)throw new Error('Sesión no disponible.');
 const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`,{
   method:'POST',
   headers:{apikey:SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},
   body:JSON.stringify({p_token:currentToken,...payload})
 });
 let data=null;try{data=await r.json()}catch(_){data=null}
 if(!r.ok){
   const msg=data?.message||data?.error||data?.hint||'No se pudo completar la operación.';
   throw new Error(msg);
 }
 return data;
}
async function refreshStudentPoints(){
 try{
   const data=await studentPointsRpc('portal_points_bundle');
   studentPointsData=data?.ok?data:null;
 }catch(e){
   console.warn('points bundle',e);
   studentPointsData={ok:false,_error:String(e?.message||e||'Error de consulta')};
 }
 renderStudentPoints();
 renderSummary();
 renderGrades();
}
function pointsDateTime(v){
 if(!v)return '—';
 const d=new Date(v);if(Number.isNaN(d.getTime()))return String(v);
 return d.toLocaleString('es-MX',{day:'numeric',month:'long',hour:'numeric',minute:'2-digit'});
}
function pointsChoiceLabel(v){
 return ({keep:'Conservar puntos',used:'Aplicados a calificación',donated:'Donación realizada',mixed:'Aplicados y donados'})[v]||'Sin decisión todavía';
}
function pointTransactionLabel(t){
 const labels={award:'Puntos ganados',grade_use:'Aplicados a calificación',grade_refund:'Puntos devueltos',donation_out:'Donación enviada',donation_in:'Donación recibida',admin_adjustment:'Ajuste'};
 return labels[t?.type]||t?.reason||'Movimiento';
}
function renderStudentPoints(){
 const box=$('#pointsContent');if(!box)return;
 const data=studentPointsData;
 if(!data||data.ok===false){box.innerHTML=`<div class="card muted"><b>No se pudieron consultar tus puntos.</b><p>Vuelve a abrir esta sección. Si continúa, informa al profesor.</p>${data?`<small>${esc(data._error||'')}</small>`:''}</div>`;return}
 const bal=Math.max(0,Number(data.balance||0));
 const p=data.period;
 const tx=(data.transactions||[]).slice(0,20);
 let periodHtml='';
 if(!p){
   periodHtml=`<div class="card points-balance-card"><span>Saldo disponible</span><b>${bal.toFixed(2)}</b><p>Tus puntos se conservan durante el ciclo escolar.</p></div><div class="card"><h3>Periodo de asignación</h3><p class="muted">No hay un periodo programado o abierto para tu grupo en este momento.</p></div>`;
 }else if(p.state==='scheduled'){
   periodHtml=`<div class="card points-balance-card"><span>Saldo disponible</span><b>${bal.toFixed(2)}</b><p>Tus puntos se conservan durante el ciclo escolar.</p></div><div class="card"><span class="pill yellow">Programado</span><h3>${esc(p.month||'Periodo de puntos')}</h3><p>Abre: <b>${esc(pointsDateTime(p.opens_at))}</b></p><p>Cierra: <b>${esc(pointsDateTime(p.closes_at))}</b></p><p class="muted">Las opciones se habilitarán automáticamente cuando comience el periodo.</p></div>`;
 }else if(p.state==='open'){
   const used=Math.max(0,Number(p.points_used||0));
   const max=Math.max(0,Number(p.max_applicable||0));
   const maxAllowed=Math.max(0,Math.min(max,bal+used));
   periodHtml=`<div class="card points-balance-card"><span>Saldo disponible</span><b>${bal.toFixed(2)}</b><p>Tus puntos no utilizados permanecen disponibles.</p></div>
   <div class="card points-period-card"><span class="pill green">Periodo abierto</span><h3>${esc(p.month||'Asignación de puntos')}</h3><p>Cierra: <b>${esc(pointsDateTime(p.closes_at))}</b></p><p>Decisión actual: <b>${esc(pointsChoiceLabel(data.choice))}</b></p>${p.provisional_grade!=null?`<p>Calificación provisional: <b>${Number(p.provisional_grade).toFixed(2)}</b></p>`:''}
   <div class="points-action-box"><h4>Aplicar a mi calificación</h4><p class="muted">Puedes usar hasta ${maxAllowed.toFixed(2)} puntos. Si ya aplicaste puntos, puedes cambiar la cantidad mientras el periodo siga abierto.</p><label>Cantidad total a aplicar<input id="pointsGradeAmount" type="number" min="0" max="${maxAllowed}" step="0.01" inputmode="decimal" value="${used.toFixed(2)}"></label><button id="applyGradePointsBtn" class="action primary" type="button">Guardar aplicación</button></div>
   <div class="points-action-box"><h4>Donar a un compañero</h4><p class="muted">Solo puedes donar a un alumno de tu mismo grupo. Escribe su ID de 5 dígitos; no se muestran nombres ni listas de compañeros.</p><label>ID del compañero<input id="pointsRecipientId" type="text" inputmode="numeric" maxlength="5" placeholder="00000"></label><label>Puntos a donar<input id="pointsDonateAmount" type="number" min="0.01" max="${bal}" step="0.01" inputmode="decimal" placeholder="0.00"></label><button id="donatePointsBtn" class="action" type="button">Donar puntos</button></div>
   <button id="keepPointsBtn" class="action" type="button">Conservar mis puntos sin aplicar</button><div id="pointsActionStatus" class="chat-status"></div></div>`;
 }
 const history=tx.length?tx.map(t=>`<div class="points-history-row"><div><b>${esc(pointTransactionLabel(t))}</b><small>${esc(pointsDateTime(t.created_at))}</small></div><strong class="${Number(t.amount)>=0?'points-plus':'points-minus'}">${Number(t.amount)>=0?'+':''}${Number(t.amount).toFixed(2)}</strong></div>`).join(''):'<div class="muted">Todavía no hay movimientos de puntos.</div>';
 box.innerHTML=periodHtml+`<div class="card"><h3>Movimientos recientes</h3><div class="points-history">${history}</div></div>`;
 $('#applyGradePointsBtn')?.addEventListener('click',applyStudentGradePoints);
 $('#donatePointsBtn')?.addEventListener('click',donateStudentPoints);
 $('#keepPointsBtn')?.addEventListener('click',keepStudentPoints);
}
async function applyStudentGradePoints(){
 const p=studentPointsData?.period;if(!p||p.state!=='open')return;
 const input=$('#pointsGradeAmount'),status=$('#pointsActionStatus');
 const amount=Number(input?.value);
 if(!Number.isFinite(amount)||amount<0){status.textContent='Escribe una cantidad válida.';return}
 const max=Math.max(0,Math.min(Number(p.max_applicable||0),Number(studentPointsData.balance||0)+Number(p.points_used||0)));
 if(amount>max+0.0001){status.textContent=`Puedes aplicar como máximo ${max.toFixed(2)} puntos.`;return}
 if(!confirm(`¿Quieres aplicar ${amount.toFixed(2)} puntos a tu calificación de ${p.month||'este mes'}?`))return;
 try{status.textContent='Guardando…';await studentPointsRpc('portal_set_grade_points',{p_period_id:p.id,p_amount:amount});await refreshStudentPortal();await refreshStudentPoints();status.textContent='';alert('Tu decisión quedó guardada.');}catch(e){status.textContent=e.message||'No se pudo guardar.'}
}
async function keepStudentPoints(){
 const p=studentPointsData?.period;if(!p||p.state!=='open')return;
 const status=$('#pointsActionStatus');
 if(Number(p.points_used||0)>0){
   if(!confirm('Esto quitará los puntos que habías aplicado a tu calificación y los devolverá a tu saldo. ¿Continuar?'))return;
 }
 try{status.textContent='Guardando…';await studentPointsRpc('portal_set_grade_points',{p_period_id:p.id,p_amount:0});await refreshStudentPortal();await refreshStudentPoints();alert('Tus puntos quedarán disponibles para otro momento.');}catch(e){status.textContent=e.message||'No se pudo guardar.'}
}
async function donateStudentPoints(){
 const p=studentPointsData?.period;if(!p||p.state!=='open')return;
 const id=String($('#pointsRecipientId')?.value||'').trim(),amount=Number($('#pointsDonateAmount')?.value),status=$('#pointsActionStatus');
 if(!/^\d{5}$/.test(id)){status.textContent='Escribe el ID de 5 dígitos de tu compañero.';return}
 if(id===String(currentId)){status.textContent='No puedes donarte puntos a ti mismo.';return}
 if(!Number.isFinite(amount)||amount<=0){status.textContent='Escribe cuántos puntos quieres donar.';return}
 if(amount>Number(studentPointsData.balance||0)+0.0001){status.textContent='No tienes suficientes puntos disponibles.';return}
 if(!confirm(`Vas a donar ${amount.toFixed(2)} puntos al ID ${id}. Esta donación no puede deshacerse desde Mi Español. ¿Confirmas?`))return;
 try{status.textContent='Registrando donación…';await studentPointsRpc('portal_donate_points',{p_period_id:p.id,p_recipient_id:id,p_amount:amount});await refreshStudentPoints();alert(`Donación registrada al ID ${id}.`);}catch(e){status.textContent=e.message||'No se pudo realizar la donación.'}
}

function normalizeStudentMethodologies(){
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
const PORTAL_MONTH_ORDER=['Agosto','Septiembre','Octubre','Noviembre','Diciembre','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio'];
function portalMethodTimestamp(m){return String(m.updated||m.closedAt||m.created||'')}
function isQuarterSummary(m){return !!(m?.isQuarterSummary||m?.periodType==='quarter'||m?.data?.isQuarterSummary)}
function studentGradeModel(){
 normalizeStudentMethodologies();
 const all=bundle?.methodologies||[];
 const monthly=all.filter(m=>!isQuarterSummary(m)&&m.closed===true&&m.published!==false&&m.gradeRecords?.[currentId]?.finalDecimal!=null)
   .sort((a,b)=>String(b.cycle||'').localeCompare(String(a.cycle||''))||
     Number(b.quarter||0)-Number(a.quarter||0)||
     PORTAL_MONTH_ORDER.indexOf(b.month)-PORTAL_MONTH_ORDER.indexOf(a.month)||
     portalMethodTimestamp(b).localeCompare(portalMethodTimestamp(a)));
 const quarters=all.filter(m=>isQuarterSummary(m)&&m.closed===true&&m.published===true&&m.gradeRecords?.[currentId]?.finalDecimal!=null)
   .sort((a,b)=>String(b.cycle||'').localeCompare(String(a.cycle||''))||
     Number(b.quarter||0)-Number(a.quarter||0)||
     portalMethodTimestamp(b).localeCompare(portalMethodTimestamp(a)));
 return {monthly,quarters,current:monthly.slice().sort((a,b)=>portalMethodTimestamp(b).localeCompare(portalMethodTimestamp(a)))[0]||null};
}
function currentGrade(){
 const m=studentGradeModel().current;
 return m?.gradeRecords?.[currentId]||null;
}
function pointsAvailable(){
 if(studentPointsData?.ok)return Math.max(0,Number(studentPointsData.balance||0));
 let earned=0,used=0;(bundle.methodologies||[]).forEach(m=>{let r=m.gradeRecords?.[currentId];if(r){earned+=Number(r.pointsGenerated||0);used+=Number(r.pointsUsed||0)}});return Math.max(0,earned-used)
}
function renderSummary(){let g=currentGrade(),present=bundle.attendance.filter(a=>(a.status||'Presente')!=='Falta').length;
 $('#summaryCards').innerHTML=[['Asistencia',present],['Actividades',bundle.activities.length],['Calificación actual',g?.finalDecimal?.toFixed(2)||'—'],['Puntos disponibles',pointsAvailable().toFixed(2)],['Materiales',bundle.materials.length],['Avisos',bundle.notices.length]].map(x=>`<div class="tile"><b>${x[1]}</b><span>${x[0]}</span></div>`).join('')}
function renderNotices(){
 const html=bundle.notices.length?bundle.notices.map(n=>`<div class="card"><b>${esc(n.title)}</b><p>${esc(n.text??n.body??'')}</p></div>`).join(''):'<div class="card muted">Sin avisos nuevos.</div>';
 $('#homeNotices').innerHTML=html;
 $('#studentNotices').innerHTML=html;
}
function portalDate(v){
 if(!v)return 'Sin fecha';
 const d=new Date(v+'T12:00:00');
 if(Number.isNaN(d.getTime()))return String(v);
 return d.toLocaleDateString('es-MX',{day:'numeric',month:'long'});
}
function activityState(a,r){
 const mode=a.evaluationMode||'delivery';
 if(mode==='numeric'&&typeof r?.score==='number')return {label:'Entregada',cls:'green'};
 if(r?.status==='yes')return {label:'Entregada',cls:'green'};
 if(r?.status==='no')return {label:'No entregada',cls:'red'};
 if(a.dueDate){
   const today=new Date();today.setHours(0,0,0,0);
   const due=new Date(a.dueDate+'T23:59:59');
   if(due<today)return {label:'Vencida',cls:'red'};
 }
 return {label:'Pendiente',cls:'yellow'};
}
function renderActivities(){
 let map=recordMap();
 let acts=[...(bundle.activities||[])].sort((a,b)=>{
   const ad=a.dueDate||'9999-12-31',bd=b.dueDate||'9999-12-31';
   return ad.localeCompare(bd)||String(b.date||'').localeCompare(String(a.date||''));
 });
 $('#activityCards').innerHTML=acts.length?acts.map(a=>{
   let r=map.get(`${a.id}|${currentId}`),st=activityState(a,r);
   return `<div class="card delivery-card">
     <div class="delivery-title">${esc(a.name)}</div>
     <div class="delivery-line"><b>Actividad:</b> ${esc(a.name)}</div>
     <div class="delivery-line"><b>Asignada:</b> ${esc(portalDate(a.date))}</div>
     <div class="delivery-line"><b>Entrega:</b> ${esc(portalDate(a.dueDate))}</div>
     <div class="delivery-line"><b>Estado:</b> <span class="pill ${st.cls}">${st.label}</span></div>
     ${typeof r?.score==='number'?`<div class="delivery-line"><b>Calificación:</b> ${r.score}/10</div>`:''}
   </div>`;
 }).join(''):'<div class="card muted">No hay próximas entregas publicadas.</div>';
}
function renderAttendance(){
 const box=$('#attendanceList');if(!box)return;
 const records=(bundle?.attendance||[])
   .slice()
   .sort((a,b)=>String(b.attendance_date||b.date||'').localeCompare(String(a.attendance_date||a.date||'')));

 if(!records.length){
   box.innerHTML='<div class="attendance-empty">Todavía no hay registros de asistencia.</div>';
   return;
 }

 const fmtDate=value=>{
   const s=String(value||'').slice(0,10);
   const m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
   if(!m)return s||'Sin fecha';
   const d=new Date(Number(m[1]),Number(m[2])-1,Number(m[3]));
   return d.toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'long',year:'numeric'})
     .replace(/^./,c=>c.toUpperCase());
 };

 box.innerHTML=records.map(a=>{
   const status=String(a.status||a.attendance_status||'').trim();
   const lowStatus=status.toLowerCase();
   let cls='present',label=status||'Presente';
   if(lowStatus.includes('falta')||lowStatus.includes('aus')){cls='absent';label='Falta'}
   else if(lowStatus.includes('retardo')||lowStatus.includes('tarde')){cls='late';label='Retardo'}
   else if(lowStatus.includes('pres')){cls='present';label='Presente'}

   return `<div class="attendance-row">
     <div class="attendance-date">${esc(fmtDate(a.attendance_date||a.date))}</div>
     <div class="attendance-status ${cls}">${esc(label)}</div>
   </div>`;
 }).join('');
}

function renderGrades(){
 const model=studentGradeModel();
 const monthCards=model.monthly.map(m=>{
   const g=m.gradeRecords?.[currentId];
   return `<div class="card">
     <div style="display:flex;justify-content:space-between;gap:10px;align-items:start">
       <div><h3 style="margin:0">${esc(m.month||'Mes')}</h3><p class="muted" style="margin:4px 0 0">Trimestre ${esc(m.quarter||'—')} · ${esc(m.cycle||'')}</p></div>
       <span class="pill green">Publicada</span>
     </div>
     <h1 style="margin-bottom:4px">${Number(g.finalDecimal).toFixed(2)}</h1>
     <p>Redondeada: <b>${g.rounded??'—'}</b></p>
   </div>`;
 }).join('');
 const quarterCards=model.quarters.map(m=>{
   const g=m.gradeRecords?.[currentId];
   return `<div class="card">
     <h3 style="margin-top:0">Trimestre ${esc(m.quarter||'—')}</h3>
     <p class="muted">${esc(m.cycle||'')}</p>
     <h1 style="margin-bottom:4px">${Number(g.finalDecimal).toFixed(2)}</h1>
     <p>Calificación trimestral redondeada: <b>${g.rounded??'—'}</b></p>
   </div>`;
 }).join('');
 $('#gradeContent').innerHTML=`
   <h3>Calificaciones mensuales</h3>
   ${monthCards||'<div class="card muted">Todavía no hay una calificación mensual calculada.</div>'}
   <h3 style="margin-top:22px">Calificación trimestral</h3>
   ${quarterCards||'<div class="card muted">Aparecerá cuando el profesor calcule el cierre del trimestre.</div>'}
   <div class="card"><p>Puntos disponibles: <b>${pointsAvailable().toFixed(2)}</b></p></div>`;
}
function renderMaterials(){
 $('#materialCards').innerHTML=bundle.materials.length?bundle.materials.map(m=>`<button class="card action" data-material="${esc(m.id)}"><b>${esc(m.title)}</b><p class="muted">${esc(m.type)} · ${m.source==='file'?'Archivo':'Enlace'}</p>${m.fileName?`<small class="muted">${esc(m.fileName)}</small>`:''}</button>`).join(''):'<div class="card muted">Sin materiales publicados.</div>';
 $$('[data-material]').forEach(b=>b.onclick=()=>openMaterial(b.dataset.material));
}
async function openMaterial(id){
 const m=bundle.materials.find(x=>x.id===id);if(!m)return;
 if(m.publicUrl){
   try{
     const r=await fetch(m.publicUrl,{method:'HEAD',cache:'no-store'});
     if(r.ok){window.open(m.publicUrl,'_blank');return}
   }catch(e){}
   alert('El archivo todavía no está disponible en Supabase. Pide al profesor que pulse “Sincronizar ahora” una vez más.');
   return;
 }
 if(m.url){window.open(m.url,'_blank');return}
 alert('Este material todavía no tiene un archivo o enlace disponible.');
}
function studySentences(topic){
 const raw=[topic.title,topic.notes,topic.description,topic.content].filter(Boolean).join('. ');
 return raw.split(/[.!?;\n]+/).map(x=>x.trim()).filter(x=>x.length>12);
}
function studyWords(topic){
 const stop=new Set(['para','como','esta','este','estos','estas','desde','entre','sobre','todo','todos','todas','pero','porque','cuando','donde','quien','cual','unos','unas','del','las','los','una','uno','que','con','por','más','muy','sin','sus','son','ser','es','se','la','el','un','y','o','a','de','en']);
 return [...new Set(studySentences(topic).join(' ').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').match(/[a-zñ]{5,}/g)||[])].filter(w=>!stop.has(w));
}
function shuffled(a){return [...a].sort(()=>Math.random()-.5)}
function makeStudyQuestions(topic,count=10){
 const sentences=studySentences(topic),words=studyWords(topic),qs=[];
 for(let i=0;i<count;i++){
   const s=sentences[i%Math.max(sentences.length,1)]||`El tema trabajado es ${topic.title}.`;
   let candidates=words.filter(w=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').includes(w));
   let answer=candidates[Math.floor(Math.random()*Math.max(candidates.length,1))]||words[i%Math.max(words.length,1)]||String(topic.title||'tema').split(/\s+/)[0];
   let re=new RegExp(`\\b${answer}\\b`,'i');
   let prompt=s.replace(re,'_____');
   if(prompt===s)prompt=`¿Cuál de estas palabras se relaciona directamente con el tema "${topic.title}"?`;
   let distract=shuffled(words.filter(w=>w!==answer)).slice(0,3);
   while(distract.length<3)distract.push(['concepto','ejemplo','contexto','lectura'][distract.length]);
   qs.push({prompt,answer,options:shuffled([answer,...distract])});
 }
 return qs;
}
function ensureStudyModal(){
 let el=$('#studyModal');if(el)return el;
 document.body.insertAdjacentHTML('beforeend',`<div id="studyModal" class="study-modal hidden"><div class="study-panel"><button id="closeStudyModal" class="study-close">×</button><div id="studyGame"></div></div></div>`);
 $('#closeStudyModal').onclick=()=>$('#studyModal').classList.add('hidden');
 return $('#studyModal');
}
function openStudyMode(topicId,mode){
 const topic=bundle.studyTopics.find(t=>String(t.id)===String(topicId));if(!topic)return;
 ensureStudyModal();const modal=$('#studyModal'),game=$('#studyGame');modal.classList.remove('hidden');
 if(mode==='review'){
   const parts=studySentences(topic);
   game.innerHTML=`<h2>Repaso · ${esc(topic.title)}</h2><p class="muted">Lee cada tarjeta antes de continuar.</p>${(parts.length?parts:[topic.notes||`Tema: ${topic.title}`]).map((x,i)=>`<div class="study-flash"><b>${i+1}</b><p>${esc(x)}</p></div>`).join('')}`;
   return;
 }
 const qs=makeStudyQuestions(topic,mode==='daily'?1:10);let index=0,score=0,locked=false;
 const title=mode==='quiz'?'Trivia rápida':mode==='exam'?'Examen':'Pregunta del día';
 function paint(){
   if(index>=qs.length){game.innerHTML=`<h2>${esc(title)}</h2><div class="study-result"><b>${score}/${qs.length}</b><p>${score>=Math.ceil(qs.length*.7)?'¡Buen trabajo!':'Conviene hacer un repaso y volver a intentarlo.'}</p><button id="studyAgain" class="action primary">Intentar de nuevo</button></div>`;$('#studyAgain').onclick=()=>openStudyMode(topicId,mode);return}
   locked=false;let q=qs[index];
   game.innerHTML=`<h2>${esc(title)} · ${esc(topic.title)}</h2><p class="muted">Pregunta ${index+1} de ${qs.length}</p><div class="study-question">${esc(q.prompt)}</div><div class="study-options">${q.options.map(o=>`<button class="action study-option" data-answer="${esc(o)}">${esc(o)}</button>`).join('')}</div><div id="studyFeedback"></div>`;
   $$('.study-option').forEach(b=>b.onclick=()=>{if(locked)return;locked=true;let ok=b.dataset.answer===q.answer;if(ok)score++;$('#studyFeedback').innerHTML=`<div class="${ok?'study-good':'study-bad'}">${ok?'✓ Correcto':'✗ Respuesta correcta: '+esc(q.answer)}</div><button id="studyNext" class="action primary">${index+1===qs.length?'Ver resultado':'Siguiente'}</button>`;$('#studyNext').onclick=()=>{index++;paint()}});
 }
 paint();
}
function renderStudy(){
 $('#studyTopics').innerHTML=bundle.studyTopics.length?bundle.studyTopics.map(t=>`<div class="card"><b>${esc(t.title)}</b><p class="muted">${esc(t.notes||'Tema trabajado')}</p><div class="question-actions"><button class="action" data-study="${esc(t.id)}" data-mode="quiz">Trivia rápida</button><button class="action" data-study="${esc(t.id)}" data-mode="exam">Examen</button><button class="action" data-study="${esc(t.id)}" data-mode="daily">Pregunta del día</button><button class="action" data-study="${esc(t.id)}" data-mode="review">Repaso</button></div><small class="muted">Las preguntas se crean automáticamente a partir del contenido publicado por el profesor.</small></div>`).join(''):'<div class="card muted">Todavía no hay temas publicados.</div>';
 $$('[data-study]').forEach(b=>b.onclick=()=>openStudyMode(b.dataset.study,b.dataset.mode));
}
function studentChatTodayKey(){
 const now=new Date();
 const y=now.getFullYear();
 const m=String(now.getMonth()+1).padStart(2,'0');
 const d=String(now.getDate()).padStart(2,'0');
 return `${y}-${m}-${d}`;
}
function studentChatAvailability(){
 const a=bundle?.availability||{};
 const today=studentChatTodayKey();
 const overrideToday=String(a.studentChatOverrideDate||'')===today;
 const mode=a.studentChatOverride||'auto';
 if(overrideToday&&mode==='open')return {open:true,reason:'manual-open'};
 if(overrideToday&&mode==='closed')return {open:false,reason:'manual-closed'};
 const now=new Date(),day=now.getDay(),hm=now.toTimeString().slice(0,5);
 const open=day>=1&&day<=5&&hm<'14:00';
 return {open,reason:open?'schedule-open':'schedule-closed'};
}
function renderStudentChatAvailability(){
 const state=studentChatAvailability();
 $('#chat')?.classList.toggle('chat-closed',!state.open);
 if($('#sendStudentMessage'))$('#sendStudentMessage').disabled=!state.open;
 if($('#chatTopicSelect'))$('#chatTopicSelect').disabled=!state.open;
 if($('#studentMessage'))$('#studentMessage').disabled=!state.open;
 if(!state.open){
   $('#chatWindowState').textContent='Chat cerrado';
   $('#chatWaitingNotice').textContent=state.reason==='manual-closed'
     ?'El profesor cerró temporalmente el chat durante hoy.'
     :'El chat está cerrado. Horario de atención: lunes a viernes hasta las 2:00 p. m.';
 }else if(!chatConversationState().active){
   $('#chatWindowState').textContent=state.reason==='manual-open'?'Abierto por el profesor':'Chat abierto';
   $('#chatWaitingNotice').textContent='Selecciona un tema, escribe tu mensaje y envíalo.';
 }
 return state.open;
}

async function sendMessage(){
 if(!renderStudentChatAvailability()){$('#chatStatus').textContent='El chat está cerrado en este momento.';return}
 const state=chatConversationState();
 let text=$('#studentMessage').value.trim();if(!text)return;

 let category='';
 if(state.active){
   category=state.latest?.category||selectedChatTopic||$('#chatTopicSelect')?.value||'';
 }else{
   category=$('#chatTopicSelect')?.value||selectedChatTopic||'';
   if(category)newChatDraftOpen=true;
 }

 if(!category){
   $('#chatStatus').textContent='Primero selecciona un tema.';
   return;
 }

 let a=bundle.availability||{},now=new Date(),day=now.getDay(),hm=now.toTimeString().slice(0,5),date=now.toISOString().slice(0,10),vac=a.vacationStart&&a.vacationEnd&&date>=a.vacationStart&&date<=a.vacationEnd,closed=a.suspended||vac||(a.technicalCouncilDates||[]).includes(date)||!(a.days||[]).includes(day)||hm<a.start||hm>a.end;
 let r=await portalSendMessage(currentToken,category,text);
 if(!r?.ok)return $('#chatStatus').textContent='No se pudo enviar el mensaje.';
 try{await sendPortalPushEvent(currentToken,'new_message',{message:text,category})}catch(e){console.warn('push message',e)}
 $('#studentMessage').value='';
 selectedChatTopic=category;
 if($('#chatTopicSelect'))$('#chatTopicSelect').value=category;
 newChatDraftOpen=false;
 $('#chatStatus').textContent=closed?'Tu mensaje fue recibido. Será respondido el siguiente día hábil dentro del horario de atención.':'Tu mensaje fue recibido dentro del horario de atención.';
 await refreshStudentPortal();
}
window.addEventListener('message',e=>{if(e.data?.type==='OPEN_PUSH_TARGET'){const t=e.data.target||'home';$$('.nav-btn').forEach(x=>x.classList.toggle('active',x.dataset.view===t));$$('.view').forEach(v=>v.classList.toggle('active',v.id===t));if(t==='chat')refreshStudentPortal().catch(()=>{});if(t==='points')refreshStudentPoints().catch(()=>{})}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&currentToken)refreshStudentPoints().catch(()=>{});});
init();
