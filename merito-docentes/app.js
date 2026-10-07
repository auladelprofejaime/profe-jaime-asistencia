function enforceCombinedRankingLayout(){
 const main=document.querySelector('#teacherRankingCard'),old=document.querySelector('#teacherCategoryLeadersCard');
 if(!main)return;
 main.classList.add('merit-ranking-combined');
 if(old){
  old.classList.remove('card');
  old.classList.add('merit-category-section');
  let divider=old.querySelector('.category-divider');if(!divider){divider=document.createElement('div');divider.className='category-divider';old.prepend(divider)}
  main.appendChild(old);
 }
 if(!document.querySelector('#meritRankingCombinedStyle')){
  const s=document.createElement('style');s.id='meritRankingCombinedStyle';s.textContent='.merit-ranking-combined{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(0,.92fr);align-items:stretch;overflow:hidden;border:2px solid #d4aa32!important}.merit-ranking-combined>div.section:first-child,.merit-ranking-combined>p.badge,.merit-ranking-combined>#teacherRankingTable,.merit-ranking-combined>#teacherRankingStatus{margin-left:22px;margin-right:22px}.merit-ranking-combined{background:linear-gradient(180deg,#fff8d8 0,#fffdf7 54%,#fff 100%)}.merit-ranking-combined>div.section:first-child{margin-top:22px;padding:18px;border-radius:18px;background:linear-gradient(135deg,#0b2b54,#174d82);color:#fff}.merit-ranking-combined>div.section:first-child h2,.merit-ranking-combined>div.section:first-child .muted{color:#fff}.merit-ranking-combined>div.section:first-child .secondary{background:#f4d36d;color:#102a4d;border-color:#d9ae32}.merit-category-section{margin:0!important;padding:22px!important;border:0!important;border-left:3px solid #d4aa32!important;border-radius:0!important;box-shadow:none!important;background:#fffdf7}.merit-main-award #teacherRankingTable,.merit-main-award #teacherRankingTable *{color:#122a4a!important}.merit-category-section h2{font-size:1.25rem}.category-divider{height:3px;background:linear-gradient(90deg,#d4a923,#f3dc8b,#d4a923);border-radius:3px;margin-bottom:16px}';document.head.appendChild(s);
 }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enforceCombinedRankingLayout);else enforceCombinedRankingLayout();
setTimeout(enforceCombinedRankingLayout,300);

const MERIT_APP_VERSION='67';
(async()=>{try{const r=await fetch('version.json?ts='+Date.now(),{cache:'no-store'});if(!r.ok)return;const v=await r.json();const remote=String(v.version||'');const seen=sessionStorage.getItem('meritAppVersionSeen')||'';if(remote&&remote!==MERIT_APP_VERSION&&seen!==remote){sessionStorage.setItem('meritAppVersionSeen',remote);location.reload()}}catch(_){}})();

const SUPABASE_URL="https://xqeyyjakmeiaahecfdmc.supabase.co";
const SUPABASE_KEY="sb_publishable_GY2NGAigumnZw3rIJKU7LA_a2qigAEA";
const TOKEN_KEY='meritInstallationTokenV1';
const STAFF_CACHE_KEY='meritStaffCacheV16';
const SETUP_CACHE_KEY='meritMustChangePinV16';
const QUEUE_KEY='meritOfflineQueueV16';
const NOTIFICATION_SKIP_KEY='meritNotificationsSkippedV1';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const rememberedToken=localStorage.getItem(TOKEN_KEY)||'';
const sessionToken=sessionStorage.getItem(TOKEN_KEY)||'';
let token=rememberedToken||sessionToken||'';
let rememberSession=!!rememberedToken;
let staff=null,accessState=null,grade=null,group=null,points=null,syncing=false;
function needsProfileSetup(){return !!(staff?.is_placeholder && staff?.confirmed===true && accessState?.formal_activation_pending!==true)}

function sessionStore(){return rememberSession?localStorage:sessionStorage}
function saveSessionToken(v){
  localStorage.removeItem(TOKEN_KEY);sessionStorage.removeItem(TOKEN_KEY);
  sessionStore().setItem(TOKEN_KEY,v);
}
function clearSessionToken(){
  localStorage.removeItem(TOKEN_KEY);sessionStorage.removeItem(TOKEN_KEY);
}

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
 const store=sessionStore();
 localStorage.removeItem(STAFF_CACHE_KEY);sessionStorage.removeItem(STAFF_CACHE_KEY);
 localStorage.removeItem(SETUP_CACHE_KEY);sessionStorage.removeItem(SETUP_CACHE_KEY);
 if(staff)store.setItem(STAFF_CACHE_KEY,JSON.stringify(staff));
 store.setItem(SETUP_CACHE_KEY,mustChange?'1':'0');
}
function readCachedStaff(){try{return JSON.parse(localStorage.getItem(STAFF_CACHE_KEY)||sessionStorage.getItem(STAFF_CACHE_KEY)||'null')}catch{return null}}
function cachedMustChange(){return (localStorage.getItem(SETUP_CACHE_KEY)||sessionStorage.getItem(SETUP_CACHE_KEY))==='1'}
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
  trial_not_open:'Este acceso de prueba solo está habilitado durante el Consejo Técnico del 25 de septiembre.',
  pin_change_required:'Antes de continuar, cambia tu NIP.',
  period_not_authorized:'No estás marcado como participante en este periodo.',
  period_capture_closed:'El periodo ya cerró para nuevas capturas. Los registros nuevos corresponden al siguiente periodo.',
  school_recess:'Mérito está en pausa por receso escolar. La captura se reanuda al regresar a clases.',
  not_confirmed:'Tu participación todavía no ha sido confirmada para un periodo oficial.',
  trial_not_started:'El acceso del Comité inicia el lunes 21 de septiembre a las 6:00 a. m.',
  trial_day_only:'Los folios de prueba no confirmados solo pueden registrar durante el Consejo Técnico del 25 de septiembre.',
  invalid_capture_time:'El registro pendiente es demasiado antiguo para sincronizarse automáticamente.',
  duplicate_event_conflict:'No fue posible validar el identificador del registro.',
  benefit_required:'Antes de registrar puntos o reconocimientos, debes registrar tu beneficio del mes.'
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
   const invite=['trial_expired','not_confirmed','unauthorized'].includes(d?.reason);
   clearSessionToken();token='';
   localStorage.removeItem(STAFF_CACHE_KEY);sessionStorage.removeItem(STAFF_CACHE_KEY);
   localStorage.removeItem(SETUP_CACHE_KEY);sessionStorage.removeItem(SETUP_CACHE_KEY);
   return showActivation(invite);
  }
  staff=d.staff;accessState=d.access||null;cacheSession(!!d.must_change_pin);
  if(needsProfileSetup()){
    $('#activation').classList.add('hidden');
    $('#capture').classList.add('hidden');
    openPinDialog(true);
    window.__meritStartupComplete=true;
    return;
  }
  showCapture();
  if(d.must_change_pin && !(staff?.is_placeholder&&!staff?.confirmed))setTimeout(()=>openPinDialog(false),80);
  syncPending();
 }catch(e){
  staff=readCachedStaff();
  if(staff){showCapture();updateOfflineUI()}
  else showActivation();
 }
}

function mustCompleteFormalSetup(){return !!(needsProfileSetup() || (cachedMustChange() && !(staff?.is_placeholder && !staff?.confirmed)))}
function showActivation(invite=false){
 window.__meritStartupComplete=true;document.getElementById('meritBootRecovery')?.remove();
 $('#activation').classList.remove('hidden');$('#capture').classList.add('hidden');updateOfflineUI();
 const st=$('#activationStatus');
 if(invite&&st)st.innerHTML='<div style="margin-top:14px;padding:18px;border:2px solid #c9962d;border-radius:18px;background:linear-gradient(135deg,#fff7d8,#fffdf5);color:#071a36;text-align:center;box-shadow:0 8px 22px rgba(7,26,54,.12)"><div style="font-size:2.2rem">🏆✨</div><div style="font-size:1.12rem;font-weight:900;margin:5px 0">¿Quieres participar en Mérito Gabino A. Palma?</div><div style="line-height:1.45">¡Nos dará mucho gusto contar contigo! Acércate o escríbele al <b>Profr. Jaime</b> para que te dé acceso.</div></div>';
}
function showCapture(){
 window.__meritStartupComplete=true;document.getElementById('meritBootRecovery')?.remove();
 $('#activation').classList.add('hidden');$('#capture').classList.remove('hidden');
 const pending=$('#accessPendingCard'),workspace=$('#captureWorkspace');
 const mode=accessState?.mode||((staff?.is_placeholder&&!staff?.confirmed)?'pending_confirmation':'official');
 const canCapture=accessState?.can_capture!==false;
 if(!canCapture && mode==='annual_close'){
   pending?.classList.add('hidden');workspace?.classList.remove('hidden');
   $('#staffName').textContent=staff?.display_name||('ID '+(staff?.staff_code||''));
   $('#staffRole').textContent='Cierre anual · solo votación';
   [...workspace.children].forEach((el,idx)=>{
     const keep=idx<3 || el.id==='tieVoteCard';
     if(!keep)el.classList.add('hidden');
   });
   refreshTieVotes();updateOfflineUI();
 }else if(!canCapture){
   pending?.classList.remove('hidden');workspace?.classList.add('hidden');
   if(mode==='school_recess'){
     $('#accessPendingTitle').textContent='Receso escolar';
     $('#accessPendingText').textContent=accessState?.message||'Mérito está en pausa por receso escolar.';
   }else{
     $('#accessPendingTitle').textContent=mode==='not_participating'?'No tienes acceso a este periodo':'Tu participación está pendiente';
     const period=accessState?.period_label?(' para '+accessState.period_label):'';
     $('#accessPendingText').innerHTML=
       'Tu ID <b>'+escapeHtml(staff?.staff_code||'')+'</b> sigue vigente, pero todavía no tienes autorización'+escapeHtml(period)+
       '. Acércate con el <b>Profr. Jaime</b> para confirmar tu participación.';
   }
 }else{
   pending?.classList.add('hidden');workspace?.classList.remove('hidden');
   $('#staffName').textContent=staff?.display_name||('ID '+(staff?.staff_code||''));
   $('#staffRole').textContent=mode==='trial'?'Acceso de prueba · Consejo Técnico':(staff?.subject_area||roleLabel(staff?.role_type));
   checkSystemReady();updateOfflineUI();refreshTieVotes();loadMonthlyBenefit().finally(()=>maybeShowWelcome());loadTeacherRanking();setTimeout(ensureNotificationGate,120);
 }
}



async function loadTeacherCategoryLeaders(){
 const box=$('#teacherCategoryLeaders');if(!box||!token)return;
 if(!navigator.onLine){box.innerHTML='<p class="muted">Conéctate a internet para consultar los líderes actuales.</p>';return}
 try{
  const d=await rpc('merit_teacher_category_leaders',{p_token:token});
  if(!d?.ok)throw new Error(friendlyReason(d));
  const rows=Array.isArray(d.leaders)?d.leaders:[];
  box.innerHTML=rows.length?'<table><thead><tr><th>Categoría</th><th>1.er lugar</th><th>Puntos</th></tr></thead><tbody>'+rows.map(r=>'<tr><td><b>'+escapeHtml(r.label)+'</b></td><td><b>'+escapeHtml((r.groups||[]).map(g=>'Grupo '+g).join(' · '))+'</b>'+(r.groups?.length>1?'<div class="category-tie-badge">EMPATE EN 1.er LUGAR</div>':'')+'</td><td>'+escapeHtml(r.score)+'</td></tr>').join('')+'</tbody></table>':'<p class="muted">Todavía no hay datos por categoría.</p>';
 }catch(e){box.innerHTML='<p class="error">No se pudieron cargar los líderes por categoría: '+escapeHtml(e.message||e)+'</p>'}
}

async function loadTeacherRanking(){
 const box=$('#teacherRankingTable'),label=$('#teacherRankingPeriod'),st=$('#teacherRankingStatus');
 if(!box||!token)return;
 if(!navigator.onLine){box.innerHTML='<p class="muted">Conéctate a internet para consultar el ranking actual.</p>';return}
 try{
  if(st)st.textContent='Actualizando…';
  const d=await rpc('merit_live_ranking');
  if(!d?.ok)throw new Error(friendlyReason(d));
  if(label)label.textContent=d.period?.label||'Sin periodo abierto';
  if(d.state==='results_in_process'){box.innerHTML='<div class="card" style="text-align:center"><h3>🔒 Se están contando los puntos</h3><p class="muted">El ranking está temporalmente bloqueado mientras se revisan los movimientos y se determina el resultado.</p></div>';const catBox=$('#teacherCategoryLeaders');if(catBox)catBox.innerHTML='';if(st)st.textContent='El ranking volverá a mostrarse cuando finalice el cierre.';return}
  if(d.state==='official'&&d.official_result){box.innerHTML='<div class="card" style="text-align:center"><h3>🏆 Ganador oficial</h3><h2>Grupo '+escapeHtml(String(d.official_result.overall_winner||'—'))+'</h2><p><b>'+escapeHtml(String(d.official_result.overall_score||0))+' puntos</b></p></div>';if(st)st.textContent='Resultado oficial del periodo.';return}
  const rows=Array.isArray(d.ranking)?d.ranking:[];
  box.innerHTML='<p class="muted"><b>Mérito Gabino A. Palma</b> · Solo el 1.er lugar gana el Mérito y recibe los beneficios registrados por los docentes.</p>'+(rows.length?'<table><thead><tr><th>Lugar</th><th>Grupo</th><th>Puntos</th></tr></thead><tbody>'+rows.map(r=>'<tr><td><b>'+escapeHtml(String(r.rank))+(Number(r.rank)===1?' 🏆':'')+'</b></td><td><b>Grupo '+escapeHtml(String(r.group_code))+'</b></td><td>'+escapeHtml(String(r.score))+'</td></tr>').join('')+'</tbody></table>':'<p class="muted">Todavía no hay clasificación disponible.</p>');
  const catBox=$('#teacherCategoryLeaders'),cats=Array.isArray(d.category_leaders)?d.category_leaders:[];
  if(catBox){
   const grouped=[];
   cats.forEach(r=>{
    const key=String(r.criterion_code||r.category||'');
    let row=grouped.find(x=>x.key===key);
    if(!row){row={key,label:String(r.category||''),score:r.score,groups:[]};grouped.push(row)}
    const g=String(r.group_code||'');
    if(g&&!row.groups.includes(g))row.groups.push(g);
   });
   catBox.innerHTML=grouped.length?'<div class="category-list">'+grouped.map(r=>'<div class="category-row"><div class="category-name">'+escapeHtml(r.label)+'</div><div class="category-row-bottom"><div class="category-winner"><b>'+escapeHtml(r.groups.map(g=>'Grupo '+g).join(r.groups.length>1?' + ':' · '))+'</b>'+(r.groups.length>1?'<span class="category-tie-badge">EMPATE EN 1.er LUGAR</span>':'')+'</div><div class="category-score">'+escapeHtml(String(r.score??''))+'<small>reconocimientos</small></div></div></div>').join('')+'</div>':'<p class="muted">Todavía no hay líderes por categoría.</p>'
  }
  if(st)st.textContent='Solo consulta · 1.º, 2.º y 3.º lugar general.';
 }catch(e){if(st)st.innerHTML='<span class="error">No se pudo cargar el ranking: '+escapeHtml(e.message||e)+'</span>'}
}


let meritBenefitData=null,benefitGateActive=false;
function benefitExemptClient(){
 const role=String(staff?.role_type||'').toLowerCase();
 const area=String(staff?.subject_area||'').toLowerCase();
 return ['direccion','subdireccion','prefectura'].includes(role)||/(prefect|direc|subdirec|udeei|udei|udi|orient|trabajo social|servicio social)/.test(area);
}
function setBenefitGate(active){
 benefitGateActive=!!active;
 // Keep Review usable: a gated teacher must see why capture is blocked.
 const btn=$('#reviewBtn');if(btn)btn.disabled=reviewBusy;
 const cancel=$('#benefitCancelBtn');if(cancel)cancel.classList.toggle('hidden',benefitGateActive);
}
async function loadMonthlyBenefit(){
 if(!token||!navigator.onLine||!staff?.confirmed||staff?.is_placeholder)return;
 try{
  const d=await rpc('merit_my_benefit',{p_token:token});
  if(!d?.ok||!d.period)return;
  meritBenefitData=d;
  const card=$('#benefitCard'),saved=$('#benefitSavedText'),btn=$('#benefitOpenBtn');
  if(d.benefit_required===false){setBenefitGate(false);card?.classList.add('hidden');return;}
  card?.classList.remove('hidden');
  $('#benefitCardText').textContent='Escribe QUÉ BENEFICIO LE VAS A DAR AL GRUPO QUE GANE durante '+d.period.label+'. Debe ser el premio o apoyo que tú otorgarás en tu asignatura.';
  if(d.benefit&&d.review_status==='accepted'){setBenefitGate(false);saved.textContent='✓ Beneficio aceptado: '+d.benefit;btn.textContent='EDITAR MI BENEFICIO';}
  else if(d.benefit&&d.review_status==='pending'){setBenefitGate(true);saved.textContent='⏳ Beneficio enviado y pendiente de revisión: '+d.benefit;btn.textContent='EDITAR PROPUESTA';}
  else if(d.benefit&&d.review_status==='rejected'){setBenefitGate(true);saved.textContent='⚠ Tu propuesta debe explicar QUÉ LE VAS A DAR AL GRUPO QUE GANE. Motivo de revisión: '+(d.review_reason||'Debes registrar otra propuesta.');btn.textContent='REGISTRAR OTRO BENEFICIO';setTimeout(()=>{if(!$('#benefitDialog')?.open)openBenefitDialog()},250);}
  else{setBenefitGate(true);saved.textContent='⚠ Para continuar, escribe QUÉ BENEFICIO LE VAS A DAR AL GRUPO QUE GANE en tu asignatura.';btn.textContent='REGISTRAR MI BENEFICIO';setTimeout(()=>{if(!$('#benefitDialog')?.open)openBenefitDialog()},250);}
 }catch(_){}
}
async function maybeShowWelcome(){
 if(!token||!navigator.onLine||!staff?.confirmed||staff?.is_placeholder)return;
 try{
  const b=meritBenefitData;if(b?.benefit_required!==false&&b?.benefit_complete!==true)return;
  const d=await rpc('merit_my_welcome',{p_token:token});
  if(d?.ok&&d.eligible&&!d.acknowledged&&!document.querySelector('dialog[open]'))$('#welcomeDialog')?.showModal();
 }catch(_){}
}
$('#welcomeDialog')?.addEventListener('cancel',e=>e.preventDefault());
$('#welcomeStartBtn')?.addEventListener('click',async()=>{
 const btn=$('#welcomeStartBtn'),st=$('#welcomeStatus');btn.disabled=true;st.textContent='Guardando…';
 try{const d=await rpc('merit_ack_welcome',{p_token:token});if(!d?.ok)throw new Error(friendlyReason(d));$('#welcomeDialog').close();st.textContent='';}
 catch(e){st.innerHTML='<span class="error">'+escapeHtml(e.message||e)+'</span>';btn.disabled=false}
});
function openBenefitDialog(){
 if(!meritBenefitData?.period)return;
 $('#benefitDialogTitle').textContent='🎁 ¿QUÉ LE VAS A DAR AL GRUPO QUE GANE? · '+meritBenefitData.period.label;
 $('#benefitInput').value=meritBenefitData.benefit||'';
 $('#benefitStatus').textContent='';
 $('#benefitDialog').showModal();
}
$('#benefitOpenBtn')?.addEventListener('click',openBenefitDialog);
$('#benefitCancelBtn')?.addEventListener('click',()=>{if(!benefitGateActive)$('#benefitDialog').close()});
$('#benefitDialog')?.addEventListener('cancel',e=>{if(benefitGateActive)e.preventDefault()});
$('#benefitSaveBtn')?.addEventListener('click',async()=>{
 const st=$('#benefitStatus'),btn=$('#benefitSaveBtn'),benefit=$('#benefitInput').value.trim();
 if(benefit.length<3){st.innerHTML='<span class="error">Escribe qué beneficio le vas a dar al grupo que gane.</span>';return}
 btn.disabled=true;st.textContent='Guardando…';
 try{
  const d=await rpc('merit_save_my_benefit',{p_token:token,p_benefit:benefit});
  if(!d?.ok)throw new Error(d?.reason||'No se pudo guardar.');
  meritBenefitData.benefit=d.benefit;
  setBenefitGate(false);
  $('#benefitSavedText').textContent='✓ Registrado: '+d.benefit;
  $('#benefitOpenBtn').textContent='EDITAR MI BENEFICIO';
  st.innerHTML='<span class="success">✓ Beneficio guardado. El Profr. Jaime ya puede verlo en Administración.</span>';
  setTimeout(()=>$('#benefitDialog').close(),900);
 }catch(e){st.innerHTML='<span class="error">'+escapeHtml(e.message||e)+'</span>'}
 finally{btn.disabled=false}
});

function tieVoteLabel(issue){
 const labels={cleanliness:'Limpieza',uniform:'Uniforme',punctuality:'Puntualidad',coexistence:'Convivencia',responsibility:'Responsabilidad',attitude:'Actitud',institutional_participation:'Participación institucional'};
 if(issue.issue_key==='annual')return 'Campeón anual';
 return issue.issue_type==='overall'?'Mérito del Mes':(labels[issue.criterion_code]||'Reconocimiento');
}
async function castTieVote(issueId,groupCode){
 const st=$('#tieVoteStatus');
 if(!navigator.onLine){if(st)st.innerHTML='<span class="error">Necesitas internet para votar.</span>';return}
 if(!confirm('¿Confirmas tu voto por el grupo '+groupCode+'?\n\nTu voto quedará registrado y no podrá cambiarse.'))return;
 try{
  if(st)st.textContent='Registrando voto…';
  const d=await rpc('merit_cast_tie_vote',{p_token:token,p_issue_id:issueId,p_group_code:groupCode});
  if(!d?.ok){
   const msgs={already_voted:'Tu voto para este desempate ya fue registrado.',vote_not_open:'Esta votación ya fue cerrada.',not_eligible:'Tu acceso no está incluido en esta votación.',invalid_candidate:'Ese grupo no pertenece a este desempate.'};
   throw new Error(msgs[d?.reason]||d?.reason||'No se pudo registrar el voto.');
  }
  if(st)st.innerHTML='<span class="success">✓ Voto registrado correctamente.</span>';
  await refreshTieVotes();
 }catch(e){if(st)st.innerHTML='<span class="error">'+escapeHtml(e.message||e)+'</span>'}
}
async function refreshTieVotes(){
 const card=$('#tieVoteCard'),box=$('#tieVoteContent'),st=$('#tieVoteStatus');
 if(!card||!box||!token)return;
 if(!navigator.onLine){
  if(!card.classList.contains('hidden')&&st)st.innerHTML='<span class="muted">Conéctate a internet para emitir tu voto.</span>';
  return;
 }
 try{
  const d=await rpc('merit_pending_tie_votes',{p_token:token});
  if(!d?.ok){card.classList.add('hidden');return}
  const sessions=Array.isArray(d.sessions)?d.sessions:[];
  const useful=sessions.filter(s=>Array.isArray(s.issues)&&s.issues.length);
  if(!useful.length){card.classList.add('hidden');box.innerHTML='';if(st)st.textContent='';return}
  card.classList.remove('hidden');
  box.innerHTML=useful.map(s=>'<div class="tie-vote-session"><b>'+escapeHtml(s.period_label||'Cierre mensual')+'</b>'+
    s.issues.map(issue=>'<div class="tie-vote-issue"><b>'+escapeHtml(tieVoteLabel(issue))+'</b>'+
      (issue.has_voted
       ?'<div class="tie-voted success">✓ Voto registrado: Grupo '+escapeHtml(issue.my_vote||'')+'</div>'
       :'<div class="tie-vote-options">'+(issue.candidates||[]).map(c=>'<button type="button" class="secondary tieVoteChoice" data-issue="'+escapeHtml(issue.issue_id)+'" data-group="'+escapeHtml(c.group_code)+'">Grupo '+escapeHtml(c.group_code)+'</button>').join('')+'</div>')+
    '</div>').join('')+'</div>').join('');
  $('.tieVoteChoice').forEach(b=>b.onclick=()=>castTieVote(b.dataset.issue,b.dataset.group));
  if(st)st.textContent='';
 }catch(e){
  if(st)st.innerHTML='<span class="error">No se pudo consultar la votación: '+escapeHtml(e.message||e)+'</span>';
 }
}


function urlBase64ToUint8Array(base64String){
 const padding='='.repeat((4-base64String.length%4)%4);
 const base64=(base64String+padding).replace(/-/g,'+').replace(/_/g,'/');
 const raw=atob(base64);return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));
}
async function meritVapidPublicKey(){
 const r=await fetch(SUPABASE_URL+'/functions/v1/merit-push',{method:'GET',headers:{apikey:SUPABASE_KEY},cache:'no-store'});
 if(!r.ok)throw new Error('No se pudo preparar el servicio de notificaciones.');
 const d=await r.json();if(!d?.public_key)throw new Error('No se encontró la llave pública de notificaciones.');
 return d.public_key;
}
async function registerMeritPushSubscription(){
 const reg=await navigator.serviceWorker.ready;
 let sub=await reg.pushManager.getSubscription();
 if(!sub){
   const key=await meritVapidPublicKey();
   sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(key)});
 }
 const j=sub.toJSON(),keys=j.keys||{};
 const d=await rpc('merit_register_push',{
   p_token:token,p_endpoint:sub.endpoint,p_p256dh:keys.p256dh||'',p_auth:keys.auth||'',p_user_agent:navigator.userAgent
 });
 if(!d?.ok)throw new Error(d?.reason||'No se pudo registrar este dispositivo para notificaciones.');
 return true;
}
async function ensureNotificationGate(){
 if(!token||!staff||staff.is_placeholder||cachedMustChange())return;
 if(document.querySelector('dialog[open]'))return;
 try{if(localStorage.getItem(NOTIFICATION_SKIP_KEY)==='1'||sessionStorage.getItem(NOTIFICATION_SKIP_KEY)==='1')return}catch(_){}
 const dlg=$('#notificationDialog'),st=$('#notificationStatus'),help=$('#notificationHelp');
 if(!dlg)return;
 if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window)){
   help.innerHTML='<b>Este navegador no permite notificaciones para esta app.</b><br>En iPhone/iPad, agrega Mérito Docentes a la pantalla de inicio y ábrela desde ahí.';
   if(!dlg.open)dlg.showModal();return;
 }
 try{
   const reg=await navigator.serviceWorker.ready;
   const sub=await reg.pushManager.getSubscription();
   if(Notification.permission==='granted'&&sub){
     await registerMeritPushSubscription();
     if(dlg.open)dlg.close();return;
   }
 }catch(_){}
 if(Notification.permission==='denied'){
   help.innerHTML='<b>Las notificaciones están bloqueadas.</b><br>Debes habilitarlas en la configuración del navegador/dispositivo para continuar.';
 }else{
   help.textContent='Al tocar “Activar notificaciones” el dispositivo te pedirá permiso.';
 }
 if(st)st.textContent='';
 if(!dlg.open)dlg.showModal();
}
async function enableMeritNotifications(){
 const st=$('#notificationStatus'),btn=$('#enableNotificationsBtn');
 if(btn)btn.disabled=true;if(st)st.textContent='Activando notificaciones…';
 try{
   if(!navigator.onLine)throw new Error('Necesitas internet para activar las notificaciones.');
   if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window))throw new Error('Este navegador no admite notificaciones. En iPhone/iPad instala la app en la pantalla de inicio.');
   const permission=await Notification.requestPermission();
   if(permission!=='granted')throw new Error('Debes permitir las notificaciones para continuar.');
   await registerMeritPushSubscription();
   if(st)st.innerHTML='<span class="success">✓ Notificaciones activadas correctamente.</span>';
   setTimeout(()=>{$('#notificationDialog')?.close()},500);
 }catch(e){if(st)st.innerHTML='<span class="error">'+escapeHtml(e.message||e)+'</span>'}
 finally{if(btn)btn.disabled=false}
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
   if(d?.reason==='trial_expired'||d?.reason==='not_confirmed'){showActivation(true);return;}
   const msgs={invalid_credentials:'ID o NIP incorrectos.',trial_not_open:'Este acceso de prueba solo está habilitado durante el Consejo Técnico del 25 de septiembre.'};
   throw new Error(msgs[d?.reason]||'No se pudo ingresar.');
  }
  token=d.installation_token;staff=d.staff;accessState=d.access||null;
  // Cada inicio con ID/NIP sustituye por completo cualquier docente anterior.
  localStorage.removeItem(TOKEN_KEY);sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(STAFF_CACHE_KEY);sessionStorage.removeItem(STAFF_CACHE_KEY);
  localStorage.removeItem(SETUP_CACHE_KEY);sessionStorage.removeItem(SETUP_CACHE_KEY);
  // Un folio provisional NO se recuerda entre aperturas. Solo después de la
  // autorización formal del Profr. Jaime puede mantenerse la sesión.
  rememberSession=!!($('#rememberSession')?.checked!==false && staff?.confirmed===true && staff?.is_placeholder===false);
  saveSessionToken(token);cacheSession(!!d.must_change_pin);
  $('#staffCode').value='';$('#activationCode').value='';
  if(needsProfileSetup()){
    $('#activation').classList.add('hidden');
    $('#capture').classList.add('hidden');
    openPinDialog(true,pin);
    return;
  }
  showCapture();
  if(d.must_change_pin && !(staff?.is_placeholder&&!staff?.confirmed))setTimeout(()=>openPinDialog(false,pin),80);
  syncPending();
 }catch(e){st.innerHTML=`<span class="error">${e.message||e}</span>`}
};

$('#forgetDevice').onclick=()=>{
 if(confirm('¿Desvincular este dispositivo? Para volver a usarlo necesitarás tu ID y NIP vigentes.')){
  clearSessionToken();
  localStorage.removeItem(STAFF_CACHE_KEY);sessionStorage.removeItem(STAFF_CACHE_KEY);
  localStorage.removeItem(SETUP_CACHE_KEY);sessionStorage.removeItem(SETUP_CACHE_KEY);
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

let reviewBusy=false;
function captureNotice(message){
 const el=$('#captureStatus');el.textContent=message;el.setAttribute('role','status');el.setAttribute('aria-live','polite');
 el.scrollIntoView?.({block:'nearest'});
}
function benefitCaptureNotice(){
 const d=meritBenefitData;
 if(d?.review_status==='pending')return 'Tu beneficio está enviado y pendiente de aprobación del Profr. Jaime. Hasta que se apruebe, no puedes confirmar puntos. No necesitas enviarlo otra vez.';
 if(d?.review_status==='rejected')return 'Tu beneficio fue rechazado: '+(d.review_reason||'Debes indicar qué le darás al grupo ganador')+'. Corrígelo en REGISTRAR OTRO BENEFICIO.';
 return 'Primero escribe QUÉ BENEFICIO LE VAS A DAR AL GRUPO QUE GANE en REGISTRAR MI BENEFICIO para continuar.';
}
function openCaptureConfirmation(){
 const dlg=$('#confirmDialog');
 // Optional prompts must not cover the confirmation on small screens.
 for(const id of ['notificationDialog','welcomeDialog'])if($('#'+id)?.open)$('#'+id).close();
 try{if(typeof dlg.showModal==='function'){if(!dlg.open)dlg.showModal();return;}}catch(e){console.warn('Confirmación compatible:',e.message)}
 dlg.classList.add('merit-confirm-fallback');dlg.setAttribute('open','');
}
function closeCaptureConfirmation(){
 const dlg=$('#confirmDialog');if(typeof dlg.close==='function')dlg.close();else dlg.removeAttribute('open');dlg.classList.remove('merit-confirm-fallback');
}
$('#reviewBtn').onclick=async()=>{
 if(reviewBusy)return;
 const btn=$('#reviewBtn'),label=btn.textContent;
 reviewBusy=true;btn.disabled=true;btn.textContent='REVISANDO…';captureNotice('Revisando el registro…');
 try{
 if(benefitGateActive){
  captureNotice(benefitCaptureNotice());
  if(meritBenefitData?.review_status!=='pending'&&navigator.onLine&&!$('#benefitDialog')?.open)openBenefitDialog();
  return;
 }
 if(mustCompleteFormalSetup()){
  $('#captureStatus').innerHTML='<span class="error">Antes de continuar, completa el cambio de NIP.</span>';
  if(navigator.onLine)openPinDialog(!!staff?.is_placeholder);
  return;
 }
 if(navigator.onLine){
  try{
   const d=await rpc('merit_device_info',{p_token:token});
   if(!d?.ok){
    clearSessionToken();token='';showActivation();$('#activationStatus').textContent=friendlyReason(d);return;
   }
   staff=d.staff;accessState=d.access||null;cacheSession(!!d.must_change_pin);
   if(accessState?.can_capture===false){captureNotice(accessState.message||'Tu cuenta no tiene autorización para registrar en este periodo. Consulta al Profr. Jaime.');return;}
   if(needsProfileSetup() || (d.must_change_pin && !(staff?.is_placeholder&&!staff?.confirmed))){
    $('#captureStatus').innerHTML='<span class="error">Antes de continuar, completa tu registro y cambia tu NIP.</span>';
    openPinDialog(needsProfileSetup());return;
   }
  }catch(e){captureNotice('No se pudo revisar tu acceso: '+e.message+'. Vuelve a tocar REVISAR Y REGISTRAR.');return;}
 }
 if(!group)return $('#captureStatus').innerHTML='<span class="error">Selecciona un grupo.</span>';
 const cs=selectedCriteria(),reason=$('#reason').value.trim();
 if(points!==null&&!reason)return $('#captureStatus').innerHTML='<span class="error">Escribe el motivo de los puntos.</span>';
 if(points===null&&!cs.length)return $('#captureStatus').innerHTML='<span class="error">Selecciona puntos o al menos un reconocimiento.</span>';
 $('#confirmSummary').innerHTML=`<p><b>Docente:</b> ${escapeHtml(staff?.display_name||('ID '+staff?.staff_code))}</p><p><b>Grupo:</b> ${group}</p><p><b>Puntos:</b> ${points===null?'Sin puntos':points>0?'+'+points:points}</p>${points!==null?`<p><b>Motivo:</b> ${escapeHtml(reason)}</p>`:''}<p><b>Reconocimientos:</b> ${cs.length?cs.map(x=>criteriaNames[x]).join(', '):'Ninguno'}</p><p class="muted">${navigator.onLine?'Se guardará en línea.':'Sin internet: quedará pendiente y se sincronizará automáticamente.'}</p>`;
 captureNotice('Revisa el resumen y pulsa CONFIRMAR Y GUARDAR.');
 openCaptureConfirmation();
 }catch(e){captureNotice('No se pudo abrir la confirmación: '+(e.message||e)+'. Vuelve a intentar.');}
 finally{reviewBusy=false;btn.disabled=false;btn.textContent=label;}
};
$('#cancelConfirm').onclick=closeCaptureConfirmation;

function resetCapture(){
 points=null;
 $$('#pointButtons button').forEach(x=>x.classList.toggle('active',x.dataset.points===''));
 $('#reason').value='';$('#reasonWrap').classList.add('hidden');
 $$('#criteria input').forEach(x=>x.checked=false);
}
function showSaved(item,offline){
 closeCaptureConfirmation();
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
  closeCaptureConfirmation();
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
  cacheSession(false);
  st.innerHTML='<span class="success">✓ Datos guardados correctamente.</span>';
  setTimeout(()=>{
    $('#pinDialog').close();
    showCapture();
    setTimeout(ensureNotificationGate,120);
    syncPending();
  },450);
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
$('#notificationLaterBtn')?.addEventListener('click',()=>{
 try{localStorage.setItem(NOTIFICATION_SKIP_KEY,'1')}catch(_){try{sessionStorage.setItem(NOTIFICATION_SKIP_KEY,'1')}catch(__){}}
 $('#notificationDialog')?.close();
});
$('#systemReadyRefresh')?.addEventListener('click',checkSystemReady);
$('#offlineRetry')?.addEventListener('click',syncPending);

window.addEventListener('online',()=>{updateOfflineUI();checkDevice();syncPending();refreshTieVotes()});
window.addEventListener('offline',()=>{updateOfflineUI();checkSystemReady()});
setInterval(()=>{if(navigator.onLine&&getQueue().length)syncPending();if(navigator.onLine&&token){checkDevice();refreshTieVotes()}},30000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&navigator.onLine&&token){checkDevice();refreshTieVotes()}});

function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c])}

let movementReviewSelected='';
function formatMeritMovementTime(v){
 try{return new Date(v).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})}catch(_){return ''}
}
async function loadTodayMovementsForReview(){
 const box=$('#movementReviewList'),st=$('#movementReviewStatus');
 movementReviewSelected='';
 if(box)box.innerHTML='<p class="muted">Cargando movimientos de hoy…</p>';
 if(st)st.textContent='';
 if(!navigator.onLine){if(st)st.innerHTML='<span class="error">Necesitas internet para enviar una aclaración.</span>';return}
 try{
  const d=await rpc('merit_my_today_movements',{p_token:token});
  if(!d?.ok)throw new Error(d?.reason||'No se pudieron consultar tus movimientos.');
  const rows=Array.isArray(d.movements)?d.movements:[];
  if(!rows.length){box.innerHTML='<p class="muted">No tienes movimientos válidos registrados hoy.</p>';return}
  box.innerHTML=rows.map(m=>{
   const pts=m.points===null||m.points===undefined?'Sin puntos':(Number(m.points)>0?'+'+m.points:String(m.points));
   const crit=(Array.isArray(m.criteria)?m.criteria:[]).map(x=>criteriaNames[x]||x).join(', ');
   const disabled=m.review_pending?'disabled':'';
   return '<label class="criterion" style="display:block;margin:8px 0;padding:10px"><input class="movementReviewChoice" type="radio" name="movementReview" value="'+escapeHtml(m.id)+'" '+disabled+'> <b>Grupo '+escapeHtml(m.group_code)+'</b> · '+escapeHtml(pts)+' · '+escapeHtml(formatMeritMovementTime(m.captured_at||m.created_at))+
    (m.reason?'<br><span class="muted">'+escapeHtml(m.reason)+'</span>':'')+
    (crit?'<br><span class="muted">Reconocimientos: '+escapeHtml(crit)+'</span>':'')+
    (m.review_pending?'<br><span class="success">✓ Ya enviaste una solicitud para este movimiento.</span>':'')+'</label>';
  }).join('');
  $('.movementReviewChoice').forEach(x=>x.onchange=()=>{movementReviewSelected=x.value});
 }catch(e){if(box)box.innerHTML='';if(st)st.innerHTML='<span class="error">'+escapeHtml(e.message||e)+'</span>'}
}
async function notifyAdminReviewRequest(requestId){
 const r=await fetch(SUPABASE_URL+'/functions/v1/merit-push',{
  method:'POST',
  headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json'},
  body:JSON.stringify({event:'merit_correction_request',token,request_id:requestId})
 });
 if(!r.ok)throw new Error('No se pudo confirmar la notificación al administrador.');
 return await r.json();
}
$('#reportMovementErrorBtn')?.addEventListener('click',async()=>{
 if(!navigator.onLine){$('#movementReviewQuickStatus').innerHTML='<span class="error">Necesitas internet para reportar un error.</span>';return}
 $('#movementReviewNote').value='';$('#movementReviewStatus').textContent='';
 $('#movementReviewDialog').showModal();await loadTodayMovementsForReview();
});
$('#movementReviewCancel')?.addEventListener('click',()=>$('#movementReviewDialog').close());
$('#movementReviewSend')?.addEventListener('click',async()=>{
 const st=$('#movementReviewStatus'),btn=$('#movementReviewSend'),note=$('#movementReviewNote').value.trim();
 if(!movementReviewSelected){st.innerHTML='<span class="error">Selecciona el movimiento que quieres reportar.</span>';return}
 if(note.length<3){st.innerHTML='<span class="error">Explica brevemente qué ocurrió.</span>';return}
 if(!confirm('¿Enviar esta solicitud al Comité?\n\nRecuerda: solo estás solicitando revisión. Los puntos no cambiarán hasta que el administrador la revise.'))return;
 btn.disabled=true;st.textContent='Enviando solicitud…';
 try{
  const d=await rpc('merit_request_movement_review',{p_token:token,p_movement_id:movementReviewSelected,p_note:note});
  if(!d?.ok){
   const msgs={same_day_only:'Solo puedes solicitar revisión el mismo día del movimiento.',already_requested:'Ya existe una solicitud pendiente para ese movimiento.',note_required:'Explica brevemente qué ocurrió.',movement_not_valid:'Ese movimiento ya no está vigente.'};
   throw new Error(msgs[d?.reason]||d?.reason||'No se pudo enviar la solicitud.');
  }
  let notified=true;try{await notifyAdminReviewRequest(d.request_id)}catch(_){notified=false}
  st.innerHTML='<span class="success">✓ Solicitud enviada al Comité.'+(notified?' Se notificó al administrador.':' Quedó registrada aunque no se pudo confirmar la notificación push.')+'</span>';
  $('#movementReviewQuickStatus').innerHTML='<span class="success">✓ Aclaración enviada para revisión.</span>';
  await loadTodayMovementsForReview();
  setTimeout(()=>$('#movementReviewDialog')?.close(),900);
 }catch(e){st.innerHTML='<span class="error">'+escapeHtml(e.message||e)+'</span>'}
 finally{btn.disabled=false}
});

$('#enableNotificationsBtn')?.addEventListener('click',enableMeritNotifications);
if($('#rememberSession'))$('#rememberSession').checked=rememberSession||(!rememberedToken&&!sessionToken);
if('serviceWorker'in navigator)navigator.serviceWorker.register('service-worker.js?v=67').catch(()=>{});
updateOfflineUI();
checkDevice();

$('#teacherRankingRefresh')?.addEventListener('click',loadTeacherRanking);
setInterval(()=>{if(document.visibilityState==='visible'&&navigator.onLine)loadTeacherRanking()},15000);

