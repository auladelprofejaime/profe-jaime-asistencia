const SUPABASE_URL="https://xqeyyjakmeiaahecfdmc.supabase.co";
const SUPABASE_KEY="sb_publishable_GY2NGAigumnZw3rIJKU7LA_a2qigAEA";
const TOKEN_KEY='meritInstallationTokenV1';
const STAFF_CACHE_KEY='meritStaffCacheV16';
const SETUP_CACHE_KEY='meritMustChangePinV16';
const QUEUE_KEY='meritOfflineQueueV16';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let token=localStorage.getItem(TOKEN_KEY)||'';
let staff=null,grade=null,group=null,points=null,syncing=false;

async function rpc(name,args={}){
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),8000);
 try{
  const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`,{
   method:'POST',
   cache:'no-store',
   signal:controller.signal,
   headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`,'Content-Type':'application/json'},
   body:JSON.stringify(args)
  });
  const text=await r.text();let d=null;try{d=text?JSON.parse(text):null}catch{d=text}
  if(!r.ok)throw new Error(d?.message||d?.error||text||`HTTP ${r.status}`);
  return d;
 }catch(e){
  if(e?.name==='AbortError')throw new Error('La conexión tardó demasiado.');
  if(!navigator.onLine)throw new Error('No hay conexión a internet.');
  throw e;
 }finally{clearTimeout(timer)}
}

function roleLabel(r){return ({docente:'Docente',direccion:'Dirección',subdireccion:'Subdirección',prefectura:'Prefectura',otro:'Personal autorizado'})[r]||r||''}
function cacheSession(mustChange=false){
 if(staff)localStorage.setItem(STAFF_CACHE_KEY,JSON.stringify(staff));
 localStorage.setItem(SETUP_CACHE_KEY,mustChange?'1':'0');
}
function readCachedStaff(){try{return JSON.parse(localStorage.getItem(STAFF_CACHE_KEY)||'null')}catch{return null}}
function cachedMustChange(){return localStorage.getItem(SETUP_CACHE_KEY)==='1'}
function getQueue(){try{const q=JSON.parse(localStorage.getItem(QUEUE_KEY)||'[]');return Array.isArray(q)?q:[]}catch{return []}}
function saveQueue(q){localStorage.setItem(QUEUE_KEY,JSON.stringify(q));updateOfflineUI()}
function eventId(){return crypto?.randomUUID?.()||('evt-'+Date.now()+'-'+Math.random().toString(16).slice(2))}
function friendlyReason(d){
 const map={
  daily_positive_limit:`Ya alcanzaste el límite positivo para este grupo. Te quedan ${d?.remaining??0} puntos.`,
  daily_negative_limit:`Ya alcanzaste el límite negativo para este grupo. Te quedan ${d?.remaining??0} puntos.`,
  no_open_period:'No existe un periodo abierto para la fecha en que se capturó.',
  unauthorized:'Este dispositivo ya no está autorizado.',
  staff_inactive:'Este acceso está inactivo.',
  trial_expired:'Este ID de prueba ya venció.',
  pin_change_required:'Antes de continuar, cambia tu NIP.',
  invalid_capture_time:'El registro pendiente es demasiado antiguo para sincronizarse automáticamente.',
  duplicate_event_conflict:'No fue posible validar el identificador del registro.'
 };
 return map[d?.reason]||d?.reason||'No se pudo guardar.';
}
function updateOfflineUI(){
 const title=$('#offlineTitle'),detail=$('#offlineDetail'),retry=$('#offlineRetry');
 if(!title||!detail)return;
 const q=getQueue(),withError=q.filter(x=>x.error).length;
 if(!navigator.onLine){
  title.textContent='Sin internet · modo offline';
  detail.textContent=q.length?`${q.length} pendiente${q.length===1?'':'s'} de sincronizar`:'Los registros se guardarán en este dispositivo';
 }else if(syncing){
  title.textContent='Sincronizando…';
  detail.textContent=`${q.length} pendiente${q.length===1?'':'s'}`;
 }else if(q.length){
  title.textContent=withError?'Hay registros que requieren revisión':'Con internet · pendientes por enviar';
  detail.textContent=`${q.length} pendiente${q.length===1?'':'s'}${withError?` · ${withError} con aviso`:''}`;
 }else{
  title.textContent='Con internet · todo sincronizado';
  detail.textContent='0 pendientes';
 }
 if(retry)retry.disabled=!navigator.onLine||syncing||!q.length;
}

async function syncPending(){
 if(syncing||!navigator.onLine||!token)return;
 let q=getQueue();
 if(!q.length){updateOfflineUI();return}
 syncing=true;updateOfflineUI();
 const remaining=[];
 for(const item of q){
  try{
   const d=await rpc('merit_register_movement',{
    p_token:token,
    p_group_code:item.group,
    p_points:item.points,
    p_reason:item.reason,
    p_criteria:item.criteria,
    p_client_event_id:item.eventId,
    p_captured_at:item.capturedAt
   });
   if(!d?.ok){
    item.error=friendlyReason(d);
    remaining.push(item);
    if(['unauthorized','staff_inactive','trial_expired','pin_change_required'].includes(d?.reason))break;
   }
  }catch(e){
   item.error=e.message||String(e);
   remaining.push(item);
   const rest=q.slice(q.indexOf(item)+1);
   remaining.push(...rest);
   break;
  }
 }
 q=remaining;
 saveQueue(q);
 syncing=false;updateOfflineUI();
}

function queueMovement(item){
 const q=getQueue();
 q.push(item);
 saveQueue(q);
}

async function checkDevice(){
 if(!token)return showActivation();
 if(!navigator.onLine){
  staff=readCachedStaff();
  if(staff){showCapture();updateOfflineUI();return}
  showActivation();
  $('#activationStatus').innerHTML='<span class="error">Necesitas internet para el primer acceso en este dispositivo.</span>';
  return;
 }
 try{
  const d=await rpc('merit_device_info',{p_token:token});
  if(!d?.ok){
   localStorage.removeItem(TOKEN_KEY);token='';
   localStorage.removeItem(STAFF_CACHE_KEY);localStorage.removeItem(SETUP_CACHE_KEY);
   return showActivation();
  }
  staff=d.staff;cacheSession(!!d.must_change_pin);showCapture();
  if(d.must_change_pin)setTimeout(()=>openPinDialog(!!staff.is_placeholder),80);
  syncPending();
 }catch(e){
  staff=readCachedStaff();
  if(staff){showCapture();updateOfflineUI()}
  else showActivation();
 }
}

function showActivation(){$('#activation').classList.remove('hidden');$('#capture').classList.add('hidden');updateOfflineUI()}
function showCapture(){
 $('#activation').classList.add('hidden');$('#capture').classList.remove('hidden');
 $('#staffName').textContent=staff?.display_name||(`ID ${staff?.staff_code||''}`);
 $('#staffRole').textContent=staff?.subject_area||roleLabel(staff?.role_type);
 checkSystemReady();updateOfflineUI();
}
function openPinDialog(needsProfile,currentPin=''){
 const dlg=$('#pinDialog'),fields=$('#profileFields');
 dlg.dataset.needsProfile=needsProfile?'1':'0';
 fields.classList.toggle('hidden',!needsProfile);
 $('#pinDialogTitle').textContent=needsProfile?'Completa tu registro':'Cambia tu NIP temporal';
 $('#pinDialogText').textContent=needsProfile
  ?'Captura tus datos y cambia el NIP impreso por uno personal.'
  :'Tu NIP fue restablecido. Conservamos tu nombre y asignatura; solo elige un NIP nuevo.';
 $('#saveNewPin').textContent=needsProfile?'GUARDAR DATOS Y NUEVO NIP':'GUARDAR NUEVO NIP';
 $('#currentPin').value=currentPin||'';
 $('#newPin').value='';$('#newPinConfirm').value='';$('#pinChangeStatus').textContent='';
 if(!dlg.open)dlg.showModal();
}

$('#activateBtn').onclick=async()=>{
 const staffCode=$('#staffCode').value.trim(),pin=$('#activationCode').value.trim(),st=$('#activationStatus');
 st.textContent='';
 if(!navigator.onLine)return st.innerHTML='<span class="error">Necesitas internet para iniciar sesión o recuperar el acceso.</span>';
 if(!/^\d{6}$/.test(staffCode))return st.innerHTML='<span class="error">Escribe tu ID de 6 dígitos.</span>';
 if(!/^\d{4}$/.test(pin))return st.innerHTML='<span class="error">Escribe tu NIP de 4 dígitos.</span>';
 try{
  const d=await rpc('merit_login_device',{p_staff_code:staffCode,p_pin:pin});
  if(!d?.ok){
   const msgs={invalid_credentials:'ID o NIP incorrectos.',trial_expired:'Este ID de prueba ya venció. Consulta al administrador.'};
   throw new Error(msgs[d?.reason]||'No se pudo ingresar.');
  }
  token=d.installation_token;staff=d.staff;
  localStorage.setItem(TOKEN_KEY,token);cacheSession(!!d.must_change_pin);
  $('#staffCode').value='';$('#activationCode').value='';showCapture();
  if(d.must_change_pin)setTimeout(()=>openPinDialog(!!staff.is_placeholder,pin),80);
  syncPending();
 }catch(e){st.innerHTML=`<span class="error">${e.message||e}</span>`}
};

$('#forgetDevice').onclick=()=>{
 if(confirm('¿Desvincular este dispositivo? Para volver a usarlo necesitarás tu ID y NIP vigentes.')){
  localStorage.removeItem(TOKEN_KEY);localStorage.removeItem(STAFF_CACHE_KEY);localStorage.removeItem(SETUP_CACHE_KEY);
  location.reload();
 }
};

$$('#gradeButtons button').forEach(b=>b.onclick=()=>{
 grade=Number(b.dataset.grade);group=null;
 const gc=$('#selectedGroupConfirm');if(gc)gc.textContent='';
 $$('#gradeButtons button').forEach(x=>x.classList.toggle('active',x===b));renderGroups();
});
function renderGroups(){
 const box=$('#groupButtons');box.innerHTML='';if(!grade)return;
 const start=grade*10+1;
 for(let n=start;n<=start+5;n++){
  const b=document.createElement('button');b.className='yellow';b.textContent=n;
  b.onclick=()=>{group=String(n);[...box.children].forEach(x=>x.classList.toggle('active',x===b));$('#selectedGroupConfirm').textContent=`✓ Grupo ${group} seleccionado`};
  box.appendChild(b);
 }
}
$$('#pointButtons button').forEach(b=>b.onclick=()=>{
 points=b.dataset.points===''?null:Number(b.dataset.points);
 $$('#pointButtons button').forEach(x=>x.classList.toggle('active',x===b));
 $('#reasonWrap').classList.toggle('hidden',points===null);
});
const criteriaNames={cleanliness:'Limpieza',uniform:'Uniforme',punctuality:'Puntualidad',coexistence:'Convivencia',responsibility:'Responsabilidad',attitude:'Actitud',institutional_participation:'Participación institucional'};
function selectedCriteria(){return $$('#criteria input:checked').map(x=>x.value)}

$('#reviewBtn').onclick=async()=>{
 $('#captureStatus').textContent='';
 if(cachedMustChange()){
  $('#captureStatus').innerHTML='<span class="error">Antes de continuar, completa el cambio de NIP.</span>';
  if(navigator.onLine)openPinDialog(!!staff?.is_placeholder);
  return;
 }
 if(navigator.onLine){
  try{
   const d=await rpc('merit_device_info',{p_token:token});
   if(!d?.ok){
    localStorage.removeItem(TOKEN_KEY);token='';return showActivation();
   }
   staff=d.staff;cacheSession(!!d.must_change_pin);
   if(d.must_change_pin){
    $('#captureStatus').innerHTML='<span class="error">Antes de continuar, cambia tu NIP.</span>';
    openPinDialog(!!staff.is_placeholder);return;
   }
  }catch(e){updateOfflineUI()}
 }
 if(!group)return $('#captureStatus').innerHTML='<span class="error">Selecciona un grupo.</span>';
 const cs=selectedCriteria(),reason=$('#reason').value.trim();
 if(points!==null&&!reason)return $('#captureStatus').innerHTML='<span class="error">Escribe el motivo de los puntos.</span>';
 if(points===null&&!cs.length)return $('#captureStatus').innerHTML='<span class="error">Selecciona puntos o al menos un reconocimiento.</span>';
 $('#confirmSummary').innerHTML=`<p><b>Docente:</b> ${escapeHtml(staff?.display_name||('ID '+staff?.staff_code))}</p><p><b>Grupo:</b> ${group}</p><p><b>Puntos:</b> ${points===null?'Sin puntos':points>0?'+'+points:points}</p>${points!==null?`<p><b>Motivo:</b> ${escapeHtml(reason)}</p>`:''}<p><b>Reconocimientos:</b> ${cs.length?cs.map(x=>criteriaNames[x]).join(', '):'Ninguno'}</p><p class="muted">${navigator.onLine?'Se guardará en línea.':'Sin internet: quedará pendiente y se sincronizará automáticamente.'}</p>`;
 $('#confirmDialog').showModal();
};
$('#cancelConfirm').onclick=()=>$('#confirmDialog').close();

function resetCapture(){
 points=null;
 $$('#pointButtons button').forEach(x=>x.classList.toggle('active',x.dataset.points===''));
 $('#reason').value='';$('#reasonWrap').classList.add('hidden');
 $$('#criteria input').forEach(x=>x.checked=false);
}
function showSaved(item,offline){
 $('#confirmDialog').close();
 $('#captureStatus').innerHTML=offline
  ?'<span class="success">✓ Guardado en este dispositivo. Se enviará automáticamente al recuperar internet.</span>'
  :'<span class="success">✓ Registro guardado correctamente.</span>';
 const txt=`Grupo ${item.group} · ${item.points===null?'sin puntos':item.points>0?'+'+item.points:item.points}${item.criteria.length?' · '+item.criteria.map(x=>criteriaNames[x]).join(', '):''}${offline?' · Pendiente de sincronizar':''}`;
 $('#lastRecordText').textContent=txt;$('#lastRecord').classList.remove('hidden');resetCapture();updateOfflineUI();
}

$('#sendConfirm').onclick=async()=>{
 const btn=$('#sendConfirm');btn.disabled=true;
 const item={
  eventId:eventId(),
  capturedAt:new Date().toISOString(),
  group,
  points,
  reason:points===null?null:$('#reason').value.trim(),
  criteria:selectedCriteria()
 };
 try{
  if(!navigator.onLine){
   queueMovement(item);showSaved(item,true);return;
  }
  try{
   const d=await rpc('merit_register_movement',{
    p_token:token,p_group_code:item.group,p_points:item.points,p_reason:item.reason,p_criteria:item.criteria,
    p_client_event_id:item.eventId,p_captured_at:item.capturedAt
   });
   if(!d?.ok){
    if(d.reason==='pin_change_required')openPinDialog(!!staff?.is_placeholder);
    throw new Error(friendlyReason(d));
   }
   showSaved(item,false);
  }catch(e){
   if(!navigator.onLine||/conexión|internet|tardó|Failed to fetch|Network/i.test(e.message||'')){
    queueMovement(item);showSaved(item,true);
   }else throw e;
  }
 }catch(e){
  $('#confirmDialog').close();
  $('#captureStatus').innerHTML=`<span class="error">${e.message||e}</span>`;
 }finally{btn.disabled=false}
};

$('#saveNewPin').onclick=async()=>{
 const needsProfile=$('#pinDialog').dataset.needsProfile==='1';
 const firstName=$('#profileFirstName').value.trim(),firstSurname=$('#profileFirstSurname').value.trim(),subject=$('#profileSubject').value.trim();
 const current=$('#currentPin').value.trim(),next=$('#newPin').value.trim(),confirmPin=$('#newPinConfirm').value.trim(),st=$('#pinChangeStatus');
 st.textContent='';
 if(!navigator.onLine)return st.innerHTML='<span class="error">Necesitas internet para cambiar el NIP de forma segura.</span>';
 if(needsProfile&&!firstName)return st.innerHTML='<span class="error">Escribe tu nombre.</span>';
 if(needsProfile&&!firstSurname)return st.innerHTML='<span class="error">Escribe tu primer apellido.</span>';
 if(needsProfile&&!subject)return st.innerHTML='<span class="error">Escribe tu asignatura.</span>';
 if(!/^\d{4}$/.test(current))return st.innerHTML='<span class="error">Escribe tu NIP temporal de 4 dígitos.</span>';
 if(!/^\d{4}$/.test(next))return st.innerHTML='<span class="error">El nuevo NIP debe tener 4 dígitos.</span>';
 if(next!==confirmPin)return st.innerHTML='<span class="error">Los nuevos NIP no coinciden.</span>';
 try{
  const d=needsProfile
   ?await rpc('merit_complete_profile_and_change_pin',{p_token:token,p_current_pin:current,p_new_pin:next,p_first_name:firstName,p_first_surname:firstSurname,p_subject_area:subject})
   :await rpc('merit_change_pin',{p_token:token,p_current_pin:current,p_new_pin:next});
  if(!d?.ok){
   const msgs={invalid_current_pin:'El NIP temporal no es correcto.',same_pin:'El nuevo NIP debe ser diferente al temporal.',invalid_new_pin:'El nuevo NIP debe tener 4 dígitos.'};
   throw new Error(msgs[d?.reason]||'No se pudo cambiar el NIP.');
  }
  if(needsProfile){
   staff.display_name=d.display_name||staff.display_name;staff.subject_area=d.subject_area||staff.subject_area;staff.is_placeholder=false;
  }
  cacheSession(false);showCapture();
  st.innerHTML='<span class="success">✓ NIP actualizado correctamente.</span>';
  setTimeout(()=>$('#pinDialog').close(),650);
 }catch(e){st.innerHTML=`<span class="error">${e.message||e}</span>`}
};

async function checkSystemReady(){
 const title=$('#systemReadyTitle'),detail=$('#systemReadyDetail'),btn=$('#systemReadyRefresh');
 if(!title||!detail)return;
 if(!navigator.onLine){
  title.textContent='Modo sin internet';
  detail.textContent='Puedes capturar; se sincronizará al volver la señal';
  if(btn)btn.disabled=true;return;
 }
 if(btn)btn.disabled=true;title.textContent='Comprobando…';detail.textContent='Conectando';
 try{
  const d=await rpc('merit_current_period_status',{});
  if(d?.active){title.textContent='✓ Sistema listo para registrar';detail.textContent=d.label||'Periodo activo'}
  else{title.textContent='Periodo sin iniciar';detail.textContent='Hoy no se aceptan registros en línea'}
 }catch(e){title.textContent='No se pudo comprobar';detail.textContent=e.message||String(e)}
 finally{if(btn)btn.disabled=false}
}
$('#systemReadyRefresh')?.addEventListener('click',checkSystemReady);
$('#offlineRetry')?.addEventListener('click',syncPending);

window.addEventListener('online',()=>{updateOfflineUI();checkDevice();syncPending()});
window.addEventListener('offline',()=>{updateOfflineUI();checkSystemReady()});
setInterval(()=>{if(navigator.onLine&&getQueue().length)syncPending()},30000);

function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c])}
if('serviceWorker'in navigator)navigator.serviceWorker.register('service-worker.js?v=16').catch(()=>{});
updateOfflineUI();
checkDevice();
