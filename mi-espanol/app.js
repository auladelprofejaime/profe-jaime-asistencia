
const $$=s=>[...document.querySelectorAll(s)];
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const same=(a,b)=>String(a||'').replace(/\s+/g,'').toUpperCase()===String(b||'').replace(/\s+/g,'').toUpperCase();
function setView(id){$$('.view').forEach(v=>v.classList.toggle('active',v.id===id));$$('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===id));window.scrollTo({top:0,behavior:'smooth'})}
$$('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));

import {portalLogin,changePortalPin,portalLogout,portalGetBundle,portalSendMessage,registerPortalPush,sendPortalPushEvent,WEB_PUSH_VAPID_PUBLIC_KEY} from '../shared/supabase-adapter.js?v=810';
let currentId='',bundle=null,currentToken='';
let studentSWRegistration=null;

async function ensureStudentServiceWorker(){
  if(!('serviceWorker' in navigator)) throw new Error('Este navegador no admite service workers.');
  studentSWRegistration = await navigator.serviceWorker.register('./service-worker.js?v=800',{scope:'./'});
  await navigator.serviceWorker.ready;
  return studentSWRegistration;
}

function recordMap(){return new Map((bundle?.activityRecords||[]).map(r=>[r.key,r]))}
let scanner=null;
let selectedChatTopic='';
let newChatDraftOpen=false;
let chatCloseTimer=null;
const CHAT_REPLY_WINDOW_MS=5*60*1000;
async function init(){
 try{await ensureStudentServiceWorker()}catch(e){console.warn('SW',e)}
 $('#loginBtn').onclick=doLogin;$('#logoutBtn').onclick=logout;$('#scanIdBtn').onclick=startScanner;$('#stopScanBtn').onclick=stopScanner;
 $('#studentNotifBtn').onclick=openStudentNotifications;
 $('#refreshStudentChat').onclick=refreshStudentPortal;
 $('#sendStudentMessage').onclick=sendMessage;
 $('#startTeacherChat').onclick=startTeacherChat;
 $$('[data-chat-topic]').forEach(b=>b.onclick=()=>selectChatTopic(b.dataset.chatTopic));

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
   $('#loginGate')?.classList.remove('hidden');
   $('#portalApp')?.classList.add('hidden');
   return false;
 }
 bundle=raw;currentId=bundle.student.id;
 $('#sessionLoading')?.classList.add('hidden');
 $('#loginGate')?.classList.add('hidden');
 $('#portalApp')?.classList.remove('hidden');
 await load();
 return true;
}
async function logout(){try{if(currentToken)await portalLogout(currentToken)}catch(e){}clearSession();location.reload()}
async function startScanner(){
 if(typeof Html5Qrcode==='undefined'){return $('#loginError').textContent='No fue posible cargar el lector. Puedes escribir el ID manualmente.'}
 $('#scanIdBtn').classList.add('hidden');$('#stopScanBtn').classList.remove('hidden');scanner=new Html5Qrcode('barcodeReader');
 const formats=[Html5QrcodeSupportedFormats.CODE_128,Html5QrcodeSupportedFormats.CODE_39,Html5QrcodeSupportedFormats.EAN_13,Html5QrcodeSupportedFormats.EAN_8,Html5QrcodeSupportedFormats.UPC_A,Html5QrcodeSupportedFormats.UPC_E,Html5QrcodeSupportedFormats.ITF];
 try{await scanner.start({facingMode:'environment'},{fps:10,qrbox:{width:280,height:120},formatsToSupport:formats},decoded=>{$('#loginId').value=decoded;stopScanner()},()=>{})}catch(e){$('#loginError').textContent='No se pudo abrir la cámara. Revisa el permiso de cámara.';stopScanner()}
}
async function stopScanner(){if(scanner){try{await scanner.stop();await scanner.clear()}catch(e){}scanner=null}$('#scanIdBtn')?.classList.remove('hidden');$('#stopScanBtn')?.classList.add('hidden')}
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
function readStudentNotifs(){try{return JSON.parse(localStorage.getItem(studentNotifKey())||'[]')}catch{return []}}
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
function sortedChatMessages(){
 return (bundle?.messages||[]).slice().sort((a,b)=>String(a.sent_at||a.created_at||'').localeCompare(String(b.sent_at||b.created_at||'')));
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
 $$('[data-chat-topic]').forEach(b=>b.classList.toggle('selected',b.dataset.chatTopic===selectedChatTopic));
 const help={
   'Actividad':'Describe qué actividad es y cuál es tu duda.',
   'Calificación':'Indica la actividad, trabajo o periodo que quieres consultar.',
   'Material':'Indica qué material, lectura o contenido necesitas aclarar.',
   'Asistencia':'Explica qué registro de asistencia quieres consultar. Recuerda que las faltas no se justifican por este chat.',
   'Problema con la plataforma':'Explica qué botón, pantalla o función no está trabajando correctamente.',
   'Otro':'Describe brevemente el asunto escolar de Español.'
 };
 $('#chatTopicHelp').textContent=help[selectedChatTopic]||'Selecciona una opción para continuar.';
 $('#startTeacherChat').disabled=!selectedChatTopic;
}
function startTeacherChat(){
 if(!selectedChatTopic)return;
 newChatDraftOpen=true;
 $('#chatStartForm').hidden=true;
 $('#chatClosedNotice').hidden=true;
 $('#chatActivePanel').hidden=false;
 $('#activeChatTopic').textContent=`Motivo: ${selectedChatTopic}`;
 $('#chatWindowState').textContent='Nuevo chat';
 $('#chatWaitingNotice').textContent='Escribe tu primer mensaje. Al enviarlo, el chat quedará abierto mientras esperas respuesta del profesor.';
 $('#chatStatus').textContent='';
 $('#studentMessage').focus();
}
function scheduleChatClose(remaining){
 if(chatCloseTimer){clearTimeout(chatCloseTimer);chatCloseTimer=null}
 if(remaining==null||remaining<=0)return;
 chatCloseTimer=setTimeout(()=>{
   renderChatState();
 },Math.min(remaining+250,2147483647));
}
function renderChatState(){
 const state=chatConversationState();

 if(newChatDraftOpen){
   $('#chatStartForm').hidden=true;
   $('#chatClosedNotice').hidden=true;
   $('#chatActivePanel').hidden=false;
   $('#activeChatTopic').textContent=`Motivo: ${selectedChatTopic||'Consulta'}`;
   $('#chatWindowState').textContent='Nuevo chat';
   $('#chatWaitingNotice').textContent='Escribe tu primer mensaje. Al enviarlo, el chat quedará abierto mientras esperas respuesta del profesor.';
   if(chatCloseTimer){clearTimeout(chatCloseTimer);chatCloseTimer=null}
   return;
 }

 if(state.active){
   const topic=state.latest?.category||selectedChatTopic||'Consulta';
   selectedChatTopic=topic;
   $('#chatStartForm').hidden=true;
   $('#chatClosedNotice').hidden=true;
   $('#chatActivePanel').hidden=false;
   $('#activeChatTopic').textContent=`Motivo: ${topic}`;

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

 $('#chatActivePanel').hidden=true;
 $('#chatStartForm').hidden=false;
 $('#chatClosedNotice').hidden=!state.closed;
 newChatDraftOpen=false;
 selectedChatTopic='';
 $$('[data-chat-topic]').forEach(b=>b.classList.remove('selected'));
 if($('#startTeacherChat'))$('#startTeacherChat').disabled=true;
 if($('#chatTopicHelp'))$('#chatTopicHelp').textContent='Selecciona una opción para continuar.';
 if(chatCloseTimer){clearTimeout(chatCloseTimer);chatCloseTimer=null}
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
 renderSummary();renderNotices();renderActivities();renderAttendance();renderGrades();renderMaterials();renderStudy();renderReports();renderChatHistory();
}
function startStudentPolling(){
 if(studentPollTimer)clearInterval(studentPollTimer);
 studentPollTimer=setInterval(()=>refreshStudentPortal().catch(()=>{}),20000);
}
async function load(){
 bundle=await portalGetBundle(currentToken);if(!bundle?.ok)return;
 processStudentChanges(bundle);
 $('#hello').textContent=`Hola, ${(bundle.student.name||'').split(' ')[0]||'alumno'}.`;
 renderSummary();renderNotices();renderActivities();renderAttendance();renderGrades();renderMaterials();renderStudy();renderReports();renderChatHistory();renderStudentNotifBadge();startStudentPolling();if(Notification.permission==='granted')syncStudentPushSubscription().catch(()=>{});
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
function renderAttendance(){let now=new Date(),y=now.getFullYear(),m=now.getMonth(),days=new Date(y,m+1,0).getDate(),map=new Map(bundle.attendance.filter(a=>{let d=new Date(a.date+'T12:00:00');return d.getFullYear()===y&&d.getMonth()===m}).map(a=>[Number(a.date.slice(-2)),a]));let first=new Date(y,m,1).getDay();let cells='';for(let i=0;i<first;i++)cells+='<div></div>';for(let d=1;d<=days;d++){let a=map.get(d),st=a?.status||'',c=st==='Falta'?'#ef4555':st==='Retardo'?'#ffd43b':a?'#43d17d':'';cells+=`<div class="day"><b>${d}</b>${c?`<div><span class="dot" style="background:${c}"></span> ${esc(st||'Presente')}</div>`:''}</div>`}$('#attendanceCalendar').innerHTML=cells}
function renderGrades(){let g=currentGrade(),pct=g?Math.min(100,(Number(g.finalDecimal||0)/10)*100):0;$('#gradeContent').innerHTML=`<div class="card"><h3>Calificación actual</h3><h1>${g?.finalDecimal?.toFixed(2)||'—'}</h1><div class="progress"><i style="width:${pct}%"></i></div><p>Redondeada: <b>${g?.rounded??'—'}</b></p><p>Puntos disponibles: <b>${pointsAvailable().toFixed(2)}</b></p></div>`}
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
function renderReports(){$('#studentReports').innerHTML=bundle.reports.length?bundle.reports.map(r=>`<button class="card action" data-report-id="${r.id}"><b>${esc(r.title)}</b><p class="muted">${new Date(r.created).toLocaleString('es-MX')}</p></button>`).join(''):'<div class="card muted">Sin reportes archivados.</div>';$$('[data-report-id]').forEach(b=>b.onclick=()=>openReport(b.dataset.reportId))}
async function openReport(id){alert('El reporte está registrado, pero la apertura segura de PDF se habilitará en la siguiente actualización.')}
async function sendMessage(){
 const state=chatConversationState();

 if(state.closed&&!newChatDraftOpen){
   $('#chatStatus').textContent='Esta conversación ya terminó. Inicia una nueva consulta desde el formulario.';
   renderChatState();
   return;
 }

 let text=$('#studentMessage').value.trim();if(!text)return;
 let category=newChatDraftOpen?selectedChatTopic:(state.active?(state.latest?.category||selectedChatTopic):selectedChatTopic);
 if(!category)return $('#chatStatus').textContent='Primero selecciona el motivo de tu consulta.';

 let a=bundle.availability||{},now=new Date(),day=now.getDay(),hm=now.toTimeString().slice(0,5),date=now.toISOString().slice(0,10),vac=a.vacationStart&&a.vacationEnd&&date>=a.vacationStart&&date<=a.vacationEnd,closed=a.suspended||vac||(a.technicalCouncilDates||[]).includes(date)||!(a.days||[]).includes(day)||hm<a.start||hm>a.end;
 let r=await portalSendMessage(currentToken,category,text);
 if(!r?.ok)return $('#chatStatus').textContent='No se pudo enviar el mensaje.';
 try{await sendPortalPushEvent(currentToken,'new_message',{message:text,category})}catch(e){console.warn('push message',e)}
 $('#studentMessage').value='';
 newChatDraftOpen=false;
 $('#chatStatus').textContent=closed?'Tu mensaje fue recibido. Será respondido el siguiente día hábil dentro del horario de atención.':'Tu mensaje fue recibido dentro del horario de atención.';
 await refreshStudentPortal();
}
window.addEventListener('message',e=>{if(e.data?.type==='OPEN_PUSH_TARGET'){const t=e.data.target||'home';$$('.nav-btn').forEach(x=>x.classList.toggle('active',x.dataset.view===t));$$('.view').forEach(v=>v.classList.toggle('active',v.id===t));if(t==='chat')refreshStudentPortal().catch(()=>{})}});
init();
