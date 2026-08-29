const DB='ProfeJaimeAsistenciaDB',VER=4;
const subjects=['Artes','Inglés','Español','Matemáticas','Formación Cívica y Ética','Formación Humana','Química','Educación Física','Historia'];
const states=['white','green','yellow','red'];
const stateText={white:'⚪ Sin información',green:'🟢 Al corriente',yellow:'🟡 Requiere atención',red:'🔴 Atención urgente'};let db,deferredPrompt;const LOCAL_BACKUP_KEY='ProfeJaimeControlEscolar_backup_interno';const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];const norm=v=>String(v??'').trim(),low=v=>norm(v).toLowerCase(),today=()=>new Date().toISOString().slice(0,10),safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const req=r=>new Promise((ok,no)=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});function store(n,m='readonly'){if(!db)throw new Error('La base de datos todavía no está abierta. Cierra y vuelve a abrir la app.');return db.transaction(n,m).objectStore(n)}const all=n=>req(store(n).getAll());
const put=async(n,v)=>{let out=await req(store(n,'readwrite').put(v));if(window.ProfeSupabase)queueRemoteMirror(n,v).catch(e=>console.warn('Supabase mirror',n,e));return out};
const del=async(n,k)=>{let out=await req(store(n,'readwrite').delete(k));if(window.ProfeSupabase)queueRemoteDelete(n,k).catch(e=>console.warn('Supabase delete',n,e));return out};
const clear=n=>req(store(n,'readwrite').clear());

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

const REQUIRED_STORES={students:'id',attendance:'key',activities:'id',activityRecords:'key',titularWeeks:'id',titularRecords:'key',settings:'key',internalBackups:'id',methodologies:'id',availability:'id',notices:'id',materials:'id',studyTopics:'id',studentMessages:'id',portalReports:'id',portalAuth:'id'};
function createMissingStores(database){for(const [name,keyPath] of Object.entries(REQUIRED_STORES))if(!database.objectStoreNames.contains(name))database.createObjectStore(name,{keyPath})}
function openAtVersion(version){return new Promise((ok,no)=>{const r=indexedDB.open(DB,version);r.onupgradeneeded=e=>createMissingStores(e.target.result);r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);r.onblocked=()=>no(new Error('La base de datos está bloqueada por otra ventana de la app. Cierra otras ventanas y vuelve a intentarlo.'))})}
async function openDB(){if(db)return db;let current=await new Promise((ok,no)=>{const r=indexedDB.open(DB);r.onupgradeneeded=e=>createMissingStores(e.target.result);r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);r.onblocked=()=>no(new Error('La base de datos está bloqueada por otra ventana de la app.'))});const missing=Object.keys(REQUIRED_STORES).filter(n=>!current.objectStoreNames.contains(n));if(missing.length){const next=current.version+1;current.close();current=await openAtVersion(next)}db=current;db.onversionchange=()=>{try{db.close()}catch(e){}db=null};return db}
async function ensureDB(){if(!db)await openDB();return db}
let supabaseReady=false,syncBusy=false;
function supaState(text,ok=true){let el=$('#supabaseSyncState');if(el){el.textContent=text;el.className=ok?'sync-ok':'sync-bad'}}
async function requireTeacherSession(){
 const saved=ProfeSupabase.restore();
 if(!saved){$('#teacherLoginGate')?.classList.remove('hidden');supaState('Falta iniciar sesión.',false);return false}
 try{await ProfeSupabase.token();$('#teacherLoginGate')?.classList.add('hidden');supabaseReady=true;supaState('Conectado. Los cambios se sincronizan con Supabase.');return true}catch(e){$('#teacherLoginGate')?.classList.remove('hidden');supaState('La sesión de Supabase venció.',false);return false}
}
async function teacherLogin(){
 let email=norm($('#teacherLoginEmail').value),password=$('#teacherLoginPassword').value,error=$('#teacherLoginError');error.textContent='';
 if(!email||!password){error.textContent='Escribe correo y contraseña.';return}
 try{await ProfeSupabase.login(email,password,$('#teacherRemember').checked);supabaseReady=true;$('#teacherLoginGate').classList.add('hidden');supaState('Conectado. Sincroniza tus datos actuales.');await syncAllToSupabase()}catch(e){error.textContent='No fue posible iniciar sesión: '+(e.message||e)}
}
async function teacherLogout(){await ProfeSupabase.logout();supabaseReady=false;$('#teacherLoginGate').classList.remove('hidden');supaState('Sesión cerrada.',false)}
function remoteStudent(s){return {id:String(s.id),name:s.name||String(s.id),shift:s.shift||'',group_name:s.group||'',list_number:Number(s.number)||null,birth_day:Number(s.birthDay)||null,birth_month:Number(s.birthMonth)||null,observations:s.observations||null,incidents:s.incidents||null,active:s.active!==false,inactive_at:s.inactiveAt||null,inactive_reason:s.inactiveReason||null}}
function remoteAttendance(a){return {student_id:String(a.studentId),attendance_date:a.date,status:a.status||'Presente',notes:a.notes||null}}
function remoteActivity(a){return {id:String(a.id),group_name:a.group||'',shift:a.shift||'',title:a.name||'Actividad',activity_date:a.date||null,due_date:a.dueDate||null,evaluation_type:a.evaluationMode||'delivery',max_score:10,visible_to_students:true,closed:!!a.closed,data:a}}
function remoteActivityRecord(r){let delivered=r.status==='yes'?true:r.status==='no'?false:null;return {activity_id:String(r.activityId||String(r.key||'').split('|')[0]),student_id:String(r.studentId||String(r.key||'').split('|')[1]),delivered,score:typeof r.score==='number'?r.score:null,delivery_date:r.timestamp||r.deliveryDate||null,observations:r.observations||null,data:r}}
function remoteMethodology(m){return {id:String(m.id),cycle:m.cycle||'',quarter:String(m.quarter||''),month:m.month||'',shift:m.shift||'',group_name:m.group||'',subject:m.subject||'Español',closed:!!m.closed,data:m}}
function remoteAvailability(a){return {id:'main',start_time:a.start||'12:00',end_time:a.end||'15:00',working_days:a.days||[1,2,3,4,5],vacation_start:a.vacationStart||null,vacation_end:a.vacationEnd||null,suspension_dates:a.technicalCouncilDates||[],suspended:!!a.suspended,temporary_notice:a.temporaryNotice||null,contact_override_open:!!a.contactOverrideOpen,student_chat_override:a.studentChatOverride||'auto',student_chat_override_date:a.studentChatOverrideDate||null}}
function remoteNotice(n){return {id:n.id,title:n.title||'Aviso',body:n.text||'',group_name:n.group||null,shift:'Matutino',active:n.active!==false,published_at:n.created||new Date().toISOString()}}
function remoteTopic(t){return {id:t.id,title:t.title||'Tema',description:t.notes||'',group_name:t.group||null,shift:'Matutino',active:t.active!==false,data:t}}
function cleanPath(v){return String(v||'archivo').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._-]+/g,'_')}
async function remoteMaterial(m){
 let row={id:m.id,title:m.title||'Material',material_type:m.type||'Archivo',source_type:m.source||'url',group_name:m.group||null,shift:'Matutino',external_url:m.url||null,storage_path:m.storagePath||null,file_name:m.fileName||null,mime_type:m.mime||null,file_size:Number(m.size)||null,active:m.active!==false};
 if(m.source==='file'&&m.fileData&&!row.storage_path){let path=`${cleanPath(m.group||'todos')}/${m.id}/${cleanPath(m.fileName||'archivo')}`;await ProfeSupabase.uploadMaterial(path,new Blob([m.fileData],{type:m.mime||'application/octet-stream'}),m.mime||'application/octet-stream');row.storage_path=path;m.storagePath=path;try{await req(store('materials','readwrite').put(m))}catch(_){}}
 return row;
}
async function queueRemoteMirror(n,v){
 if(!supabaseReady)return;
 if(n==='students'){await ProfeSupabase.upsert('students',remoteStudent(v),'id');return}
 if(n==='attendance'){await ProfeSupabase.upsert('attendance',remoteAttendance(v),'student_id,attendance_date');return}
 if(n==='activities'){await ProfeSupabase.upsert('activities',remoteActivity(v),'id');return}
 if(n==='activityRecords'){await ProfeSupabase.upsert('activity_records',remoteActivityRecord(v),'activity_id,student_id');return}
 if(n==='methodologies'){await ProfeSupabase.upsert('methodologies',remoteMethodology(v),'id');return}
 if(n==='availability'){await ProfeSupabase.upsert('availability',remoteAvailability(v),'id');return}
 if(n==='notices'){await ProfeSupabase.upsert('notices',remoteNotice(v),'id');return}
 if(n==='studyTopics'){await ProfeSupabase.upsert('study_topics',remoteTopic(v),'id');return}
 if(n==='materials'){let row=await remoteMaterial(v);await ProfeSupabase.upsert('materials',row,'id');return}
 if(n==='titularWeeks'){await ProfeSupabase.upsert('titular_weeks',{id:v.id,data:v},'id');return}
 if(n==='titularRecords'){await ProfeSupabase.upsert('titular_records',{id:String(v.key||v.id),student_id:v.studentId||null,data:v},'id');return}
 if(n==='settings'){await ProfeSupabase.upsert('app_settings',{id:String(v.key||v.id),data:v},'id');return}
}
async function queueRemoteDelete(n,k){
 if(!supabaseReady)return;
 const map={students:['students','id'],activities:['activities','id'],methodologies:['methodologies','id'],notices:['notices','id'],materials:['materials','id'],studyTopics:['study_topics','id']};
 if(map[n])await ProfeSupabase.remove(map[n][0],`${map[n][1]}=eq.${encodeURIComponent(k)}`);
}
async function ensureRemotePortalAccess(s){
 if(!supabaseReady||!sameShift(s.shift,'Matutino'))return;
 await ProfeSupabase.upsert('students',remoteStudent(s),'id');
 const rows=await ProfeSupabase.select('portal_auth',`select=role,must_change_pin,activated_at,locked_until&student_id=eq.${encodeURIComponent(s.id)}`);
 const roles=new Set((rows||[]).map(x=>x.role));
 if(roles.has('student')&&roles.has('parent'))return;
 const pins=await ProfeSupabase.rpc('teacher_create_portal_access',{p_student_id:String(s.id)});
 if(pins?.student_pin)await req(store('portalAuth','readwrite').put({id:`${s.id}|student`,studentId:s.id,role:'student',tempPinReveal:pins.student_pin,mustChange:true,updated:new Date().toISOString()}));
 if(pins?.parent_pin)await req(store('portalAuth','readwrite').put({id:`${s.id}|parent`,studentId:s.id,role:'parent',tempPinReveal:pins.parent_pin,mustChange:true,updated:new Date().toISOString()}));
}
async function syncAllToSupabase(){
 if(syncBusy)return;syncBusy=true;
 try{
   if(!(await requireTeacherSession()))return;
   supaState('Sincronizando…');
   await pullStudentProfileFieldsFromSupabase();
   const ss=await all('students');if(ss.length)await ProfeSupabase.upsert('students',ss.map(remoteStudent),'id');
   for(const s of ss.filter(x=>sameShift(x.shift,'Matutino')))await ensureRemotePortalAccess(s);
   const at=await all('attendance');if(at.length)await ProfeSupabase.upsert('attendance',at.map(remoteAttendance),'student_id,attendance_date');
   const ac=await all('activities');if(ac.length)await ProfeSupabase.upsert('activities',ac.map(remoteActivity),'id');
   const ar=await all('activityRecords');if(ar.length)await ProfeSupabase.upsert('activity_records',ar.map(remoteActivityRecord),'activity_id,student_id');
   const me=await all('methodologies');if(me.length)await ProfeSupabase.upsert('methodologies',me.map(remoteMethodology),'id');
   const av=await req(store('availability').get('main'));if(av)await ProfeSupabase.upsert('availability',remoteAvailability(av),'id');
   const no=await all('notices');if(no.length)await ProfeSupabase.upsert('notices',no.map(remoteNotice),'id');
   const to=await all('studyTopics');if(to.length)await ProfeSupabase.upsert('study_topics',to.map(remoteTopic),'id');
   for(const m of await all('materials')){let row=await remoteMaterial(m);await ProfeSupabase.upsert('materials',row,'id')}
   const tw=await all('titularWeeks');if(tw.length)await ProfeSupabase.upsert('titular_weeks',tw.map(v=>({id:v.id,data:v})),'id');
   const tr=await all('titularRecords');if(tr.length)await ProfeSupabase.upsert('titular_records',tr.map(v=>({id:String(v.key||v.id),student_id:v.studentId||null,data:v})),'id');
   await pullRemoteStudentMessages();
   supaState(`Sincronización completa · ${ss.length} alumnos.`);
   await renderPortalAccessReport();
 }catch(e){console.error(e);supaState('Error de sincronización: '+(e.message||e),false)}finally{syncBusy=false}
}

const alpha=(a,b)=>norm(a.name||a.id).localeCompare(norm(b.name||b.id),'es',{sensitivity:'base',numeric:true});const allStudents=async()=>((await all('students')).sort((a,b)=>a.shift.localeCompare(b.shift,'es',{sensitivity:'base'})||String(a.group).localeCompare(String(b.group),'es',{numeric:true,sensitivity:'base'})||alpha(a,b)));const students=async()=>((await allStudents()).filter(x=>x.active!==false));const uniq=a=>[...new Set(a.filter(Boolean))].sort((x,y)=>String(x).localeCompare(String(y),undefined,{numeric:true}));const canonShift=v=>low(v).replace(/\s+/g,'');const canonGroup=v=>norm(v).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[º°\.\-\s]/g,'');const sameShift=(a,b)=>canonShift(a)===canonShift(b);const sameGroup=(a,b)=>canonGroup(a)===canonGroup(b);const activitySort=(a,b)=>Number(a.order??Number.MAX_SAFE_INTEGER)-Number(b.order??Number.MAX_SAFE_INTEGER)||String(a.date||'').localeCompare(String(b.date||''))||String(a.name||'').localeCompare(String(b.name||''),'es',{sensitivity:'base'});

function showDialog(title,html){
  const dialog=$('#dialog'),titleEl=$('#dialogTitle'),bodyEl=$('#dialogBody');
  if(!dialog||!titleEl||!bodyEl){alert(String(title||'Aviso'));return}
  titleEl.textContent=String(title||'Detalle');
  bodyEl.innerHTML=String(html||'');
  if(dialog.open)dialog.close();
  if(typeof dialog.showModal==='function')dialog.showModal();
  else dialog.setAttribute('open','');
}

async function refreshAll(){
  await refreshHome();
  await refreshAttendance();
  await refreshActivitySelectors();
  await refreshGridWeeks();
  await refreshTitIndividual();
  await renderStudents();
  await refreshDossierSelector();
  await refreshMethodologyUI();
  await showLastInternalSave();
}


async function loadStudentAppHours(){
  const status=$('#studentAppHoursStatus');
  try{
    if(!(await requireTeacherSession()))return;
    const d=await ProfeSupabase.rpc('teacher_get_student_app_access',{});
    if(!d?.ok)throw new Error(d?.reason||'No se pudo consultar.');
    $('#studentAppHoursEnabled').checked=!!d.enabled;
    $('#studentAppBlockedStart').value=String(d.blocked_start||'07:00').slice(0,5);
    $('#studentAppBlockedEnd').value=String(d.blocked_end||'14:30').slice(0,5);
    const days=new Set((d.weekdays||[]).map(Number));
    $$('.studentAppDay').forEach(x=>x.checked=days.has(Number(x.value)));
    $('#studentAppMessageTitle').value=d.message_title||'¡Ahora no, joven!';
    $('#studentAppMessageBody').value=d.message_body||'';
    if(status){
      if(d.temporary_open_until && new Date(d.temporary_open_until)>new Date()){
        status.textContent='Apertura temporal activa hasta '+new Date(d.temporary_open_until).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})+'.';
      }else{
        status.textContent=d.enabled
          ? `Bloqueo activo de ${String(d.blocked_start||'').slice(0,5)} a ${String(d.blocked_end||'').slice(0,5)} en los días seleccionados.`
          : 'Bloqueo por horario desactivado.';
      }
    }
  }catch(e){
    if(status)status.textContent='No se pudo cargar el horario: '+(e.message||e);
  }
}
async function saveStudentAppHours(e){
  e?.preventDefault();
  const status=$('#studentAppHoursStatus');
  const weekdays=$$('.studentAppDay').filter(x=>x.checked).map(x=>Number(x.value));
  if(!weekdays.length)return alert('Selecciona al menos un día.');
  try{
    const d=await ProfeSupabase.rpc('teacher_set_student_app_access',{
      p_enabled:$('#studentAppHoursEnabled').checked,
      p_blocked_start:$('#studentAppBlockedStart').value,
      p_blocked_end:$('#studentAppBlockedEnd').value,
      p_weekdays:weekdays,
      p_message_title:$('#studentAppMessageTitle').value.trim()||'¡Ahora no, joven!',
      p_message_body:$('#studentAppMessageBody').value.trim()
    });
    if(!d?.ok)throw new Error(d?.reason||'No se pudo guardar.');
    await loadStudentAppHours();
    if(status){
      status.textContent='✓ Horario guardado correctamente.';
      status.classList.add('success');
      setTimeout(()=>status.classList.remove('success'),2500);
    }
  }catch(e){alert('No se pudo guardar el horario: '+(e.message||e))}
}
async function openStudentAppTemporarily(minutes){
  try{
    const d=await ProfeSupabase.rpc('teacher_open_student_app_temporarily',{p_minutes:Number(minutes)});
    if(!d?.ok)throw new Error(d?.reason||'No se pudo actualizar.');
    await loadStudentAppHours();
    alert(Number(minutes)>0?`App Estudiantes abierta temporalmente por ${minutes} minutos.`:'Apertura temporal cancelada.');
  }catch(e){alert('No se pudo cambiar la apertura temporal: '+(e.message||e))}
}


let meritPeriodsCache=[],meritRankingCache=[],meritGradeFilter='all';
const meritCriterionLabels={cleanliness:'Limpieza',uniform:'Uniforme',punctuality:'Puntualidad',coexistence:'Convivencia',responsibility:'Responsabilidad',attitude:'Actitud',institutional_participation:'Participación institucional'};
function meritPane(name){$$('.merit-pane').forEach(x=>x.classList.toggle('active',x.id==='merit-'+name));$$('.meritNav').forEach(x=>x.classList.toggle('active',x.dataset.meritPane===name));if(name==='ranking')loadMeritRanking();if(name==='movements')loadMeritMovements();if(name==='staff')loadMeritStaff();if(name==='weekly')meritWeeklyPreview();if(name==='monthly'){loadMeritPeriods().then(loadMeritMonthlyPreview);}if(name==='annual')loadMeritAnnualRanking();if(name==='config')loadMeritPeriods();}
async function meritRpc(name,args={}){if(!(await requireTeacherSession()))throw new Error('Sesión docente requerida');return await ProfeSupabase.rpc(name,args)}
async function loadMeritPeriods(){try{meritPeriodsCache=await meritRpc('teacher_merit_periods')||[];meritPeriodsCacheV8151=meritPeriodsCache;for(const id of ['meritRankingPeriod','meritMovementPeriod','meritWeeklyPeriod','meritMonthlyPeriod']){const el=$('#'+id);if(!el)continue;const old=el.value;el.innerHTML=meritPeriodsCache.map(p=>`<option value="${safe(p.id)}">${safe(p.label)} · ${safe(p.status)}</option>`).join('');if(meritPeriodsCache.some(p=>p.id===old))el.value=old;}const box=$('#meritPeriodsList');if(box){box.innerHTML=meritPeriodsCache.length?`<table><thead><tr><th>Periodo</th><th>Fechas</th><th>Estado</th><th>Portal</th><th>Acciones</th></tr></thead><tbody>${meritPeriodsCache.map(p=>`<tr><td>${safe(p.label)}</td><td>${safe(p.starts_at)} → ${safe(p.ends_at)}</td><td>${safe(p.status)}</td><td>${safe(p.public_state)}</td><td><button type="button" class="secondary meritEditPeriodBtn" data-id="${safe(p.id)}">Editar</button>${['closed','published'].includes(p.status)?'':`<button type="button" class="secondary meritDeletePeriodBtn" data-id="${safe(p.id)}" data-label="${safe(p.label)}">Eliminar periodo</button>`}</td></tr>`).join('')}</tbody></table>`:'<p class="hint">Aún no hay periodos.</p>';$$('.meritEditPeriodBtn').forEach(b=>b.onclick=()=>meritOpenPeriodEditV8151(b.dataset.id));$$('.meritDeletePeriodBtn').forEach(b=>b.onclick=()=>deleteMeritPeriodV8164(b.dataset.id,b.dataset.label));}return meritPeriodsCache}catch(e){alert('No se pudieron cargar los periodos de Mérito: '+(e.message||e));return[]}}
async function saveMeritPeriod(e){e.preventDefault();try{const d=await meritRpc('teacher_merit_save_period',{p_school_year:$('#meritSchoolYear').value.trim(),p_month_number:Number($('#meritMonthNumber').value),p_label:$('#meritPeriodLabel').value.trim(),p_starts_at:$('#meritPeriodStart').value,p_ends_at:$('#meritPeriodEnd').value,p_status:'open'});if(!d?.ok)throw new Error(d?.reason||'No se pudo guardar');$('#meritConfigStatus').textContent='✓ Periodo guardado y abierto correctamente.';await loadMeritPeriods()}catch(e){alert('No se pudo guardar el periodo: '+(e.message||e))}}
function meritCriteriaText(o){const c=o||{};return Object.entries(meritCriterionLabels).map(([k,l])=>`${l}: ${Number(c[k]||0)}`).join(' · ')}
async function loadMeritRanking(){if(!meritPeriodsCache.length)await loadMeritPeriods();const pid=$('#meritRankingPeriod')?.value;if(!pid){$('#meritRankingTable').innerHTML='<p class="hint">Primero crea un periodo en Configuración.</p>';return}try{meritRankingCache=await meritRpc('teacher_merit_ranking',{p_period_id:pid})||[];renderMeritRanking()}catch(e){alert('No se pudo cargar la clasificación: '+(e.message||e))}}
function renderMeritRanking(){const rows=meritRankingCache.filter(r=>meritGradeFilter==='all'||String(r.grade)===meritGradeFilter);$('#meritRankingTable').innerHTML=`<table><thead><tr><th>Pos.</th><th>Grupo</th><th>Puntos</th><th>Reconocimientos del mes</th></tr></thead><tbody>${rows.map(r=>`<tr><td><b>${r.rank}</b></td><td><b>${safe(r.group_code)}</b></td><td class="merit-stat">${Number(r.score||0)}</td><td>${safe(meritCriteriaText(r.criteria))}</td></tr>`).join('')}</tbody></table>`}
async function loadMeritMovements(){if(!meritPeriodsCache.length)await loadMeritPeriods();const pid=$('#meritMovementPeriod')?.value;if(!pid){$('#meritMovementsTable').innerHTML='<p class="hint">No hay periodo.</p>';return}try{const a=await meritRpc('teacher_merit_movements',{p_period_id:pid,p_limit:300})||[];$('#meritMovementsTable').innerHTML=a.length?`<table><thead><tr><th>Fecha</th><th>Grupo</th><th>Personal</th><th>Puntos</th><th>Motivo / criterios</th><th>Estado</th><th></th></tr></thead><tbody>${a.map(m=>`<tr><td>${new Date(m.created_at).toLocaleString('es-MX')}</td><td>${safe(m.group_code)}</td><td>${safe(m.display_name)}</td><td>${m.points??'—'}</td><td>${safe(m.reason||'')}${m.criteria?.length?'<br>'+safe(m.criteria.map(x=>meritCriterionLabels[x]||x).join(', ')):''}</td><td>${safe(m.status)}</td><td>${m.status==='valid'?`<button class="danger-outline meritVoid" data-id="${safe(m.id)}">Anular</button>`:''}</td></tr>`).join('')}</tbody></table>`:'<p class="hint">Aún no hay movimientos.</p>';$$('.meritVoid').forEach(b=>b.onclick=()=>voidMeritMovement(b.dataset.id))}catch(e){alert('No se pudieron cargar movimientos: '+(e.message||e))}}
async function voidMeritMovement(id){const note=prompt('Motivo administrativo de la anulación:');if(note===null)return;if(!note.trim())return alert('Escribe el motivo de la anulación.');if(!confirm('El movimiento quedará anulado, pero conservará su historial. ¿Continuar?'))return;try{await meritRpc('teacher_merit_void_movement',{p_movement_id:id,p_admin_note:note.trim()});await loadMeritMovements();await loadMeritRanking()}catch(e){alert('No se pudo anular: '+(e.message||e))}}
async function loadMeritStaff(){try{const a=await meritRpc('teacher_merit_staff')||[];meritStaffCacheV8151=a;$('#meritStaffList').innerHTML=a.length?`<table><thead><tr><th>Nombre</th><th>Función</th><th>Estado</th><th>Dispositivos</th><th>Acciones</th></tr></thead><tbody>${a.map(x=>`<tr><td><b>${safe(x.display_name)}</b></td><td>${safe(x.subject_area||x.role_type)}</td><td>${x.active?'Activo':'Desactivado'}</td><td>${Number(x.devices||0)}</td><td><div class="merit-inline-actions"><button class="secondary meritCode" data-id="${safe(x.id)}">${x.activation_code_created_at?'Regenerar código':'Generar código'}</button><button class="secondary meritActive" data-id="${safe(x.id)}" data-active="${x.active?'0':'1'}">${x.active?'Desactivar':'Reactivar'}</button><button class="secondary meritEditStaffBtn" data-id="${safe(x.id)}">Editar</button>${x.active?'':`<button class="secondary meritArchiveStaffBtn" data-id="${safe(x.id)}" data-name="${safe(x.display_name)}">Eliminar de la lista</button>`}</div></td></tr>`).join('')}</tbody></table>`:'<p class="hint">Aún no has agregado personal.</p>';$$('.meritCode').forEach(b=>b.onclick=()=>generateMeritCode(b.dataset.id));$$('.meritActive').forEach(b=>b.onclick=()=>setMeritStaffActive(b.dataset.id,b.dataset.active==='1'));$$('.meritEditStaffBtn').forEach(b=>b.onclick=()=>meritOpenStaffEditV8151(b.dataset.id));$$('.meritArchiveStaffBtn').forEach(b=>b.onclick=()=>meritArchiveStaffV8151(b.dataset.id,b.dataset.name))}catch(e){alert('No se pudo cargar el personal: '+(e.message||e))}}
async function addMeritStaff(e){e.preventDefault();try{const d=await meritRpc('teacher_merit_add_staff',{p_display_name:$('#meritStaffName').value.trim(),p_role_type:$('#meritStaffRole').value,p_subject_area:$('#meritStaffSubject').value.trim()||null});if(!d?.ok)throw new Error('No se pudo agregar');e.target.reset();await loadMeritStaff()}catch(e){alert('No se pudo agregar: '+(e.message||e))}}
async function generateMeritCode(id){if(!confirm('Al regenerar un código se invalidan las activaciones anteriores de esta persona. ¿Continuar?'))return;try{const d=await meritRpc('teacher_merit_generate_activation_code',{p_staff_id:id});$('#meritActivationCode').textContent=d.code;$('#meritActivationBox').classList.remove('hidden');await loadMeritStaff()}catch(e){alert('No se pudo generar el código: '+(e.message||e))}}
async function setMeritStaffActive(id,active){if(!confirm(active?'¿Reactivar a esta persona?':'¿Desactivar a esta persona y sus dispositivos?'))return;try{await meritRpc('teacher_merit_set_staff_active',{p_staff_id:id,p_active:active});await loadMeritStaff()}catch(e){alert('No se pudo cambiar el estado: '+(e.message||e))}}
async function meritWeeklyPreview(){if(!meritPeriodsCache.length)await loadMeritPeriods();const pid=$('#meritWeeklyPeriod')?.value;if(!pid){$('#meritWeeklyPreview').innerHTML='<p class="hint">Primero crea un periodo.</p>';return}try{const a=await meritRpc('teacher_merit_ranking',{p_period_id:pid})||[];$('#meritWeeklyPreview').innerHTML=`<table><thead><tr><th>Pos.</th><th>Grupo</th><th>Puntos</th></tr></thead><tbody>${a.map(x=>`<tr><td>${x.rank}</td><td><b>${safe(x.group_code)}</b></td><td>${Number(x.score||0)}</td></tr>`).join('')}</tbody></table>`}catch(e){alert('No se pudo preparar la vista previa: '+(e.message||e))}}
async function publishMeritWeekly(){const pid=$('#meritWeeklyPeriod').value;if(!pid)return alert('Selecciona un periodo.');if(!confirm('Se publicará este corte como avance semanal oficial. ¿Continuar?'))return;try{const d=await meritRpc('teacher_merit_publish_weekly',{p_period_id:pid,p_public_message:$('#meritWeeklyMessage').value.trim()||null});$('#meritWeeklyStatus').textContent='✓ Avance semanal publicado: '+new Date(d.published_at).toLocaleString('es-MX');await meritWeeklyPreview()}catch(e){alert('No se pudo publicar: '+(e.message||e))}}
async function setMeritPublicState(state){const pid=$('#meritWeeklyPeriod').value;if(!pid)return alert('Selecciona un periodo.');try{const d=await meritRpc('teacher_merit_set_public_state',{p_period_id:pid,p_state:state});$('#meritWeeklyStatus').textContent='✓ Estado público: '+safe(d.public_state)}catch(e){alert('No se pudo cambiar el estado: '+(e.message||e))}}
async function loadMeritAdmin(){await loadMeritPeriods();await loadMeritRanking()}

function setView(id){
  $$('.view').forEach(v=>v.classList.toggle('active',v.id===id));
  $$('.tab').forEach(b=>b.classList.toggle('active',b.dataset.view===id));
  const names={
    home:'Inicio',
    attendance:'Asistencia',
    schedule:'Mi horario',
    activities:'Actividades',
    methodologies:'Metodologías',
    titular:'Seguimiento 3.º A',
    students:'Alumnos',
    dossier:'Expediente del alumno',
    reports:'Reportes',availability:'Disponibilidad','student-app-hours':'Horario App Estudiantes',merit:'Mérito Gabino A. Palma',content:'Contenido','portal-access':'Estado de acceso a portales'
  };
  if($('#currentSection'))$('#currentSection').textContent=names[id]||'Menú';
  if($('#mainMenu'))$('#mainMenu').open=false;
  if(id==='home')refreshHome();
  if(id==='attendance')refreshAttendance();
  if(id==='schedule')refreshSchedule();
  if(id==='portal-access')renderPortalAccessReport();
  if(id==='activities')refreshActivitySelectors();
  if(id==='methodologies')refreshMethodologyUI();
  if(id==='titular')renderTitularGrid();
  if(id==='students')renderStudents();
  if(id==='dossier')refreshDossierSelector();
  if(id==='reports'){}if(id==='availability')loadAvailability();if(id==='student-app-hours')loadStudentAppHours();if(id==='merit')loadMeritAdmin();if(id==='content')refreshPortalContent();
}
function pane(prefix,name){$$('.'+prefix+'pane').forEach(x=>x.classList.toggle('active',x.id===prefix+'-'+name));$$('[data-'+prefix+'tab]').forEach(x=>x.classList.toggle('active',x.dataset[prefix+'tab']===name));if(prefix==='act'){if(name==='grid')renderActivityGrid();if(name==='manage')renderActivities()}if(prefix==='tit'&&name==='individual')refreshTitIndividual();if(prefix==='met'){if(name==='manage')renderMethodologies();if(name==='calculate')refreshCalculationMethodologies();if(name==='quarter')refreshQuarterSelectors()}}

async function pullStudentProfileFieldsFromSupabase(){return;}
function birthdayWeekDays(now=new Date()){
 const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
 const day=today.getDay();
 const monday=new Date(today);
 monday.setDate(today.getDate()-(day===0?6:day-1));
 return Array.from({length:7},(_,i)=>{const d=new Date(monday);d.setDate(monday.getDate()+i);return d});
}
function birthMonthDayFromStudent(s){
 const m=Number(s?.birthMonth||0),d=Number(s?.birthDay||0);
 return m&&d?`${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`:'';
}
function birthdayLabel(s){
 const m=Number(s?.birthMonth||0),d=Number(s?.birthDay||0);
 if(!m||!d)return 'No registrado';
 return new Date(2000,m-1,d).toLocaleDateString('es-MX',{day:'numeric',month:'long'});
}
function renderWeeklyBirthdays(list){
 const box=$('#weeklyBirthdays');if(!box)return;
 const days=birthdayWeekDays();
 const todayKey=`${String(new Date().getMonth()+1).padStart(2,'0')}-${String(new Date().getDate()).padStart(2,'0')}`;
 const rows=[];
 for(const d of days){
   const key=`${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
   const people=list.filter(s=>birthMonthDayFromStudent(s)===key).sort(alpha);
   if(!people.length)continue;
   const label=d.toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'long'}).replace(/^./,c=>c.toUpperCase());
   rows.push(`<div class="birthday-day ${key===todayKey?'today':''}"><div class="birthday-day-date">${safe(label)}</div><div>${people.map(s=>`<div><span class="birthday-name">🎉 ${safe(s.name||s.id)}</span><span class="birthday-meta">${safe(s.shift)} · ${safe(s.group)}</span></div>`).join('')}</div></div>`);
 }
 box.innerHTML=rows.length?rows.join(''):'<div class="empty">No hay cumpleaños registrados esta semana.</div>';
}

async function refreshHome(){
 if(!db)return;
 await pullStudentProfileFieldsFromSupabase();
 let s=await students(),a=await all('activities'),att=await all('attendance');
 let groups=new Set(s.map(x=>`${x.shift}|${x.group}`));
 $('#homeGroups').textContent=groups.size;
 $('#homeStudents').textContent=s.length;
 $('#homeActivities').textContent=a.length;
 $('#homeAttendance').textContent=att.length;
 renderWeeklyBirthdays(s);
 let d=new Date();
 $('#welcomeDate').textContent=d.toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).replace(/^./,c=>c.toUpperCase())+' · Cada cambio se guarda automáticamente en este iPad.';
 await showLastInternalSave();
}

async function fillSelectors(){let s=await students(),academic=s.filter(x=>!sameShift(x.shift,'Vespertino')),sh=uniq(academic.map(x=>x.shift));for(let id of ['attShift','actShift','gridShift','newActShift','metShift','calcMetShift']){let el=$('#'+id),old=el.value;el.innerHTML=sh.length?sh.map(x=>`<option>${safe(x)}</option>`).join(''):'<option>Sin alumnos</option>';if(sh.includes(old))el.value=old}await fillGroups('att');await fillGroups('act');await fillGroups('grid');await fillGroups('newAct');await fillGroups('met');await fillGroups('calcMet');}
async function fillGroups(prefix){let s=(await students()).filter(x=>!sameShift(x.shift,'Vespertino')),shift=$('#'+prefix+'Shift').value,id=prefix+'Group',el=$('#'+id),old=el.value,g=uniq(s.filter(x=>x.shift===shift).map(x=>x.group));el.innerHTML=g.length?g.map(x=>`<option>${safe(x)}</option>`).join(''):'<option>Sin grupo</option>';if(g.includes(old))el.value=old;if(prefix==='att')refreshAttendance();if(prefix==='act')refreshActivitySelectors();if(prefix==='grid')refreshGridWeeks();if(prefix==='newAct'){renderNewActivityGroupChoices(g)}if(prefix==='met')renderMethodologies();if(prefix==='calcMet')refreshCalculationMethodologies()}
function status(base,type,title,text){let p=$('#'+base+'Status');p.className='status '+type;p.querySelector('i').textContent=type==='success'?'✓':type==='error'?'⛔':type==='warning'?'⚠':'▣';p.querySelector('h2').textContent=title;p.querySelector('p').textContent=text;clearTimeout(p._t);p._t=setTimeout(()=>{p.className='status neutral';p.querySelector('i').textContent='▣';p.querySelector('h2').textContent=base==='att'?'Escanea la credencial':'Escanea para registrar entrega';p.querySelector('p').textContent=base==='att'?'El lector escribe el ID y envía Enter.':'El alumno quedará con palomita.'},2200)}
async function refreshAttendance(){if(!db)return;let s=await students(),a=await all('attendance'),shift=$('#attShift').value,group=$('#attGroup').value,date=$('#attDate').value,roster=s.filter(x=>sameShift(x.shift,shift)&&sameGroup(x.group,group)),rec=a.filter(x=>x.date===date&&sameShift(x.shift,shift)&&sameGroup(x.group,group));$('#attPresent').textContent=rec.length;$('#attTotal').textContent=roster.length;$('#attMissing').textContent=Math.max(0,roster.length-rec.length);let box=$('#attList');if(!rec.length){box.className='list empty';box.textContent='Aún no hay registros.';return}box.className='list';box.innerHTML=rec.sort((x,y)=>y.timestamp.localeCompare(x.timestamp)).map(x=>`<div class="row"><div><strong>${safe(x.name||x.studentId)}</strong><small>${safe(x.status||'Presente')} · Lista ${safe(x.number)} · ${new Date(x.timestamp).toLocaleTimeString('es-MX')}</small></div><div class="rowactions"><button class="del" data-ad="${safe(x.key)}">Eliminar</button></div></div>`).join('');$$('[data-ad]').forEach(b=>b.onclick=async()=>{if(confirm('¿Eliminar este registro?')){await del('attendance',b.dataset.ad);refreshAttendance()}})}
async function registerAttendance(){
 let id=norm($('#attScan').value);$('#attScan').value='';$('#attScan').focus();if(!id)return;
 let s=await req(store('students').get(id));if(!s)return status('att','warning','ID no encontrado',id);
 let shift=$('#attShift').value,group=$('#attGroup').value,date=$('#attDate').value;
 if(s.shift!==shift||String(s.group)!==String(group))return status('att','warning','Otro grupo',`${s.name||id}: ${s.shift}, ${s.group}`);
 let key=`${date}|${id}`,old=await req(store('attendance').get(key));
 let st=$('#attMode').value==='retardo'?'Retardo':'Presente';
 if(old&&old.status!=='Falta')return status('att','error','YA REGISTRADO',`${old.name||id} · ${new Date(old.timestamp).toLocaleTimeString('es-MX')}`);

 let rec={key,date,studentId:id,name:s.name,shift:s.shift,group:String(s.group),number:s.number,status:st,timestamp:new Date().toISOString()};
 await put('attendance',rec);

 if(sameShift(shift,'Matutino')){
   const when=new Date(rec.timestamp);
   const dateLabel=when.toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit',year:'numeric'});
   const timeLabel=when.toLocaleTimeString('es-MX',{hour:'numeric',minute:'2-digit'});
   const isLate=st==='Retardo';
   let message=`${s.name||'Alumno'} · Fecha: ${dateLabel} · Hora: ${timeLabel}`;
   sendTeacherPushEvent('attendance_recorded',{
     title:isLate?'Retardo registrado':'Asistencia registrada',
     student_id:String(s.id),
     student_name:s.name||'Alumno',
     attendance_date:date,
     attendance_time:timeLabel,
     attendance_status:st,
     message
   }).catch(()=>{});
 }

 status('att','success',old?.status==='Falta'?(st==='Retardo'?'FALTA CORREGIDA A RETARDO':'FALTA CORREGIDA A PRESENTE'):(st==='Retardo'?'RETARDO REGISTRADO':'REGISTRADO'),`${s.name||id} · Lista ${s.number}`);
 refreshAttendance();
}
async function showMissing(){
 let s=await students(),a=await all('attendance'),shift=$('#attShift').value,group=$('#attGroup').value,date=$('#attDate').value;
 let p=new Set(a.filter(x=>x.date===date&&sameShift(x.shift,shift)&&sameGroup(x.group,group)).map(x=>x.studentId));
 let m=s.filter(x=>sameShift(x.shift,shift)&&sameGroup(x.group,group)&&!p.has(x.id));
 showDialog('Faltantes',m.length?m.map(x=>`<div class="row"><div><strong>${safe(x.name||'Sin nombre')}</strong><small>ID ${safe(x.id)} · Lista ${safe(x.number)}</small></div></div>`).join(''):'<p>No hay alumnos pendientes de registrar.</p>');
}
async function finalizeAttendance(){
 let s=await students(),a=await all('attendance'),shift=$('#attShift').value,group=$('#attGroup').value,date=$('#attDate').value;
 let roster=s.filter(x=>sameShift(x.shift,shift)&&sameGroup(x.group,group));
 let recorded=new Set(a.filter(x=>x.date===date&&sameShift(x.shift,shift)&&sameGroup(x.group,group)).map(x=>x.studentId));
 let missing=roster.filter(x=>!recorded.has(x.id));
 if(!missing.length){alert('No hay alumnos pendientes. La lista ya está completa.');return}
 if(!confirm(`Se registrará FALTA a ${missing.length} alumno${missing.length===1?'':'s'}.\n\nEn Matutino, App padres recibirá una notificación por cada alumno con falta.\n\n¿Finalizar la lista?`))return;

 const timestamp=new Date().toISOString();
 const notifications=[];
 for(const st of missing){
   const rec={key:`${date}|${st.id}`,date,studentId:st.id,name:st.name,shift:st.shift,group:String(st.group),number:st.number,status:'Falta',timestamp};
   await put('attendance',rec);
   if(sameShift(shift,'Matutino')){
     notifications.push(sendTeacherPushEvent('absence_recorded',{
       student_id:String(st.id),
       student_name:st.name||'el alumno',
       attendance_date:date,
       title:'Inasistencia registrada',
       attendance_time:new Date(timestamp).toLocaleTimeString('es-MX',{hour:'numeric',minute:'2-digit'}),
       message:`${st.name||'Alumno'} · Fecha: ${new Date(timestamp).toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit',year:'numeric'})} · Hora: ${new Date(timestamp).toLocaleTimeString('es-MX',{hour:'numeric',minute:'2-digit'})} · No olvide justificar la inasistencia con Trabajo Social.`
     }));
   }
 }
 if(notifications.length)await Promise.allSettled(notifications);
 await refreshAttendance();
 alert(`Lista finalizada. Se registraron ${missing.length} falta${missing.length===1?'':'s'}.`);
}
async function showMissing(){let s=await students(),a=await all('attendance'),shift=$('#attShift').value,group=$('#attGroup').value,date=$('#attDate').value,p=new Set(a.filter(x=>x.date===date&&sameShift(x.shift,shift)&&sameGroup(x.group,group)).map(x=>x.studentId)),m=s.filter(x=>sameShift(x.shift,shift)&&sameGroup(x.group,group)&&!p.has(x.id));showDialog('Faltantes',m.length?m.map(x=>`<div class="row"><div><strong>${safe(x.name||'Sin nombre')}</strong><small>ID ${safe(x.id)} · Lista ${safe(x.number)}</small></div></div>`).join(''):'<p>No hay faltantes.</p>')}

function renderNewActivityGroupChoices(groups=[],selected=[]){
 const box=$('#newActGroupChoices');if(!box)return;
 const chosen=new Set((Array.isArray(selected)?selected:[selected]).filter(Boolean).map(String));
 const editing=!!$('#editActivityId')?.value;
 box.innerHTML=[
   `<label class="activity-group-choice all-groups"><input type="checkbox" id="newActAllGroups" ${editing?'disabled':''}> Todos</label>`,
   ...groups.map(g=>`<label class="activity-group-choice ${chosen.has(String(g))?'selected':''}">
     <input type="checkbox" class="new-act-group-check" value="${safe(g)}" ${chosen.has(String(g))?'checked':''} ${editing&&!chosen.has(String(g))?'disabled':''}> ${safe(g)}
   </label>`)
 ].join('');
 const checks=()=>[...box.querySelectorAll('.new-act-group-check')];
 const paint=()=>box.querySelectorAll('.activity-group-choice').forEach(l=>l.classList.toggle('selected',!!l.querySelector('input')?.checked));
 const all=$('#newActAllGroups');
 if(all&&!editing){
   all.checked=checks().length>0&&checks().every(x=>x.checked);
   all.onchange=()=>{checks().forEach(c=>c.checked=all.checked);paint()};
 }
 checks().forEach(c=>c.onchange=()=>{if(all&&!editing)all.checked=checks().length>0&&checks().every(x=>x.checked);paint()});
 paint();
}
function selectedNewActivityGroups(){
 return [...document.querySelectorAll('.new-act-group-check:checked')].map(x=>String(x.value));
}
function activityDueLabel(value){
 const m=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
 if(!m)return value||'';
 const d=new Date(Number(m[1]),Number(m[2])-1,Number(m[3]));
 return d.toLocaleDateString('es-MX',{day:'numeric',month:'long'});
}


const SCHOOL_CYCLE_2026_2027={
  start:'2026-08-31',
  end:'2027-07-09',
  recess:[
    ['2026-12-21','2027-01-05'],
    ['2027-03-22','2027-04-03']
  ]
};
const SCHOOL_MONTH_SHORT=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

function ymdLocal(s){
  const m=String(s||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m?new Date(Number(m[1]),Number(m[2])-1,Number(m[3])):null;
}
function isoLocal(d){
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function schoolWeekLabel(start,end){
  const a=start.getDate(),b=end.getDate();
  const ma=SCHOOL_MONTH_SHORT[start.getMonth()],mb=SCHOOL_MONTH_SHORT[end.getMonth()];
  return start.getMonth()===end.getMonth()?`${a}–${b} ${ma}`:`${a} ${ma}–${b} ${mb}`;
}
function dateInRecess(d){
  const x=isoLocal(d);
  return SCHOOL_CYCLE_2026_2027.recess.some(([a,b])=>x>=a&&x<=b);
}
function schoolWeekOptions(){
  const start=ymdLocal(SCHOOL_CYCLE_2026_2027.start);
  const end=ymdLocal(SCHOOL_CYCLE_2026_2027.end);
  const rows=[];
  for(let monday=new Date(start);monday<=end;monday.setDate(monday.getDate()+7)){
    const friday=new Date(monday);friday.setDate(friday.getDate()+4);
    if(friday>end)friday.setTime(end.getTime());

    // Omitir únicamente semanas completas sin clases por receso.
    let schoolDays=0;
    for(let d=new Date(monday);d<=friday;d.setDate(d.getDate()+1)){
      if(!dateInRecess(d))schoolDays++;
    }
    if(!schoolDays)continue;

    rows.push({
      value:schoolWeekLabel(monday,friday),
      start:isoLocal(monday),
      end:isoLocal(friday)
    });
  }
  return rows;
}
function weekForDate(dateValue){
  if(!dateValue)return null;
  const rows=schoolWeekOptions();
  return rows.find(w=>dateValue>=w.start&&dateValue<=w.end)||null;
}
function populateNewActivityWeeks(preferred=''){
  const el=$('#newActWeek');if(!el)return;
  const rows=schoolWeekOptions();
  el.innerHTML=rows.map(w=>`<option value="${safe(w.value)}" data-start="${w.start}" data-end="${w.end}">${safe(w.value)}</option>`).join('');
  if(preferred&&rows.some(w=>w.value===preferred))el.value=preferred;
  else{
    const byDate=weekForDate($('#newActDate')?.value||today());
    if(byDate)el.value=byDate.value;
  }
}
function syncActivityWeekFromDate(){
  const w=weekForDate($('#newActDate')?.value||'');
  if(w&&$('#newActWeek'))$('#newActWeek').value=w.value;
}

async function createActivity(e){
 e.preventDefault();
 const editId=$('#editActivityId').value;
 const old=editId?await req(store('activities').get(editId)):null;
 const newMode=$('#newActEvaluation').value||'delivery';
 const dueDate=$('#newActDueDate').value;
 const shift=$('#newActShift').value;
 const selectedGroups=selectedNewActivityGroups();

 if(!dueDate){alert('Selecciona la fecha de entrega.');$('#newActDueDate').focus();return}
 if(!selectedGroups.length){alert('Selecciona al menos un grupo.');return}

 if(old&&(old.evaluationMode||'delivery')!==newMode){
   const existing=(await all('activityRecords')).some(r=>r.activityId===old.id);
   if(existing){
     alert('No se puede cambiar la forma de evaluación porque esta actividad ya tiene registros.');
     $('#newActEvaluation').value=old.evaluationMode||'delivery';
     return;
   }
 }

 const base={
   shift,
   date:$('#newActDate').value,
   dueDate,
   week:norm($('#newActWeek').value),
   name:norm($('#newActName').value),
   type:$('#newActType').value,
   evaluationMode:newMode,
   updated:new Date().toISOString()
 };
 if(!base.name){alert('Escribe el nombre de la actividad.');$('#newActName').focus();return}

 let groupsForPush=[];

 if(editId){
   const group=selectedGroups[0]||old.group;
   await put('activities',{
     ...old,...base,id:old.id,group,
     order:old.order??Date.now(),
     created:old.created||new Date().toISOString()
   });
   groupsForPush=[group];
 }else{
   const createdAt=new Date().toISOString();
   for(const group of selectedGroups){
     await put('activities',{
       ...base,
       id:crypto.randomUUID(),
       group,
       order:Date.now(),
       created:createdAt
     });
   }
   groupsForPush=[...selectedGroups];
 }

 if(sameShift(shift,'Matutino')&&groupsForPush.length){
   const dueLabel=activityDueLabel(dueDate);
   await sendTeacherPushEvent('new_activity',{
     title:base.name,
     message:`Nueva actividad: ${base.name}${dueLabel?` · Entrega: ${dueLabel}`:''}`,
     groups:groupsForPush,
     group:groupsForPush.length===1?groupsForPush[0]:null,
     due_date:dueDate
   });
 }

 resetActivityForm();
 await refreshActivitySelectors();
 await refreshGridWeeks();
 await renderActivities();
 await refreshCalculationMethodologies();

 alert(editId
   ?'Actividad actualizada. Se envió aviso a alumnos y familias del grupo.'
   :`Actividad guardada para ${selectedGroups.length} grupo${selectedGroups.length===1?'':'s'}.`);
}

function resetActivityForm(){$('#activityForm').reset();$('#editActivityId').value='';$('#newActDate').value=today();populateNewActivityWeeks();$('#newActDueDate').value='';$('#newActEvaluation').value='delivery';$('#activityFormTitle').textContent='Crear actividad';$('#saveActivityBtn').textContent='Guardar actividad';$('#cancelActivityEdit').classList.add('hidden');$('#newActEvaluation').disabled=false;$('#evaluationHelp').textContent='Las actividades de entrega pueden registrarse con el escáner. Las numéricas se capturan directamente en la cuadrícula.';$('#newActGroupHelp').textContent='Puedes seleccionar uno, varios o todos los grupos.';fillGroups('newAct')}
async function editActivity(id){
 let a=await req(store('activities').get(id));if(!a)return;
 $('#editActivityId').value=a.id;
 $('#newActShift').value=[...$('#newActShift').options].find(o=>sameShift(o.value,a.shift))?.value||a.shift;
 await fillGroups('newAct');
 const groups=uniq((await students()).filter(s=>sameShift(s.shift,a.shift)).map(s=>s.group));
 renderNewActivityGroupChoices(groups,[a.group]);
 $('#newActGroup').value=[...$('#newActGroup').options].find(o=>sameGroup(o.value,a.group))?.value||a.group;
 $('#newActDate').value=a.date;
 $('#newActDueDate').value=a.dueDate||'';
 populateNewActivityWeeks(a.week);
 if(a.week&&![...$('#newActWeek').options].some(o=>o.value===a.week)){
   const opt=document.createElement('option');opt.value=a.week;opt.textContent=a.week;$('#newActWeek').appendChild(opt);$('#newActWeek').value=a.week;
 }else $('#newActWeek').value=a.week;
 $('#newActName').value=a.name;
 $('#newActType').value=a.type||'Actividad';
 $('#newActEvaluation').value=a.evaluationMode||'delivery';
 let hasRecords=(await all('activityRecords')).some(r=>r.activityId===a.id);
 $('#newActEvaluation').disabled=hasRecords;
 $('#evaluationHelp').textContent=hasRecords?'La forma de evaluación está bloqueada porque ya existen registros.':'Las actividades de entrega usan escáner; las numéricas se capturan en la cuadrícula.';
 $('#newActGroupHelp').textContent='Al editar, se modifica únicamente la actividad de este grupo.';
 $('#activityFormTitle').textContent='Editar actividad';
 $('#saveActivityBtn').textContent='Guardar cambios';
 $('#cancelActivityEdit').classList.remove('hidden');
 pane('act','manage');
 $('#activityForm').scrollIntoView({behavior:'smooth'});
}

async function refreshActivitySelectors(){if(!db)return;let acts=await all('activities'),shift=$('#actShift').value,group=$('#actGroup').value,weeks=uniq(acts.filter(x=>sameShift(x.shift,shift)&&sameGroup(x.group,group)).map(x=>x.week)),old=$('#actWeek').value;$('#actWeek').innerHTML=weeks.length?weeks.map(x=>`<option>${safe(x)}</option>`).join(''):'<option>Sin actividades</option>';if(weeks.includes(old))$('#actWeek').value=old;let week=$('#actWeek').value,allWeek=acts.filter(x=>sameShift(x.shift,shift)&&sameGroup(x.group,group)&&x.week===week).sort(activitySort),aa=allWeek.filter(x=>(x.evaluationMode||'delivery')==='delivery'),oldA=$('#actSelect').value;$('#actSelect').innerHTML=aa.length?aa.map(x=>`<option value="${x.id}">${safe(x.name)}</option>`).join(''):'<option value="">No hay actividades de entrega</option>';if(aa.some(x=>x.id===oldA))$('#actSelect').value=oldA;let enabled=aa.length>0;$('#actScan').disabled=!enabled;$('#actRegister').disabled=!enabled;$('#actClose').disabled=!enabled;$('#actReopen').disabled=!enabled;if(!enabled){status('act','warning','Sin actividades para escáner','Las actividades numéricas se califican en la cuadrícula semanal.')}refreshActivityStats()}

async function refreshActivityStats(){let id=$('#actSelect').value;if(!id){['actDelivered','actNotDelivered','actPending'].forEach(x=>$('#'+x).textContent='0');return}let act=await req(store('activities').get(id)),s=await students(),r=(await all('activityRecords')).filter(x=>x.activityId===id),roster=s.filter(x=>x.shift===act.shift&&String(x.group)===String(act.group)),yes=r.filter(x=>x.status==='yes').length,no=r.filter(x=>x.status==='no').length;$('#actDelivered').textContent=yes;$('#actNotDelivered').textContent=no;$('#actPending').textContent=Math.max(0,roster.length-yes-no)}
async function registerActivity(){let sid=norm($('#actScan').value);$('#actScan').value='';$('#actScan').focus();let aid=$('#actSelect').value;if(!aid)return status('act','warning','Selecciona una actividad','Primero crea o elige una actividad.');let s=await req(store('students').get(sid));if(!s)return status('act','warning','ID no encontrado',sid);let a=await req(store('activities').get(aid));if((a.evaluationMode||'delivery')!=='delivery')return status('act','warning','Actividad numérica','Captura la calificación desde la cuadrícula semanal.');if(!sameShift(s.shift,a.shift)||!sameGroup(s.group,a.group))return status('act','warning','Otro grupo',`${s.name||sid}: ${s.shift}, ${s.group}`);let key=`${aid}|${sid}`,old=await req(store('activityRecords').get(key));if(old&&old.status==='yes')return status('act','error','YA REGISTRADO',s.name||sid);let rec={key,activityId:aid,studentId:sid,status:'yes',timestamp:new Date().toISOString()};await put('activityRecords',rec);notifyParentActivityUpdate(a,sid,rec).catch(()=>{});status('act','success','ENTREGADO',`${s.name||sid} · Lista ${s.number}`);refreshActivityStats()}
async function closeActivity(markNo){let aid=$('#actSelect').value;if(!aid)return alert('Selecciona una actividad');let a=await req(store('activities').get(aid));if((a.evaluationMode||'delivery')!=='delivery')return alert('Esta actividad es numérica y no utiliza escáner.');let s=await students(),r=await all('activityRecords'),have=new Set(r.filter(x=>x.activityId===aid).map(x=>x.studentId));if(markNo){for(let st of s.filter(x=>sameShift(x.shift,a.shift)&&sameGroup(x.group,a.group))){if(!have.has(st.id))await put('activityRecords',{key:`${aid}|${st.id}`,activityId:aid,studentId:st.id,status:'no',timestamp:new Date().toISOString()})}}await refreshActivityStats();renderActivityGrid();alert(markNo?'Los no escaneados quedaron con tache.':'Los faltantes se conservaron pendientes.')}
async function refreshGridWeeks(){let acts=await all('activities'),shift=$('#gridShift').value,group=$('#gridGroup').value,weeks=uniq(acts.filter(x=>sameShift(x.shift,shift)&&sameGroup(x.group,group)).map(x=>x.week)),old=$('#gridWeek').value;$('#gridWeek').innerHTML=weeks.length?weeks.map(x=>`<option>${safe(x)}</option>`).join(''):'<option>Sin actividades</option>';if(weeks.includes(old))$('#gridWeek').value=old;renderActivityGrid()}
async function currentWeekActivities(){let shift=$('#gridShift').value,group=$('#gridGroup').value,week=$('#gridWeek').value;return (await all('activities')).filter(x=>sameShift(x.shift,shift)&&sameGroup(x.group,group)&&x.week===week).sort(activitySort)}
async function renderActivityOrder(){let acts=await currentWeekActivities(),box=$('#activityOrderList');if(!box)return;if(!acts.length){box.className='order-list empty';box.textContent='No hay actividades en esta semana.';return}box.className='order-list';box.innerHTML=acts.map((a,i)=>`<div class="order-item"><div><strong>${i+1}. ${safe(a.name)}</strong><small>${safe(a.date)} · ${safe(a.type||'Actividad')}</small></div><div class="order-actions"><button data-move-act="${a.id}|up" ${i===0?'disabled':''}>↑ Subir</button><button data-move-act="${a.id}|down" ${i===acts.length-1?'disabled':''}>↓ Bajar</button></div></div>`).join('');$$('[data-move-act]').forEach(b=>b.onclick=async()=>{let [id,dir]=b.dataset.moveAct.split('|'),list=await currentWeekActivities(),i=list.findIndex(x=>x.id===id),j=dir==='up'?i-1:i+1;if(i<0||j<0||j>=list.length)return;let ai=list[i],aj=list[j],oi=Number(ai.order??i),oj=Number(aj.order??j);ai.order=oj;aj.order=oi;await put('activities',ai);await put('activities',aj);await renderActivityGrid()})}
async function renderActivityGrid(){if(!db)return;let shift=$('#gridShift').value,group=$('#gridGroup').value,week=$('#gridWeek').value,s=(await students()).filter(x=>sameShift(x.shift,shift)&&sameGroup(x.group,group)),acts=await currentWeekActivities(),records=await all('activityRecords'),map=new Map(records.map(x=>[x.key,x]));await renderActivityOrder();let box=$('#activityGrid');if(!s.length||!acts.length){box.innerHTML='<div class="empty">Carga alumnos y crea actividades para esta semana.</div>';return}box.innerHTML=`<table class="matrix"><thead><tr><th class="num">#</th><th class="name">Alumno</th>${acts.map(a=>`<th title="${safe(a.type)} · ${safe(a.date)}">${safe(a.name)}<br><small>${(a.evaluationMode||'delivery')==='numeric'?'0–10':'Entrega'}</small></th>`).join('')}</tr></thead><tbody>${s.map(st=>`<tr><td class="num">${safe(st.number)}</td><td class="name">${safe(st.name||st.id)}</td>${acts.map(a=>{let rec=map.get(`${a.id}|${st.id}`),mode=a.evaluationMode||'delivery';if(mode==='numeric'){let value=rec&&typeof rec.score==='number'?rec.score:'';return `<td class="mark numeric"><input class="numeric-score" data-score="${a.id}|${st.id}" type="number" min="0" max="10" step="0.1" inputmode="decimal" value="${value}" placeholder="—"></td>`}let v=rec?.status||'blank';return `<td class="mark ${v}" data-mark="${a.id}|${st.id}">${v==='yes'?'●':v==='no'?'●':''}</td>`}).join('')}</tr>`).join('')}</tbody></table>`;$$('[data-mark]').forEach(c=>c.onclick=async()=>{let [aid,sid]=c.dataset.mark.split('|'),old=await req(store('activityRecords').get(c.dataset.mark)),next=!old||old.status==='blank'?'yes':old.status==='yes'?'no':'blank';if(next==='blank')await del('activityRecords',c.dataset.mark);else{let rec={key:c.dataset.mark,activityId:aid,studentId:sid,status:next,timestamp:new Date().toISOString()};await put('activityRecords',rec);if(next==='yes'){let act=(await all('activities')).find(x=>x.id===aid);notifyParentActivityUpdate(act,sid,rec).catch(()=>{})}}renderActivityGrid()});$$('[data-score]').forEach(inp=>{inp.onchange=async()=>{let [aid,sid]=inp.dataset.score.split('|'),raw=inp.value.trim(),key=inp.dataset.score;if(raw===''){await del('activityRecords',key);return}let score=Number(raw);if(!Number.isFinite(score)||score<0||score>10){alert('La calificación debe estar entre 0 y 10.');let old=await req(store('activityRecords').get(key));inp.value=typeof old?.score==='number'?old.score:'';return}score=Math.round(score*10)/10;inp.value=score;let rec={key,activityId:aid,studentId:sid,score,timestamp:new Date().toISOString()};await put('activityRecords',rec);let act=(await all('activities')).find(x=>x.id===aid);notifyParentActivityUpdate(act,sid,rec).catch(()=>{})}})}

async function renderActivities(){let acts=(await all('activities')).sort((a,b)=>b.date.localeCompare(a.date)||a.name.localeCompare(b.name,'es',{sensitivity:'base'})),box=$('#activitiesList');if(!acts.length){box.className='list empty';box.textContent='No hay actividades.';return}box.className='list';box.innerHTML=acts.map(a=>`<div class="row"><div><strong>${safe(a.name)}</strong><small>${safe(a.shift)} · ${safe(a.group)} · ${safe(a.week)} · Asignada ${safe(a.date)} · Entrega ${safe(a.dueDate||'Sin fecha')} · ${safe(a.type||'Actividad')}</small></div><div class="rowactions"><button class="edit activity-edit" title="Editar nombre, fecha, semana, tipo, turno o grupo sin borrar registros" data-actedit="${a.id}">✏️ Editar</button><button class="del" data-actdel="${a.id}">Eliminar</button></div></div>`).join('');$$('[data-actedit]').forEach(b=>b.onclick=()=>editActivity(b.dataset.actedit));$$('[data-actdel]').forEach(b=>b.onclick=async()=>{if(confirm('¿Eliminar la actividad y sus registros?')){let rs=(await all('activityRecords')).filter(x=>x.activityId===b.dataset.actdel);for(let r of rs)await del('activityRecords',r.key);await del('activities',b.dataset.actdel);await refreshActivitySelectors();await refreshGridWeeks();renderActivities()}})}
async function titularStudents(){return (await students()).filter(x=>sameShift(x.shift,'Vespertino')&&sameGroup(x.group,'3A')).sort(alpha)}
async function renderTitularGrid(){if(!db)return;let s=await titularStudents();if(!s.length){$('#titularGrid').innerHTML='<div class="empty">No hay alumnos identificados como grupo 3.º A. Cárgalos en Alumnos con turno Vespertino y grupo 3A.</div>';return}let weekKey=currentTitWeekId(),rec=await all('titularRecords'),map=new Map(rec.filter(x=>x.weekId===weekKey).map(x=>[x.key,x]));$('#titularGrid').innerHTML=`<table class="matrix"><thead><tr><th class="num">#</th><th class="name">Alumno</th>${subjects.map(x=>`<th>${safe(x)}</th>`).join('')}<th>Observaciones</th></tr></thead><tbody>${s.map(st=>`<tr><td class="num">${st.number}</td><td class="name">${safe(st.name||st.id)}</td>${subjects.map(sub=>{let k=`${weekKey}|${st.id}|${sub}`,v=map.get(k)?.status||'white';return `<td><button class="statusbtn s-${v}" data-tit="${safe(k)}">${stateText[v]}</button></td>`}).join('')}<td><textarea data-obs="${safe(st.id)}" rows="2">${safe(map.get(`${weekKey}|${st.id}|OBS`)?.text||'')}</textarea></td></tr>`).join('')}</tbody></table>`;$$('[data-tit]').forEach(b=>b.onclick=()=>{let cls=states.find(x=>b.classList.contains('s-'+x))||'white',next=states[(states.indexOf(cls)+1)%states.length];states.forEach(x=>b.classList.remove('s-'+x));b.classList.add('s-'+next);b.textContent=stateText[next]})}
function currentTitWeekId(){return [$('#titPeriod').value,$('#titMonth').value,norm($('#titWeek').value)||'Semana',norm($('#titLabel').value)||'Sin etiqueta'].join('|')}
async function saveTitularWeek(){let id=currentTitWeekId(),week={id,period:$('#titPeriod').value,month:$('#titMonth').value,week:norm($('#titWeek').value)||'Semana',label:norm($('#titLabel').value)||'Sin etiqueta',saved:new Date().toISOString()};await put('titularWeeks',week);for(let b of $$('[data-tit]')){let status=states.find(x=>b.classList.contains('s-'+x))||'white',parts=b.dataset.tit.split('|'),sub=parts.pop(),sid=parts.pop();await put('titularRecords',{key:`${id}|${sid}|${sub}`,weekId:id,studentId:sid,subject:sub,status})}for(let t of $$('[data-obs]'))await put('titularRecords',{key:`${id}|${t.dataset.obs}|OBS`,weekId:id,studentId:t.dataset.obs,subject:'OBS',text:t.value});alert('Seguimiento semanal guardado');refreshTitIndividual()}
async function refreshTitIndividual(){let s=await titularStudents(),weeks=(await all('titularWeeks')).sort((a,b)=>b.saved.localeCompare(a.saved));$('#titStudent').innerHTML=s.map(x=>`<option value="${x.id}">${safe(x.number)}. ${safe(x.name||x.id)}</option>`).join('');$('#titSavedWeek').innerHTML=weeks.map(x=>`<option value="${safe(x.id)}">${safe(x.label)}</option>`).join('');renderTitPreview()}
async function renderTitPreview(){let sid=$('#titStudent').value,wid=$('#titSavedWeek').value;if(!sid||!wid){$('#titPreview').innerHTML='<p>No hay semanas guardadas.</p>';return}let s=await req(store('students').get(sid)),w=await req(store('titularWeeks').get(wid)),r=(await all('titularRecords')).filter(x=>x.weekId===wid&&x.studentId===sid),map=new Map(r.map(x=>[x.subject,x]));$('#titPreview').innerHTML=`<h2>Reporte de seguimiento académico</h2><p><b>Titular:</b> Profr. Jaime Armando Pérez Vázquez</p><p><b>Alumno:</b> ${safe(s.name||s.id)} · <b>Grupo:</b> 3.º A · <b>No. lista:</b> ${safe(s.number)}</p><p><b>Semana:</b> ${safe(w.label)} · <b>${safe(w.period)}</b> · ${safe(w.month)}</p><div class="report-legend"><h3>Significado de los colores</h3><p><b>🟢 Verde:</b> el alumno se encuentra al corriente en la asignatura.</p><p><b>🟡 Amarillo:</b> existen aspectos o pendientes que deben revisarse directamente con el docente.</p><p><b>🔴 Rojo — atención urgente:</b> el alumno debe acercarse cuanto antes con el docente de la asignatura para revisar su situación y confirmar si existe posibilidad de ponerse al corriente. La recepción de trabajos atrasados depende de los criterios, fechas y autorización de cada maestro; este reporte no garantiza que las actividades pendientes sean aceptadas.</p><p><b>⚪ Blanco:</b> no se recibió información de la asignatura durante esta semana.</p></div><table class="matrix" style="width:100%"><thead><tr><th>Asignatura</th><th>Estado</th><th>Interpretación</th></tr></thead><tbody>${subjects.map(sub=>{let st=map.get(sub)?.status||'white',interp=st==='green'?'El alumno se encuentra al corriente.':st==='yellow'?'Debe acercarse con el docente para revisar pendientes o aspectos que requieren atención.':st==='red'?'ATENCIÓN URGENTE: debe acercarse cuanto antes con el docente para revisar su situación y confirmar si todavía existe posibilidad de ponerse al corriente. La aceptación de trabajos atrasados depende de cada maestro.':'No se recibió información esta semana.';return `<tr><td>${safe(sub)}</td><td>${stateText[st]}</td><td>${interp}</td></tr>`}).join('')}</tbody></table><p><b>Observaciones generales:</b> ${safe(map.get('OBS')?.text||'Sin observaciones.')}</p><p class="report-note"><b>Importante:</b> Este reporte es informativo. Cada docente determina si recibe actividades atrasadas, bajo qué condiciones y dentro de qué plazo.</p><p class="report-note"><b>Aviso:</b> Este reporte no sustituye la información oficial publicada en Systelar. Se recomienda revisar constantemente dicha plataforma para consultar avisos, calificaciones, pendientes y actualizaciones.</p>`}

function pdfReady(){return !!(window.jspdf&&window.jspdf.jsPDF);}
function pdfHeader(doc,title,area=''){doc.setFillColor(245,196,0);doc.rect(0,0,doc.internal.pageSize.getWidth(),28,'F');doc.setFillColor(201,35,45);doc.rect(0,26,doc.internal.pageSize.getWidth(),3,'F');doc.setTextColor(33,27,18);doc.setFont('helvetica','bold');doc.setFontSize(18);doc.text('EL AULA DEL PROFE JAIME',14,9);if(area){doc.setFontSize(11);doc.text(area,14,16);doc.setFontSize(12);doc.text(title,14,23)}else{doc.setFontSize(12);doc.text(title,14,19)}doc.setTextColor(0,0,0)}
function pdfFooter(doc){let pages=doc.internal.getNumberOfPages();for(let i=1;i<=pages;i++){doc.setPage(i);doc.setFontSize(8);doc.setTextColor(90);doc.text(`Profr. Jaime Armando Pérez Vázquez · Generado ${new Date().toLocaleString('es-MX')} · Página ${i} de ${pages}`,14,doc.internal.pageSize.getHeight()-7)}}
function pdfBlob(doc){return doc.output('blob')}
let activeReportUrl=null;
function closeReportViewer(){
 const viewer=document.getElementById('reportViewer');
 if(viewer)viewer.remove();
 if(activeReportUrl){URL.revokeObjectURL(activeReportUrl);activeReportUrl=null}
 document.body.style.overflow='';
}
async function shareReportPdf(blob,fileName,title){
 try{
  const file=new File([blob],fileName,{type:'application/pdf'});
  if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){
   await navigator.share({title,text:'Reporte generado en El Aula del Profe Jaime',files:[file]});
  }else{
   const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=fileName;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
   alert('El PDF se guardó. Ábrelo desde Archivos y usa Compartir para enviarlo por WhatsApp.');
  }
 }catch(e){if(e.name!=='AbortError')alert('No se pudo abrir el menú para compartir. Usa “Guardar PDF” y envíalo desde Archivos.')}
}
async function archivePortalReport(title,blob,fileName){
 try{
  const buffer=await blob.arrayBuffer();
  let group='';
  const gm=String(fileName||'').match(/(?:_|^)(\d+[A-Z]?|3A)(?:_|\.|$)/i);if(gm)group=gm[1];
  await put('portalReports',{id:crypto.randomUUID(),title,fileName,group,created:new Date().toISOString(),mime:'application/pdf',data:buffer});
 }catch(e){console.warn('No se pudo archivar reporte para portal',e)}
}
function printContent(title,html,blob,fileName){
 archivePortalReport(title,blob,fileName);
 closeReportViewer();
 activeReportUrl=URL.createObjectURL(blob);
 const overlay=document.createElement('div');overlay.id='reportViewer';overlay.style.cssText='position:fixed;inset:0;z-index:99999;background:#ece8dc;display:flex;flex-direction:column;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)';
 const toolbar=document.createElement('div');toolbar.style.cssText='display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap;padding:10px;background:#211b12;border-bottom:4px solid #c9232d';
 const mk=(text,bg,fg='#fff')=>{const b=document.createElement('button');b.textContent=text;b.style.cssText=`border:0;border-radius:11px;padding:11px 15px;font-weight:900;font-size:15px;background:${bg};color:${fg}`;return b};
 const close=mk('← Regresar a la app','#c9232d');close.onclick=closeReportViewer;
 const share=mk('Compartir PDF','#25d366','#102b18');share.onclick=()=>shareReportPdf(blob,fileName,title);
 const save=mk('Guardar PDF','#f5c400','#211b12');save.onclick=()=>{const a=document.createElement('a');a.href=activeReportUrl;a.download=fileName;document.body.appendChild(a);a.click();a.remove()};
 const print=mk('Imprimir','#f5c400','#211b12');
 toolbar.append(close,share,save,print);
 const note=document.createElement('div');note.textContent='Toca “Compartir PDF” y selecciona WhatsApp en el menú del iPad.';note.style.cssText='text-align:center;padding:7px;background:#fff8d6;font-size:13px;font-weight:700;color:#554600';
 const frame=document.createElement('iframe');frame.src=activeReportUrl;frame.title=title;frame.style.cssText='width:100%;flex:1;border:0;background:#fff';
 print.onclick=()=>{try{frame.contentWindow.focus();frame.contentWindow.print()}catch(e){window.open(activeReportUrl,'_self')}};
 overlay.append(toolbar,note,frame);document.body.appendChild(overlay);document.body.style.overflow='hidden';
}

async function showWeeklyReportOptions(){
 let acts=await currentWeekActivities();
 if(!acts.length)return alert('No hay actividades en esa semana');
 let defaultTitle='Reporte semanal de actividades';
 let html=`<label style="display:block;margin-bottom:14px"><strong>Encabezado del reporte</strong><input id="weeklyReportTitle" value="${defaultTitle}" maxlength="90" style="margin-top:6px;width:100%"></label>
 <p>Selecciona las actividades que deseas incluir. El orden mostrado será el mismo de la cuadrícula.</p>
 <div class="report-options">${acts.map((a,i)=>`<label class="report-option"><input type="checkbox" data-report-act="${a.id}" checked><span><strong>${i+1}. ${safe(a.name)}</strong><br><small>${safe(a.date)} · ${safe(a.type||'Actividad')}</small></span></label>`).join('')}</div>
 <div class="actions">
   <button id="selectAllReportActs" class="secondary">Seleccionar todas</button>
   <button id="clearReportActs" class="danger-outline">Quitar todas</button>
 </div>
 <hr style="margin:18px 0;border:0;border-top:1px solid #ead9a8">
 <div class="actions">
   <button id="generateSelectedWeeklyPdf" class="primary">PDF general del grupo</button>
   <button id="generateIndividualWeeklyPdf" class="secondary">PDF individuales</button>
   <button id="publishWeeklyParents" class="primary">Enviar individuales a Padres</button>
 </div>
 <p class="hint">“Enviar individuales a Padres” publica a cada familia únicamente el reporte de su alumno y envía una notificación.</p>`;
 showDialog('Preparar reporte semanal',html);
 $('#selectAllReportActs').onclick=()=>$$('[data-report-act]').forEach(x=>x.checked=true);
 $('#clearReportActs').onclick=()=>$$('[data-report-act]').forEach(x=>x.checked=false);

 const selected=()=>$$('[data-report-act]:checked').map(x=>x.dataset.reportAct);
 const title=()=>($('#weeklyReportTitle').value||defaultTitle).trim();

 $('#generateSelectedWeeklyPdf').onclick=async()=>{
   let ids=selected();if(!ids.length)return alert('Selecciona al menos una actividad.');
   let t=title();$('#dialog').close();await printWeekly(ids,t);
 };
 $('#generateIndividualWeeklyPdf').onclick=async()=>{
   let ids=selected();if(!ids.length)return alert('Selecciona al menos una actividad.');
   let t=title();$('#dialog').close();await printWeeklyIndividuals(ids,t);
 };
 $('#publishWeeklyParents').onclick=async()=>{
   let ids=selected();if(!ids.length)return alert('Selecciona al menos una actividad.');
   let t=title();
   if(!confirm('Se publicará un reporte individual para cada familia del grupo seleccionado y se enviará una notificación. ¿Continuar?'))return;
   $('#dialog').close();
   await publishWeeklyReportsToParents(ids,t);
 };
}

function weeklyReportData(selectedIds=null){
 return (async()=>{
   const shift=$('#gridShift').value,group=$('#gridGroup').value,week=$('#gridWeek').value;
   const allStudents=(await students()).filter(x=>sameShift(x.shift,shift)&&sameGroup(x.group,group));
   let acts=await currentWeekActivities();
   if(Array.isArray(selectedIds))acts=acts.filter(a=>selectedIds.includes(a.id));
   const records=await all('activityRecords');
   const map=new Map(records.map(x=>[x.key,x]));
   return {shift,group,week,students:allStudents,acts,map};
 })();
}

function individualWeeklyRows(student,acts,map){
 let delivered=0;
 const rows=acts.map(a=>{
   const rec=map.get(`${a.id}|${student.id}`);
   const mode=a.evaluationMode||'delivery';
   let status='Pendiente';
   let code='pending';
   if(mode==='numeric'){
     if(typeof rec?.score==='number'){status=`${rec.score}/10`;code='numeric';delivered++}
   }else if(rec?.status==='yes'){status='Entregó';code='yes';delivered++}
   else if(rec?.status==='no'){status='No entregó';code='no'}
   return {
     id:a.id,
     name:a.name,
     type:a.type||'Actividad',
     assigned:a.date||'',
     due:a.dueDate||'',
     mode,
     status,
     code,
     score:typeof rec?.score==='number'?rec.score:null
   };
 });
 return {rows,delivered,total:acts.length};
}

async function printWeeklyIndividuals(selectedIds=null,reportTitle='Reporte semanal de actividades'){
 const {shift,group,week,students:sts,acts,map}=await weeklyReportData(selectedIds);
 if(!acts.length)return alert('No seleccionaste actividades para el reporte');
 if(!pdfReady())return alert('No se cargó el generador de PDF. Pulsa Actualizar app con internet una vez y vuelve a intentarlo.');
 const {jsPDF}=window.jspdf;
 const doc=new jsPDF({unit:'mm',format:'letter'});

 sts.forEach((st,index)=>{
   if(index>0)doc.addPage();
   const info=individualWeeklyRows(st,acts,map);
   pdfHeader(doc,reportTitle,'ESPAÑOL');
   doc.setFontSize(10);
   doc.text(`Alumno: ${st.name||st.id}`,14,34);
   doc.text(`Grupo: ${group}    No. de lista: ${st.number||'—'}    Semana: ${week}`,14,40);
   doc.autoTable({
     startY:46,
     head:[['Actividad','Tipo','Asignada','Entrega','Estado']],
     body:info.rows.map(r=>[r.name,r.type,r.assigned||'—',r.due||'—',r.status]),
     styles:{fontSize:8,cellPadding:2,valign:'middle'},
     headStyles:{fillColor:[245,196,0],textColor:[33,27,18]},
     columnStyles:{0:{cellWidth:65},1:{cellWidth:27},2:{cellWidth:27},3:{cellWidth:27},4:{cellWidth:38}}
   });
   let y=doc.lastAutoTable.finalY+8;
   doc.setFont('helvetica','bold');doc.setFontSize(11);
   doc.text(`Entregadas / registradas: ${info.delivered} de ${info.total}`,14,y);
   doc.setFont('helvetica','normal');doc.setFontSize(9);
   doc.text(doc.splitTextToSize('Este reporte corresponde al seguimiento semanal de entregas registrado en Español.',180),14,y+8);
   pdfFooter(doc);
 });
 const file=`reportes_individuales_${shift}_${group}_${week.replace(/[^a-z0-9]+/gi,'_')}.pdf`;
 printContent('Reportes individuales de entregas',`<p><b>${sts.length}</b> reportes individuales · Grupo ${safe(group)} · Semana ${safe(week)}</p>`,pdfBlob(doc),file);
}

async function publishWeeklyReportsToParents(selectedIds=null,reportTitle='Reporte semanal de actividades'){
 if(!supabaseReady)return alert('Primero inicia sesión en Supabase.');
 const {shift,group,week,students:sts,acts,map}=await weeklyReportData(selectedIds);
 if(!sameShift(shift,'Matutino'))return alert('Esta función está disponible únicamente para Matutino.');
 if(!acts.length)return alert('No seleccionaste actividades.');
 if(!sts.length)return alert('No hay alumnos en el grupo.');

 const buttonText='Publicando reportes';
 let ok=0,failed=[];
 for(const st of sts){
   try{
     const info=individualWeeklyRows(st,acts,map);
     const reportId=crypto.randomUUID();
     const payload={
       id:reportId,
       student_id:String(st.id),
       title:`Reporte semanal de entregas · ${week}`,
       report_type:'weekly_deliveries',
       storage_path:null,
       report_date:today(),
       visible_to_student:false,
       visible_to_parent:true,
       data:{
         version:1,
         subject:'Español',
         shift,
         group_name:group,
         week,
         student_name:st.name||String(st.id),
         list_number:st.number||null,
         delivered:info.delivered,
         total:info.total,
         activities:info.rows
       }
     };
     await ProfeSupabase.upsert('portal_reports',payload,'id');
     await put('portalReports',{
       id:reportId,
       title:payload.title,
       studentId:String(st.id),
       group,
       week,
       created:new Date().toISOString(),
       reportType:'weekly_deliveries',
       data:payload.data
     });
     await sendTeacherPushEvent('new_report',{
       student_id:String(st.id),
       week,
       title:'Nuevo reporte de entregas',
       message:`Recibiste un reporte general de entregas de la semana ${week}.`
     });
     ok++;
   }catch(e){
     failed.push(`${st.name||st.id}: ${e.message||e}`);
   }
 }
 if(failed.length){
   alert(`Se publicaron ${ok} reportes.\n\nNo se pudieron publicar ${failed.length}:\n${failed.slice(0,8).join('\n')}`);
 }else{
   alert(`Listo. Se publicaron ${ok} reportes individuales en Seguimiento Familiar y se enviaron las notificaciones.`);
 }
}

async function printAttendance(){
 const shift=$('#attShift').value,group=$('#attGroup').value,date=$('#attDate').value;
 $('#attReportFrom').value=date;$('#attReportTo').value=date;
 return printAttendanceRange();
}
function attendanceMark(rec){
 if(!rec||rec.status==='Falta')return '✕';
 if(rec.status==='Retardo')return '⌛';
 return '✓';
}
async function printAttendanceRange(){
 const shift=$('#attShift').value,group=$('#attGroup').value;
 let from=$('#attReportFrom').value||$('#attDate').value,to=$('#attReportTo').value||from;
 if(!from||!to)return alert('Selecciona la fecha o rango del reporte.');
 if(from>to)[from,to]=[to,from];
 const dayMs=86400000,start=new Date(from+'T12:00:00'),finish=new Date(to+'T12:00:00');
 const dates=[];for(let d=new Date(start);d<=finish;d=new Date(d.getTime()+dayMs))dates.push(d.toISOString().slice(0,10));
 if(dates.length>31)return alert('Para que el PDF sea legible, genera un rango máximo de 31 días.');
 const roster=(await students()).filter(x=>sameShift(x.shift,shift)&&sameGroup(x.group,group)).sort((a,b)=>(Number(a.number)||999)-(Number(b.number)||999));
 const allAtt=(await all('attendance')).filter(x=>sameShift(x.shift,shift)&&sameGroup(x.group,group)&&x.date>=from&&x.date<=to);
 const byKey=new Map(allAtt.map(x=>[`${x.date}|${x.studentId}`,x]));
 if(!pdfReady())return alert('No se cargó el generador de PDF. Abre la app con internet y vuelve a intentarlo.');
 const {jsPDF}=window.jspdf,landscape=dates.length>5;
 const doc=new jsPDF({unit:'mm',format:'a4',orientation:landscape?'landscape':'portrait'});
 pdfHeader(doc,'Reporte de asistencia');
 doc.setFontSize(9);doc.text(`Turno: ${shift}    Grupo: ${group}    Periodo: ${from}${from===to?'':' al '+to}`,14,32);
 const head=['#','Alumno',...dates.map(d=>{const x=new Date(d+'T12:00:00');return x.toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit'})})];
 const body=roster.map(st=>[String(st.number??''),st.name||st.id,...dates.map(d=>attendanceMark(byKey.get(`${d}|${st.id}`)))]);
 doc.autoTable({startY:37,head:[head],body,styles:{fontSize:dates.length>12?6.2:7.5,cellPadding:1.4,halign:'center'},headStyles:{fillColor:[245,196,0],textColor:[33,27,18]},columnStyles:{1:{halign:'left',cellWidth:landscape?72:70}},margin:{left:8,right:8}});
 let y=(doc.lastAutoTable?.finalY||40)+6;if(y>doc.internal.pageSize.getHeight()-15){doc.addPage();y=15}
 doc.setFontSize(8.5);doc.text('Leyenda: ✓ Asistencia    ✕ Inasistencia    ⌛ Retardo',14,y);
 doc.setFontSize(7.5);doc.text(`Generado: ${new Date().toLocaleString('es-MX')}`,14,y+5);
 pdfFooter(doc);
 const html=`<p><b>Turno:</b> ${safe(shift)} · <b>Grupo:</b> ${safe(group)} · <b>Periodo:</b> ${from}${from===to?'':' al '+to}</p><p><b>Leyenda:</b> ✓ Asistencia · ✕ Inasistencia · ⌛ Retardo</p>`;
 printContent('Reporte de asistencia',html,pdfBlob(doc),`asistencia_${shift}_${group}_${from}_${to}.pdf`);
}

const SCHEDULE_DAYS={1:'Lunes',2:'Martes',3:'Miércoles',4:'Jueves',5:'Viernes',6:'Sábado',7:'Domingo'};
let scheduleCache=[];
async function refreshSchedule(){
 if(!supabaseReady){$('#scheduleList').className='list empty';$('#scheduleList').textContent='Conéctate a Supabase para cargar el horario.';return}
 try{
   scheduleCache=await ProfeSupabase.rpc('teacher_schedule_list',{})||[];
   const box=$('#scheduleList');
   if(!scheduleCache.length){box.className='list empty';box.textContent='Aún no has cargado clases.';return}
   box.className='list';
   box.innerHTML=scheduleCache.sort((a,b)=>Number(a.day_of_week)-Number(b.day_of_week)||String(a.start_time).localeCompare(String(b.start_time))).map(x=>`<div class="row"><div><strong>${safe(SCHEDULE_DAYS[x.day_of_week]||x.day_of_week)} · ${safe(String(x.start_time||'').slice(0,5))}–${safe(String(x.end_time||'').slice(0,5))}</strong><small>${safe(x.shift)} · ${safe(x.group_name)} · ${safe(x.subject)} · aviso ${safe(x.reminder_minutes)} min antes${x.enabled?'':' · DESACTIVADO'}</small></div><div class="rowactions"><button data-schedule-edit="${safe(x.id)}" class="secondary">Editar</button><button data-schedule-del="${safe(x.id)}" class="del">Eliminar</button></div></div>`).join('');
   $$('[data-schedule-edit]').forEach(b=>b.onclick=()=>editScheduleItem(b.dataset.scheduleEdit));
   $$('[data-schedule-del]').forEach(b=>b.onclick=()=>deleteScheduleItem(b.dataset.scheduleDel));
 }catch(e){$('#scheduleList').className='list empty';$('#scheduleList').textContent='No se pudo cargar el horario: '+(e.message||e)}
}
function resetScheduleForm(){
 $('#scheduleForm').reset();$('#scheduleId').value='';$('#scheduleSubject').value='Español';$('#scheduleReminder').value='5';$('#scheduleEnabled').checked=true;$('#scheduleCancelEdit').classList.add('hidden');
}
function editScheduleItem(id){
 const x=scheduleCache.find(r=>String(r.id)===String(id));if(!x)return;
 $('#scheduleId').value=x.id;$('#scheduleDay').value=String(x.day_of_week);$('#scheduleShift').value=x.shift;$('#scheduleStart').value=String(x.start_time).slice(0,5);$('#scheduleEnd').value=String(x.end_time).slice(0,5);$('#scheduleGroup').value=x.group_name;$('#scheduleSubject').value=x.subject;$('#scheduleReminder').value=String(x.reminder_minutes||5);$('#scheduleEnabled').checked=x.enabled!==false;$('#scheduleCancelEdit').classList.remove('hidden');window.scrollTo({top:0,behavior:'smooth'});
}
async function saveScheduleItem(e){
 e.preventDefault();
 try{
   await ProfeSupabase.rpc('teacher_schedule_save',{p_id:$('#scheduleId').value||null,p_day_of_week:Number($('#scheduleDay').value),p_start_time:$('#scheduleStart').value,p_end_time:$('#scheduleEnd').value,p_shift:$('#scheduleShift').value,p_group_name:$('#scheduleGroup').value.trim(),p_subject:$('#scheduleSubject').value.trim(),p_reminder_minutes:Number($('#scheduleReminder').value),p_enabled:$('#scheduleEnabled').checked});
   resetScheduleForm();await refreshSchedule();alert('Clase guardada en Mi horario.');
 }catch(e){alert('No se pudo guardar la clase: '+(e.message||e))}
}
async function deleteScheduleItem(id){if(!confirm('¿Eliminar esta clase del horario?'))return;try{await ProfeSupabase.rpc('teacher_schedule_delete',{p_id:id});await refreshSchedule()}catch(e){alert(e.message||e)}}
async function pauseScheduleToday(){
 try{const r=await ProfeSupabase.rpc('teacher_schedule_pause_today',{});alert(r?.paused?'Avisos de hoy pausados.':'Los avisos de hoy volvieron a activarse.');$('#schedulePauseToday').textContent=r?.paused?'Reactivar avisos de hoy':'Pausar avisos de hoy'}catch(e){alert(e.message||e)}
}
async function enableSchedulePush(){
 try{
   if(Notification.permission!=='granted'){
     const p=await Notification.requestPermission();if(p!=='granted')return alert('No se concedió permiso para notificaciones.');
   }
   const reg=await navigator.serviceWorker.ready;let sub=await reg.pushManager.getSubscription();if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:vapidBytes(WEB_PUSH_VAPID_PUBLIC_KEY)});
   const j=sub.toJSON();await ProfeSupabase.rpc('register_schedule_push_subscription',{p_endpoint:j.endpoint,p_p256dh:j.keys?.p256dh,p_auth:j.keys?.auth,p_user_agent:navigator.userAgent});
   alert('Avisos de Mi horario activados en este dispositivo.');
 }catch(e){alert('No se pudieron activar los avisos: '+(e.message||e))}
}


async function forceUpdate(){
  const button=$('#updateAppBtn');
  const original=button?.textContent||'Actualizar app';
  if(button){button.disabled=true;button.textContent='Actualizando…'}
  try{
    if(!navigator.onLine)throw new Error('Necesitas conexión a internet para actualizar la app.');
    if('serviceWorker' in navigator){
      const registrations=await navigator.serviceWorker.getRegistrations();
      await Promise.allSettled(registrations.map(reg=>reg.update()));
    }
    if('caches' in window){
      const keys=await caches.keys();
      await Promise.all(keys.filter(key=>key.startsWith('aula-profe-jaime-')).map(key=>caches.delete(key)));
    }
    await fetch(`index.html?actualizar=${Date.now()}`,{cache:'no-store'});
    const url=new URL(location.href);
    url.searchParams.set('actualizar',Date.now());
    location.replace(url.toString());
  }catch(e){
    if(button){button.disabled=false;button.textContent=original}
    alert('No se pudo actualizar la app. Revisa la conexión a internet y vuelve a intentarlo. Detalle: '+(e?.message||e));
  }
}


const DELETE_GROUPS={
  students:{label:'Alumnos',stores:['students']},
  attendance:{label:'Asistencias',stores:['attendance']},
  activities:{label:'Actividades y calificaciones',stores:['activities','activityRecords']},
  methodologies:{label:'Metodologías',stores:['methodologies']},
  titular:{label:'Seguimiento de 3.º A',stores:['titularWeeks','titularRecords']},
  backups:{label:'Respaldos internos',stores:['internalBackups']}
};

async function getDeleteCounts(){
  const counts={};
  for(const [key,group] of Object.entries(DELETE_GROUPS)){
    let total=0;
    for(const storeName of group.stores){
      if(db.objectStoreNames.contains(storeName))total+=(await all(storeName)).length;
    }
    counts[key]=total;
  }
  return counts;
}

async function openDeleteRecordsDialog(){
  await ensureDB();
  const counts=await getDeleteCounts();
  const option=(key,title,description)=>`<label class="delete-option">
    <input type="checkbox" class="delete-choice" value="${key}">
    <span><b>${title} (${counts[key]||0})</b><small>${description}</small></span>
  </label>`;
  const html=`<p>Marca únicamente la información que deseas eliminar.</p>
    <div class="delete-options">
      ${option('students','Alumnos','Borra nombres, grupos, números de lista y correos. No elimina automáticamente otros registros.')}
      ${option('attendance','Asistencias','Borra todas las fechas y estados registrados.')}
      ${option('activities','Actividades y calificaciones','Borra actividades, entregas y calificaciones numéricas.')}
      ${option('methodologies','Metodologías','Borra criterios, porcentajes, asignaciones y cálculos.')}
      ${option('titular','Seguimiento de 3.º A','Borra semanas, estados por materia y observaciones.')}
      ${option('backups','Respaldos internos','Borra únicamente las copias guardadas dentro de esta app.')}
    </div>
    <label class="delete-option">
      <input type="checkbox" id="deleteEverything">
      <span><b>Borrar todo</b><small>Selecciona todas las categorías anteriores.</small></span>
    </label>
    <div id="deleteSelectedTotal" class="delete-total">No has seleccionado registros.</div>
    <div class="actions">
      <button id="confirmDeleteRecords" class="danger" type="button" disabled>Borrar lo seleccionado</button>
    </div>`;
  showDialog('Borrar registros',html);

  const choices=[...document.querySelectorAll('.delete-choice')];
  const allBox=$('#deleteEverything');
  const button=$('#confirmDeleteRecords');
  const totalBox=$('#deleteSelectedTotal');

  const update=()=>{
    if(allBox.checked)choices.forEach(x=>x.checked=true);
    const selected=choices.filter(x=>x.checked);
    const total=selected.reduce((sum,x)=>sum+(counts[x.value]||0),0);
    totalBox.textContent=selected.length
      ?`Se eliminarán ${total} registros de ${selected.length} categorías.`
      :'No has seleccionado registros.';
    button.disabled=!selected.length;
    if(!choices.every(x=>x.checked))allBox.checked=false;
  };
  allBox.onchange=()=>{choices.forEach(x=>x.checked=allBox.checked);update()};
  choices.forEach(x=>x.onchange=update);

  button.onclick=async()=>{
    const selected=choices.filter(x=>x.checked).map(x=>x.value);
    if(!selected.length)return;
    const labels=selected.map(k=>DELETE_GROUPS[k].label).join(', ');
    const total=selected.reduce((sum,k)=>sum+(counts[k]||0),0);
    const first=confirm(`Vas a borrar:\n\n${labels}\n\nTotal aproximado: ${total} registros.\n\n¿Deseas continuar?`);
    if(!first)return;
    const typed=prompt('Para confirmar definitivamente, escribe BORRAR:');
    if(String(typed||'').trim().toUpperCase()!=='BORRAR'){
      alert('No se borró nada.');
      return;
    }
    try{
      for(const key of selected){
        for(const storeName of DELETE_GROUPS[key].stores){
          if(db.objectStoreNames.contains(storeName)){
            await req(store(storeName,'readwrite').clear());
          }
        }
      }
      if(selected.includes('backups')){
        try{localStorage.removeItem(LOCAL_BACKUP_KEY)}catch(_){}
      }
      await refreshAll();
      $('#dialog').close();
      alert('Los registros seleccionados fueron eliminados.');
    }catch(e){
      alert('No fue posible borrar los registros: '+e.message);
    }
  };
}


async function refreshQuarterSelectors(){
  if(!db||!$('#quarterShift'))return;
  let shifts=['Matutino','Vespertino'],oldShift=$('#quarterShift').value;
  $('#quarterShift').innerHTML=shifts.map(x=>`<option>${x}</option>`).join('');
  if(shifts.includes(oldShift))$('#quarterShift').value=oldShift;
  let allStudents=await students(),shift=$('#quarterShift').value,groups=uniq(allStudents.filter(s=>sameShift(s.shift,shift)).map(s=>s.group)),oldGroup=$('#quarterGroup').value;
  $('#quarterGroup').innerHTML=groups.length?groups.map(g=>`<option>${safe(g)}</option>`).join(''):'<option>Sin grupo</option>';
  if(groups.includes(oldGroup))$('#quarterGroup').value=oldGroup;
  if(!$('#quarterCycle').value)$('#quarterCycle').value=localStorage.getItem('lastSchoolCycle')||'2026-2027';
}
async function calculateQuarter(){
  let shift=$('#quarterShift').value,group=$('#quarterGroup').value,cycle=norm($('#quarterCycle').value),quarter=Number($('#quarterNumber').value);
  let methods=(await all('methodologies')).filter(m=>sameShift(m.shift,shift)&&sameGroup(m.group,group)&&String(m.cycle||'')===cycle&&Number(m.quarter||0)===quarter&&m.closed);
  methods.sort((a,b)=>MONTH_ORDER.indexOf(a.month)-MONTH_ORDER.indexOf(b.month));
  if(!methods.length){$('#quarterResults').innerHTML='<div class="empty">No hay meses cerrados para este trimestre.</div>';window._lastQuarter=null;return}
  let roster=(await students()).filter(s=>sameShift(s.shift,shift)&&sameGroup(s.group,group)),rows=roster.map(st=>{
    let monthly=methods.map(m=>({month:m.month,value:m.gradeRecords?.[st.id]?.finalDecimal??null,rounded:m.gradeRecords?.[st.id]?.rounded??null})),
        values=monthly.filter(x=>typeof x.value==='number').map(x=>x.value),
        average=values.length===methods.length?values.reduce((a,b)=>a+b,0)/values.length:null;
    return {student:st,monthly,average,rounded:average===null?null:roundSchoolGrade(average)};
  });
  window._lastQuarter={shift,group,cycle,quarter,methods,rows};
  $('#quarterResults').innerHTML=`<div class="period-summary"><b>${safe(cycle)} · Trimestre ${quarter} · ${safe(shift)} · Grupo ${safe(group)}</b><br>Meses incluidos: ${methods.map(m=>safe(m.month)).join(', ')}</div><table class="matrix"><thead><tr><th>#</th><th class="name">Alumno</th>${methods.map(m=>`<th>${safe(m.month)}</th>`).join('')}<th>Promedio decimal</th><th>Redondeada</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r.student.number}</td><td class="name">${safe(r.student.name||r.student.id)}</td>${r.monthly.map(x=>`<td>${typeof x.value==='number'?x.value.toFixed(2):'Pendiente'}</td>`).join('')}<td>${r.average===null?'Pendiente':r.average.toFixed(2)}</td><td class="grade-rounded">${r.rounded===null?'—':r.rounded}</td></tr>`).join('')}</tbody></table>`;
}
async function printQuarter(){
  let q=window._lastQuarter;if(!q){await calculateQuarter();q=window._lastQuarter}if(!q)return;
  if(!pdfReady())return alert('No se cargó el generador de PDF.');
  let {jsPDF}=window.jspdf,doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
  pdfHeader(doc,'Promedio trimestral','ESPAÑOL');
  doc.setFontSize(10);doc.text(`${q.cycle} · Trimestre ${q.quarter} · ${q.shift} · Grupo ${q.group}`,14,36);
  let head=[['#','Alumno',...q.methods.map(m=>m.month),'Promedio decimal','Redondeada']],body=q.rows.map(r=>[String(r.student.number),r.student.name||r.student.id,...r.monthly.map(x=>typeof x.value==='number'?x.value.toFixed(2):'Pendiente'),r.average===null?'Pendiente':r.average.toFixed(2),r.rounded===null?'—':String(r.rounded)]);
  doc.autoTable({startY:41,head,body,styles:{fontSize:7.5,cellPadding:1.7},headStyles:{fillColor:[245,196,0],textColor:[33,27,18]},columnStyles:{1:{cellWidth:55}}});pdfFooter(doc);
  printContent('Promedio trimestral',$('#quarterResults').innerHTML,pdfBlob(doc),`trimestre_${q.quarter}_${q.group}_${q.cycle}.pdf`);
}


const AUTH_POLICY_LOCAL={pinLength:6,maxAttempts:5,lockMinutes:10,pbkdf2Iterations:120000};

async function loadMonitorAccess(){
 const studentEl=$('#monitorStudentPin');
 const parentEl=$('#monitorParentPin');
 if(studentEl)studentEl.textContent='Consultando...';
 if(parentEl)parentEl.textContent='Consultando...';

 if(!supabaseReady){
   if(studentEl)studentEl.textContent='Protegido';
   if(parentEl)parentEl.textContent='Protegido';
   alert('Primero inicia sesión en Supabase como docente.');
   return;
 }

 try{
   const data=await ProfeSupabase.rpc('teacher_get_monitor_access',{});
   if(!data?.ok){
     throw new Error(data?.reason||'No autorizado');
   }
   if(studentEl)studentEl.textContent=String(data.student_pin||'—');
   if(parentEl)parentEl.textContent=String(data.parent_pin||'—');

   // Ocultarlos nuevamente tras 60 segundos.
   setTimeout(()=>{
     if(studentEl)studentEl.textContent='Protegido';
     if(parentEl)parentEl.textContent='Protegido';
   },60000);
 }catch(e){
   if(studentEl)studentEl.textContent='Protegido';
   if(parentEl)parentEl.textContent='Protegido';
   alert('No se pudieron consultar los PIN del monitor: '+(e.message||e));
 }
}

async function ensurePortalPinsForStudent(s){
 if(!s||!sameShift(s.shift,'Matutino'))return;
 if(supabaseReady)await ensureRemotePortalAccess(s);
}
async function getPortalAuthRecord(studentId,role){
 let local=await req(store('portalAuth').get(`${studentId}|${role}`));
 if(!supabaseReady)return local;
 try{
   const statuses=await ProfeSupabase.rpc('teacher_portal_status',{});
   const st=(statuses||[]).find(x=>String(x.student_id)===String(studentId));
   if(!st)return local;
   const prefix=role==='student'?'student':'parent';
   return {...(local||{}),id:`${studentId}|${role}`,studentId,role,mustChange:!!st[`${prefix}_must_change`],activated:!!st[`${prefix}_active`],lockedUntil:st[`${prefix}_locked_until`]?new Date(st[`${prefix}_locked_until`]).getTime():0};
 }catch(e){return local}
}
async function createOrResetPortalPin(studentId,role){
 let s=await req(store('students').get(studentId));if(!s)return;
 if(!sameShift(s.shift,'Matutino'))return alert('Los portales solo están habilitados para el turno matutino.');
 if(!supabaseReady)return alert('Inicia sesión en Supabase para generar un PIN válido para celulares de alumnos y padres.');
 try{
   await ProfeSupabase.upsert('students',remoteStudent(s),'id');
   let pin=await ProfeSupabase.rpc('teacher_reset_portal_pin',{p_student_id:String(studentId),p_role:role});
   await req(store('portalAuth','readwrite').put({id:`${studentId}|${role}`,studentId,role,tempPinReveal:String(pin),mustChange:true,lockedUntil:0,updated:new Date().toISOString()}));
   showDialog(role==='student'?'PIN temporal del alumno':'PIN temporal del padre',`<p><b>Alumno:</b> ${safe(s.name||s.id)}</p><p>Entrega este PIN únicamente a ${role==='student'?'el alumno':'su padre, madre o tutor'}.</p><div class="temp-pin-result">${safe(pin)}</div><p class="hint">Este PIN ya funciona desde cualquier celular conectado a internet. Al crear el PIN personal dejará de funcionar.</p>`);
   await renderPortalAccess(s);await renderPortalAccessReport();
 }catch(e){alert('No se pudo generar el PIN en Supabase: '+(e.message||e))}
}


async function refreshAllTemporaryPins(){
 if(!supabaseReady)return alert('Primero inicia sesión en Supabase.');
 const list=(await allStudents()).filter(s=>s.active!==false&&sameShift(s.shift,'Matutino'));
 if(!list.length)return alert('No hay alumnos matutinos activos.');
 if(!confirm(`Se generará un PIN temporal NUEVO para alumno y padre/tutor de ${list.length} alumnos.\n\nTodos los PIN anteriores dejarán de funcionar. Haz esto antes de entregar los PIN.`))return;
 const typed=prompt('Para continuar escribe ACTUALIZAR PINES:');
 if(String(typed||'').trim().toUpperCase()!=='ACTUALIZAR PINES')return alert('No se hizo ningún cambio.');
 let done=0,failed=[];
 for(const s of list){
   try{
     await ProfeSupabase.upsert('students',remoteStudent(s),'id');
     const sp=await ProfeSupabase.rpc('teacher_reset_portal_pin',{p_student_id:String(s.id),p_role:'student'});
     const pp=await ProfeSupabase.rpc('teacher_reset_portal_pin',{p_student_id:String(s.id),p_role:'parent'});
     await req(store('portalAuth','readwrite').put({id:`${s.id}|student`,studentId:s.id,role:'student',tempPinReveal:String(sp),mustChange:true,lockedUntil:0,updated:new Date().toISOString()}));
     await req(store('portalAuth','readwrite').put({id:`${s.id}|parent`,studentId:s.id,role:'parent',tempPinReveal:String(pp),mustChange:true,lockedUntil:0,updated:new Date().toISOString()}));
     done++;
   }catch(e){failed.push(`${s.name||s.id}: ${e.message||e}`)}
 }
 await renderPortalAccessReport();
 alert(`PIN actualizados: ${done}.${failed.length?`\nCon error: ${failed.length}\n${failed.slice(0,5).join('\n')}`:''}`);
}

async function generateGroupAccessPdf(){
  const group=$('#portalAccessGroupFilter')?.value||'';

  if(!group||group==='__ALL__'||group==='MONITOR'){
    return alert('Selecciona un grupo matutino específico: 22, 23, 24, 25 o 26.');
  }
  if(!supabaseReady){
    return alert('Primero inicia sesión en Supabase como docente.');
  }
  if(!pdfReady()){
    return alert('No se cargó el generador de PDF. Conéctate a internet, pulsa Actualizar app y vuelve a intentarlo.');
  }

  const localStudents=(await all('students'))
    .filter(s=>s.active!==false&&sameShift(s.shift,'Matutino')&&sameGroup(s.group,group)&&String(s.id)!=='00001')
    .sort((a,b)=>Number(a.number||999)-Number(b.number||999)||(a.name||'').localeCompare(b.name||'','es'));

  if(!localStudents.length){
    return alert(`No hay alumnos activos del grupo ${group}.`);
  }

  const warning=
`Se generarán PIN TEMPORALES NUEVOS para Mi Español y Seguimiento Familiar de ${localStudents.length} alumnos del grupo ${group}.

Los PIN anteriores y las sesiones actuales de esos alumnos/padres dejarán de funcionar.

El PDF tendrá UNA PÁGINA POR ALUMNO con ambos PIN.

¿Continuar?`;

  if(!confirm(warning))return;

  const typed=prompt(`Para confirmar escribe el grupo: ${group}`);
  if(String(typed||'').trim().toUpperCase()!==String(group).trim().toUpperCase()){
    return alert('No se generó ningún PIN.');
  }

  const btn=$('#generateGroupAccessPdf');
  const oldText=btn?.textContent||'';
  if(btn){btn.disabled=true;btn.textContent='Generando PIN y PDF...';}

  try{
    // Asegurar que los alumnos locales del grupo estén sincronizados antes de generar accesos.
    for(const s of localStudents){
      await ProfeSupabase.upsert('students',remoteStudent(s),'id');
    }

    const data=await ProfeSupabase.rpc('teacher_generate_group_access_pins',{p_group:String(group)});
    if(!data?.ok){
      if(data?.reason==='no_students')throw new Error('No se encontraron alumnos activos de ese grupo en Supabase.');
      throw new Error(data?.reason||'No se pudieron generar los accesos.');
    }

    const rows=Array.isArray(data.students)?data.students:[];
    if(!rows.length)throw new Error('Supabase no devolvió alumnos para el PDF.');

    const {jsPDF}=window.jspdf;
    const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'letter'});
    const pageW=doc.internal.pageSize.getWidth();
    const pageH=doc.internal.pageSize.getHeight();

    rows.forEach((r,i)=>{
      if(i>0)doc.addPage();

      // Encabezado
      doc.setFillColor(245,196,0);
      doc.rect(0,0,pageW,34,'F');
      doc.setFillColor(201,35,45);
      doc.rect(0,31,pageW,3,'F');
      doc.setTextColor(33,27,18);
      doc.setFont('helvetica','bold');
      doc.setFontSize(18);
      doc.text('EL AULA DEL PROFE JAIME',14,11);
      doc.setFontSize(12);
      doc.text('DATOS DE ACCESO A LOS PORTALES',14,21);
      doc.setFontSize(10);
      doc.text(`Grupo ${String(r.group_name||group)}`,14,28);

      // Alumno
      doc.setTextColor(33,27,18);
      doc.setFont('helvetica','bold');
      doc.setFontSize(14);
      doc.text(String(r.name||''),14,48);
      doc.setFont('helvetica','normal');
      doc.setFontSize(10);
      const listNo=r.list_number==null?'—':String(r.list_number);
      doc.text(`No. de lista: ${listNo}`,14,56);

      // ID
      doc.setFillColor(248,248,248);
      doc.roundedRect(14,65,pageW-28,32,4,4,'F');
      doc.setFont('helvetica','bold');
      doc.setFontSize(11);
      doc.text('ID DEL ALUMNO',pageW/2,76,{align:'center'});
      doc.setFontSize(25);
      doc.text(String(r.student_id||''),pageW/2,90,{align:'center'});

      // Student PIN
      doc.setFillColor(255,248,220);
      doc.roundedRect(14,106,pageW-28,42,4,4,'F');
      doc.setTextColor(90,65,0);
      doc.setFontSize(12);
      doc.text('MI ESPAÑOL · PIN TEMPORAL DEL ALUMNO',pageW/2,119,{align:'center'});
      doc.setFontSize(26);
      doc.text(String(r.student_pin||''),pageW/2,138,{align:'center'});

      // Parent PIN
      doc.setFillColor(255,235,235);
      doc.roundedRect(14,157,pageW-28,42,4,4,'F');
      doc.setTextColor(140,25,30);
      doc.setFontSize(12);
      doc.text('SEGUIMIENTO FAMILIAR · PIN TEMPORAL',pageW/2,170,{align:'center'});
      doc.setFontSize(26);
      doc.text(String(r.parent_pin||''),pageW/2,189,{align:'center'});

      // Instructions
      doc.setTextColor(33,27,18);
      doc.setFont('helvetica','bold');
      doc.setFontSize(10);
      doc.text('IMPORTANTE',14,215);
      doc.setFont('helvetica','normal');
      doc.setFontSize(9.5);
      const text=
        'El alumno y la familia utilizan el mismo ID, pero cada portal tiene un PIN temporal diferente. '
        +'En el primer acceso, la aplicación solicitará crear un PIN personal. '
        +'Después de crear el PIN personal, este PIN temporal deja de funcionar. '
        +'Conserve esta hoja de manera privada y entréguela únicamente al alumno y a su familia.';
      doc.text(doc.splitTextToSize(text,pageW-28),14,223);

      doc.setFontSize(8);
      doc.setTextColor(95,95,95);
      doc.text('Herramienta docente independiente. No es una aplicación oficial de SEP ni AEFCM.',14,pageH-16);
      doc.text(`Profr. Jaime Armando Pérez Vázquez · Página ${i+1} de ${rows.length}`,14,pageH-9);
    });

    const blob=pdfBlob(doc);
    const fileName=`accesos_portales_grupo_${String(group).replace(/[^a-z0-9]+/gi,'_')}.pdf`;

    // No guardar PIN en IndexedDB ni en respaldos: solo se usan para este PDF.
    const html=`<h2>Accesos a portales · Grupo ${safe(group)}</h2><p><b>${rows.length}</b> páginas generadas, una por alumno.</p><p>El PDF contiene el ID, PIN temporal de Mi Español y PIN temporal de Seguimiento Familiar de cada alumno.</p>`;
    printContent(`Accesos a portales · Grupo ${group}`,html,blob,fileName);

    await renderPortalAccessReport();
  }catch(e){
    alert('No se pudo generar el PDF de accesos: '+(e.message||e));
  }finally{
    if(btn){btn.disabled=false;btn.textContent=oldText||'📄 Generar PDF de accesos del grupo';}
  }
}

function portalAuthState(a){
 if(!a)return {key:'none',label:'⚪ No activado',cls:'gray'};
 if(Number(a.lockedUntil||0)>Date.now())return {key:'locked',label:'🔴 Acceso bloqueado',cls:'red'};
 if(a.mustChange)return {key:'temp',label:'🟡 PIN temporal generado',cls:'yellow'};
 if(a.activated||a.mustChange===false)return {key:'active',label:'🟢 Cuenta activada',cls:'green'};
 return {key:'none',label:'⚪ No activado',cls:'gray'};
}
function portalStatePill(a){
 const s=portalAuthState(a);return `<span class="access-pill ${s.cls}">${s.label}</span>`;
}
async function getStudentPortalStates(studentId){
 const sa=await getPortalAuthRecord(studentId,'student'),pa=await getPortalAuthRecord(studentId,'parent');
 return {student:sa,parent:pa,studentState:portalAuthState(sa),parentState:portalAuthState(pa)};
}
async function renderPortalAccessReport(){
 const wrap=$('#portalAccessTableWrap'),sum=$('#portalAccessSummary');if(!wrap||!sum)return;
 const groupFilter=$('#portalAccessGroupFilter')?.value||'22';
 const q=low($('#portalAccessSearch')?.value||'');

 const students=(await all('students'))
   .filter(s=>s.active!==false&&sameShift(s.shift,'Matutino'))
   .filter(s=>groupFilter==='__ALL__'||sameGroup(s.group,groupFilter))
   .filter(s=>!q||low(s.name).includes(q)||low(s.id).includes(q))
   .sort((a,b)=>(a.name||'').localeCompare(b.name||'','es'));

 let rows=[],counts={studentActive:0,studentPending:0,parentActive:0,parentPending:0};

 for(const s of students){
   const st=await getStudentPortalStates(s.id);
   if(st.studentState.key==='active')counts.studentActive++;else counts.studentPending++;
   if(st.parentState.key==='active')counts.parentActive++;else counts.parentPending++;

   rows.push(`<tr>
     <td>
       <b>${safe(s.name||'')}</b>
       <small>Grupo ${safe(s.group||'')} · ID ${safe(s.id)}</small>
     </td>
     <td>${portalStatePill(st.student)}${st.student?.mustChange&&st.student?.tempPinReveal?`<div class="pin-mini">${safe(st.student.tempPinReveal)}</div>`:''}</td>
     <td>${portalStatePill(st.parent)}${st.parent?.mustChange&&st.parent?.tempPinReveal?`<div class="pin-mini">${safe(st.parent.tempPinReveal)}</div>`:''}</td>
   </tr>`);
 }

 sum.innerHTML=`
  <div class="access-summary-box"><small>Alumnos activados</small><b>${counts.studentActive}</b></div>
  <div class="access-summary-box"><small>Alumnos pendientes</small><b>${counts.studentPending}</b></div>
  <div class="access-summary-box"><small>Familias activadas</small><b>${counts.parentActive}</b></div>
  <div class="access-summary-box"><small>Familias pendientes</small><b>${counts.parentPending}</b></div>`;

 wrap.innerHTML=students.length
   ?`<table class="access-table"><thead><tr><th>Alumno</th><th>Acceso alumno</th><th>Acceso familia</th></tr></thead><tbody>${rows.join('')}</tbody></table>`
   :'<div class="empty">No hay alumnos que coincidan con el grupo o búsqueda.</div>';
}

async function renderPortalAccess(s){
 let box=$('#portalAccessStatus');if(!box)return;
 if(s.active===false){box.innerHTML='<div class="empty">Alumno inactivo. El historial se conserva, pero el acceso a los portales está deshabilitado.</div>';return}if(!sameShift(s.shift,'Matutino')){box.innerHTML='<div class="empty">Los portales Mi Español y Seguimiento Familiar no se utilizan en el turno vespertino.</div>';return}
 let sa=await getPortalAuthRecord(s.id,'student'),pa=await getPortalAuthRecord(s.id,'parent');
 const temp=a=>a?.mustChange&&a?.tempPinReveal?`<div class="temp-pin-result">${safe(a.tempPinReveal)}</div><small>PIN temporal actual</small>`:'';
 box.innerHTML=`<div class="auth-grid">
 <div class="auth-box"><h4>👨‍🎓 Alumno</h4><div class="auth-status">${portalStatePill(sa)}</div>${temp(sa)}<button id="resetStudentPin" class="secondary" type="button">Generar nuevo PIN temporal del alumno</button></div>
 <div class="auth-box"><h4>👨‍👩‍👦 Padre / tutor</h4><div class="auth-status">${portalStatePill(pa)}</div>${temp(pa)}<button id="resetParentPin" class="secondary" type="button">Generar nuevo PIN temporal para padre/tutor</button></div></div>`;
 $('#resetStudentPin').onclick=()=>createOrResetPortalPin(s.id,'student');$('#resetParentPin').onclick=()=>createOrResetPortalPin(s.id,'parent');
}
const defaultAvailability={id:'main',days:[1,2,3,4,5],start:'12:00',end:'15:00',suspended:false,vacationStart:'',vacationEnd:'',technicalCouncilDates:[],temporaryNotice:''};

function teacherChatTodayKey(){
 const d=new Date();
 return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function renderTeacherStudentChatState(a){
 const el=$('#studentChatTeacherStatus');if(!el)return;
 const today=teacherChatTodayKey();
 const mode=a?.studentChatOverride||'auto';
 const overrideToday=String(a?.studentChatOverrideDate||'')===today;
 if(overrideToday&&mode==='open')el.innerHTML='<b>Estado:</b> 🟢 abierto manualmente durante hoy.';
 else if(overrideToday&&mode==='closed')el.innerHTML='<b>Estado:</b> 🔴 cerrado manualmente durante hoy.';
 else{
   const now=new Date(),day=now.getDay(),hm=now.toTimeString().slice(0,5);
   const open=day>=1&&day<=5&&hm<'14:00';
   el.innerHTML=`<b>Estado:</b> ${open?'🟢 abierto por horario automático':'🔴 cerrado por horario automático'}.`;
 }
}
async function setStudentChatTeacherState(state){
 try{
   if(!(await requireTeacherSession()))return;
   const token=await ProfeSupabase.token();
   const base=ProfeSupabase.SUPABASE_URL||'https://xqeyyjakmeiaahecfdmc.supabase.co';
   const apikey=ProfeSupabase.SUPABASE_PUBLISHABLE_KEY||'sb_publishable_GY2NGAigumnZw3rIJKU7LA_a2qigAEA';
   const r=await fetch(`${base}/rest/v1/rpc/teacher_set_student_chat_state`,{
     method:'POST',
     headers:{apikey,Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
     body:JSON.stringify({p_state:state})
   });
   const text=await r.text();
   let data=null;try{data=text?JSON.parse(text):null}catch{data=text}
   if(!r.ok||!data?.ok)throw new Error(data?.reason||data?.error||text||`HTTP ${r.status}`);
   let a=await req(store('availability').get('main'))||defaultAvailability;
   a.studentChatOverride=state;
   a.studentChatOverrideDate=state==='auto'?'':teacherChatTodayKey();
   await req(store('availability','readwrite').put(a));
   renderTeacherStudentChatState(a);
   alert(state==='open'?'Chat abierto manualmente durante hoy.':state==='closed'?'Chat cerrado manualmente durante hoy.':'Chat volvió al horario automático.');
 }catch(e){alert('No se pudo cambiar el estado del chat: '+(e.message||e))}
}

async function loadAvailability(){
 let a=await req(store('availability').get('main'))||defaultAvailability;
 $('#availabilityStart').value=a.start||'12:00';$('#availabilityEnd').value=a.end||'15:00';$('#vacationStart').value=a.vacationStart||'';$('#vacationEnd').value=a.vacationEnd||'';$('#technicalDates').value=(a.technicalCouncilDates||[]).join(', ');$('#temporaryNotice').value=a.temporaryNotice||'';$('#attentionSuspended').checked=!!a.suspended;
 $$('[data-weekday]').forEach(c=>c.checked=(a.days||[]).includes(Number(c.dataset.weekday)));
 renderTeacherStudentChatState(a);
 renderContactOverride(a);
}
function renderContactOverride(a){
 const open=!!a?.contactOverrideOpen;
 const btn=$('#contactOverrideBtn'),status=$('#contactOverrideStatus');
 if(btn){
   btn.textContent=open?'🔒 Restablecer horario normal':'🔓 Abrir contacto temporalmente';
   btn.className=open?'primary':'secondary';
 }
 if(status)status.textContent=open
   ? 'ABIERTO temporalmente: App padres puede contactar fuera del horario.'
   : 'Se respeta el horario normal de atención.';
}
async function toggleContactOverride(){
 try{
   if(!supabaseReady && !(await requireTeacherSession()))return;
   let a=await req(store('availability').get('main'))||defaultAvailability;
   const next=!a.contactOverrideOpen;
   a={...a,id:'main',contactOverrideOpen:next,updated:new Date().toISOString()};
   await req(store('availability','readwrite').put(a));
   await ProfeSupabase.upsert('availability',remoteAvailability(a),'id');
   renderContactOverride(a);
   alert(next
     ? 'Contacto abierto temporalmente. Los padres podrán abrir WhatsApp fuera del horario.'
     : 'Horario normal restablecido.');
 }catch(e){alert('No se pudo cambiar el contacto temporal: '+(e.message||e))}
}
async function saveAvailability(e){
 e.preventDefault();let days=$$('[data-weekday]:checked').map(x=>Number(x.dataset.weekday));
 let prev=await req(store('availability').get('main'))||defaultAvailability;
 await put('availability',{id:'main',days,start:$('#availabilityStart').value||'12:00',end:$('#availabilityEnd').value||'15:00',vacationStart:$('#vacationStart').value,vacationEnd:$('#vacationEnd').value,technicalCouncilDates:$('#technicalDates').value.split(',').map(x=>x.trim()).filter(Boolean),temporaryNotice:norm($('#temporaryNotice').value),suspended:$('#attentionSuspended').checked,contactOverrideOpen:!!prev.contactOverrideOpen,studentChatOverride:prev.studentChatOverride||'auto',studentChatOverrideDate:prev.studentChatOverrideDate||'',updated:new Date().toISOString()});alert('Disponibilidad guardada.');
}
async function savePortalEntity(type,e){
 e.preventDefault();
 let pushed=null;
 if(type==='notice'){
   const item={id:crypto.randomUUID(),group:norm($('#noticeGroup').value),title:norm($('#noticeTitle').value),text:norm($('#noticeText').value),created:new Date().toISOString(),active:true};
   await put('notices',item);
   // Confirmar persistencia remota ANTES de enviar la notificación.
   if(supabaseReady){
     await ProfeSupabase.upsert('notices',remoteNotice(item),'id');
   }else{
     throw new Error('No hay conexión con Supabase. El aviso no se publicará hasta recuperar la conexión.');
   }
   pushed={event:'new_notice',title:item.title,group:item.group};
 }
 if(type==='material'){
   const source=$('#materialSource').value;
   let material={id:crypto.randomUUID(),group:norm($('#materialGroup').value),title:norm($('#materialTitle').value),type:$('#materialType').value,source,created:new Date().toISOString(),active:true};
   if(source==='url'){
     const url=norm($('#materialUrl').value);
     if(!url)throw new Error('Escribe el enlace del material.');
     material.url=url;
   }else{
     const file=$('#materialFile').files?.[0];
     if(!file)throw new Error('Selecciona un archivo.');
     const max=20*1024*1024;
     if(file.size>max)throw new Error('Por ahora el archivo no debe superar 20 MB.');
     material.fileName=file.name;material.mime=file.type||'application/octet-stream';material.size=file.size;material.fileData=await file.arrayBuffer();material.storagePath='';
   }
   await put('materials',material);pushed={event:'new_material',title:material.title,group:material.group};
 }
 if(type==='topic'){
   const item={id:crypto.randomUUID(),group:norm($('#topicGroup').value),title:norm($('#topicTitle').value),notes:norm($('#topicNotes').value),created:new Date().toISOString(),active:true};
   await put('studyTopics',item);pushed={event:'new_topic',title:item.title,group:item.group};
 }
 e.target.reset();await refreshPortalContent();
 if(pushed)await sendTeacherPushEvent(pushed.event,{title:pushed.title,group:pushed.group||null});
}
async function refreshPortalContent(){
 const render=(id,list,fmt)=>{let box=$(id);if(!box)return;box.innerHTML=list.length?list.sort((a,b)=>String(b.created).localeCompare(String(a.created))).map(fmt).join(''):'<div class="empty">Sin publicaciones.</div>'};
 render('#noticeList',await all('notices'),x=>`<div class="mini-item"><b>${safe(x.title)}</b><small>${safe(x.group||'Todos')} · ${new Date(x.created).toLocaleDateString('es-MX')}</small><div>${safe(x.text)}</div></div>`);
 render('#materialList',await all('materials'),x=>`<div class="mini-item"><b>${safe(x.title)}</b><span class="material-source-badge">${x.source==='file'?'Archivo':'Enlace'}</span><small>${safe(x.type)} · ${safe(x.group||'Todos')}</small>${x.fileName?`<span class="material-file-name">${safe(x.fileName)} · ${(Number(x.size||0)/1024/1024).toFixed(1)} MB</span>`:''}${x.url?`<span class="material-file-name">${safe(x.url)}</span>`:''}</div>`);
 render('#topicList',await all('studyTopics'),x=>`<div class="mini-item"><b>${safe(x.title)}</b><small>${safe(x.group||'Todos')}</small></div>`);
}



const WEB_PUSH_VAPID_PUBLIC_KEY="BNPj-HUZsEtLYTsRcRdqyYIqhq4hqjRno0QmNbHhSVe5wHeBiqnVnwMx5RU8lxyz-mNhvqbjQRLqsmhqBTdZkWg";
function vapidBytes(base64String){
 const padding='='.repeat((4-base64String.length%4)%4),base64=(base64String+padding).replace(/-/g,'+').replace(/_/g,'/');
 const raw=atob(base64);return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));
}
async function syncTeacherPushSubscription(){
 if(!('serviceWorker' in navigator)||!('PushManager' in window)||Notification.permission!=='granted'||!supabaseReady)return false;
 const reg=await navigator.serviceWorker.ready;
 let sub=await reg.pushManager.getSubscription();
 if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:vapidBytes(WEB_PUSH_VAPID_PUBLIC_KEY)});
 const j=sub.toJSON();
 await ProfeSupabase.rpc('register_teacher_push',{p_endpoint:j.endpoint,p_p256dh:j.keys?.p256dh,p_auth:j.keys?.auth,p_user_agent:navigator.userAgent});
 return true;
}
async function sendTeacherPushEvent(event,body={}){
 if(!supabaseReady)return;
 try{await ProfeSupabase.edge('send-push',{event,...body})}catch(e){console.warn('push send',e)}
}
async function notifyParentActivityUpdate(activity,studentId,record){
 if(!activity||!studentId||!record||!sameShift(activity.shift,'Matutino'))return;
 const title=activity.name||'Actividad';
 let detail='';
 if(record.status==='yes')detail='Estado: Entregada';
 else if(typeof record.score==='number')detail=`Calificación: ${record.score}`;
 else return;

 await sendTeacherPushEvent('activity_update',{
   student_id:String(studentId),
   title,
   message:`${title} · ${detail}`,
   status:record.status||null,
   score:typeof record.score==='number'?record.score:null
 });
}

const TEACHER_NOTIF_KEY='profeJaimeNotificationsV78';
const TEACHER_SEEN_MSG_KEY='profeJaimeSeenMessagesV78';
let teacherPollTimer=null;
function readTeacherNotifs(){try{return JSON.parse(localStorage.getItem(TEACHER_NOTIF_KEY)||'[]')}catch{return []}}
function saveTeacherNotifs(list){localStorage.setItem(TEACHER_NOTIF_KEY,JSON.stringify(list.slice(0,100)));renderTeacherNotifBadge()}
function readSeenTeacherMessages(){try{return new Set(JSON.parse(localStorage.getItem(TEACHER_SEEN_MSG_KEY)||'[]'))}catch{return new Set()}}
function saveSeenTeacherMessages(set){localStorage.setItem(TEACHER_SEEN_MSG_KEY,JSON.stringify([...set].slice(-500)))}
function addTeacherNotification(n){
 let list=readTeacherNotifs();if(list.some(x=>x.id===n.id))return;
 list.unshift({...n,read:false,created:n.created||new Date().toISOString()});saveTeacherNotifs(list);
 showSystemNotification(n.title,n.body,'messages');
}
function renderTeacherNotifBadge(){let c=readTeacherNotifs().filter(x=>!x.read).length,el=$('#teacherNotifCount');if(!el)return;el.textContent=c;el.classList.toggle('hidden',!c)}
async function enableTeacherNotifications(){
 if(!('Notification' in window))return alert('Este navegador no admite notificaciones del sistema.');
 let p=await Notification.requestPermission();
 if(p==='granted'){try{await syncTeacherPushSubscription();alert('Notificaciones push activadas. Llegarán aunque la app esté cerrada.')}catch(e){alert('Se concedió permiso, pero no se pudo registrar el push: '+(e.message||e))}}else alert('No se concedió permiso para notificaciones.');
}
async function showSystemNotification(title,body,target='home'){
 if(!('Notification' in window)||Notification.permission!=='granted')return;
 try{
   if('serviceWorker' in navigator){
     let reg=await navigator.serviceWorker.ready;
     await reg.showNotification(title,{body,icon:'icon-profe-jaime.png',badge:'icon-profe-jaime.png',tag:'profe-'+Date.now(),data:{target}});
   }else new Notification(title,{body});
 }catch(e){console.warn('notification',e)}
}
function openTeacherNotifications(){
 let list=readTeacherNotifs();
 const body=`<div class="notification-tools"><button id="enableTeacherNotif" class="primary">Activar notificaciones del dispositivo</button><button id="markTeacherNotifRead" class="secondary">Marcar todo como leído</button></div><div class="notification-list">${list.length?list.map(n=>`<div class="notification-item ${n.read?'':'unread'}"><b>${safe(n.title)}</b><div>${safe(n.body||'')}</div><small>${new Date(n.created).toLocaleString('es-MX')}</small></div>`).join(''):'<div class="empty">No hay notificaciones.</div>'}</div>`;
 showDialog('Notificaciones',body);
 setTimeout(()=>{
   $('#enableTeacherNotif')&&($('#enableTeacherNotif').onclick=enableTeacherNotifications);
   $('#markTeacherNotifRead')&&($('#markTeacherNotifRead').onclick=()=>{let x=readTeacherNotifs().map(n=>({...n,read:true}));saveTeacherNotifs(x);openTeacherNotifications()});
 },0);
}
async function checkTeacherMessageNotifications(initial=false){
 if(!supabaseReady)return;
 try{
   const weekStart=currentChatWeekStartISO();
   const query=weekStart
     ? `select=*&sent_at=gte.${encodeURIComponent(new Date(weekStart+'T00:00:00').toISOString())}&order=sent_at.desc&limit=100`
     : 'select=*&order=sent_at.desc&limit=100';
   const remote=await ProfeSupabase.select('student_messages',query);
   let seen=readSeenTeacherMessages();
   if(!localStorage.getItem(TEACHER_SEEN_MSG_KEY)){
     (remote||[]).forEach(m=>seen.add(String(m.id)));saveSeenTeacherMessages(seen);return;
   }
   let studentsMap=new Map((await allStudents()).map(s=>[String(s.id),s]));
   for(const m of (remote||[]).slice().reverse()){
     const id=String(m.id);if(seen.has(id))continue;
     seen.add(id);
     let s=studentsMap.get(String(m.student_id));
     addTeacherNotification({id:'msg-'+id,title:'Nuevo mensaje de alumno',body:`${s?.name||m.student_id}: ${String(m.message||'').slice(0,100)}`,created:m.sent_at||m.created_at});
   }
   saveSeenTeacherMessages(seen);
 }catch(e){console.warn('poll messages',e)}
}
function startTeacherNotificationPolling(){
 if(teacherPollTimer)clearInterval(teacherPollTimer);
 checkTeacherMessageNotifications(true);
 teacherPollTimer=setInterval(()=>checkTeacherMessageNotifications(false),20000);
 renderTeacherNotifBadge();
}
async function pullRemoteStudentMessages(){
 if(!supabaseReady)return;
 try{
   const weekStart=currentChatWeekStartISO();
   const query=weekStart
     ? `select=*&sent_at=gte.${encodeURIComponent(new Date(weekStart+'T00:00:00').toISOString())}&order=sent_at.desc`
     : 'select=*&order=sent_at.desc';
   const remote=await ProfeSupabase.select('student_messages',query);
   for(const m of remote||[]){
     const local={
       id:m.id,
       studentId:m.student_id,
       category:m.category||'Otro',
       text:m.message||'',
       reply:m.teacher_reply||'',
       status:m.status||'pending',
       created:m.sent_at||m.created_at,
       repliedAt:m.replied_at||null,
       teacherRead:!!m.teacher_reply, unread:!m.teacher_reply
     };
     await req(store('studentMessages','readwrite').put(local));
   }
 }catch(e){console.warn('No se pudieron descargar mensajes de Supabase',e)}
}
async function renderTeacherMessages(){
 await pullRemoteStudentMessages();
 let list=(await all('studentMessages')).filter(chatMessageIsCurrentWeek).sort((a,b)=>String(b.created).localeCompare(String(a.created))),studentsList=await students(),names=new Map(studentsList.map(s=>[s.id,s]));
 let box=$('#teacherMessages');if(!box)return;
 box.innerHTML=list.length?list.map(m=>{let s=names.get(m.studentId);return `<div class="message-card ${m.teacherRead?'':'unread'}"><b>${safe(s?.name||m.studentId)} · ${safe(m.category||'Otro')}</b><small>${new Date(m.created).toLocaleString('es-MX')}</small><p>${safe(m.text)}</p>${m.reply?`<p><b>Respuesta:</b> ${safe(m.reply)}</p>`:`<div class="actions"><button data-reply-message="${m.id}" class="primary">Responder</button></div>`}</div>`}).join(''):'<div class="empty">No hay mensajes.</div>';
 $$('[data-reply-message]').forEach(b=>b.onclick=()=>replyStudentMessage(b.dataset.replyMessage));
}
async function replyStudentMessage(id){
 let m=await req(store('studentMessages').get(id));if(!m)return;
 let reply=prompt('Escribe la respuesta:');if(!reply)return;
 const repliedAt=new Date().toISOString();
 try{
   if(supabaseReady){
     await ProfeSupabase.rest(`student_messages?id=eq.${encodeURIComponent(id)}`,{
       method:'PATCH',
       body:{teacher_reply:reply,replied_at:repliedAt,status:'replied'},
       prefer:'return=minimal'
     });
   }
   m.reply=reply;m.repliedAt=repliedAt;m.status='replied';m.teacherRead=true;m.unread=false;await sendTeacherPushEvent('teacher_reply',{student_id:String(m.studentId),message:reply});
   await req(store('studentMessages','readwrite').put(m));
   await renderTeacherMessages();
 }catch(e){alert('No se pudo guardar la respuesta: '+(e.message||e))}
}

function updateMaterialSourceUI(){
 const source=$('#materialSource')?.value||'file';
 $('#materialFileWrap')?.classList.toggle('hidden',source!=='file');
 $('#materialUrlWrap')?.classList.toggle('hidden',source!=='url');
 if($('#materialHelp'))$('#materialHelp').textContent=source==='file'
   ?'El archivo quedará guardado localmente hasta conectar Supabase Storage.'
   :'Usa un enlace para videos, sitios web o archivos ya alojados en internet.';
}

async function decorateStudentAccessStatuses(){
 const students=(await all('students')).filter(s=>s.active!==false&&sameShift(s.shift,'Matutino'));
 for(const s of students){
   const st=await getStudentPortalStates(s.id);
   const candidates=[...document.querySelectorAll(`[data-student-id="${CSS.escape(s.id)}"],[data-id="${CSS.escape(s.id)}"]`)];
   for(const el of candidates){
     if(el.querySelector('.student-access-mini'))continue;
     const div=document.createElement('div');div.className='student-access-mini';
     div.innerHTML=`<span title="Alumno">${portalStatePill(st.student)}</span><span title="Familia">${portalStatePill(st.parent)}</span>`;
     el.appendChild(div);
   }
 }
}

async function clearLocalSchoolData(){
 const stores=[
   'students','attendance','activities','activityRecords','titularWeeks','titularRecords',
   'methodologies','notices','materials','studyTopics','studentMessages','portalReports','portalAuth'
 ];
 for(const name of stores){
   try{
     if(db?.objectStoreNames?.contains(name))await req(store(name,'readwrite').clear());
   }catch(e){console.warn('No se pudo limpiar',name,e)}
 }
 // Conservamos settings, internalBackups y availability.
}

async function resetSchoolCycle(){
 const statusEl=$('#resetCycleInlineStatus');
 const resetBtn=$('#resetCycleBtn');

 if(resetBtn)resetBtn.disabled=true;
 if(statusEl)statusEl.textContent='1/3 · Eliminando datos de Supabase...';

 try{
   const token=await ProfeSupabase.token();
   const base=ProfeSupabase.SUPABASE_URL||'https://xqeyyjakmeiaahecfdmc.supabase.co';
   const apikey=ProfeSupabase.SUPABASE_PUBLISHABLE_KEY||'sb_publishable_GY2NGAigumnZw3rIJKU7LA_a2qigAEA';

   const controller=new AbortController();
   const timeout=setTimeout(()=>controller.abort(),20000);

   let response;
   try{
     response=await fetch(`${base}/rest/v1/rpc/teacher_reset_school_data`,{
       method:'POST',
       headers:{
         apikey,
         Authorization:`Bearer ${token}`,
         'Content-Type':'application/json'
       },
       body:'{}',
       signal:controller.signal
     });
   }finally{
     clearTimeout(timeout);
   }

   const raw=await response.text();
   let data=null;
   try{data=raw?JSON.parse(raw):null}catch{data=raw}

   if(!response.ok||!data?.ok){
     throw new Error((data&&data.error)||data?.reason||raw||`HTTP ${response.status}`);
   }

   if(statusEl)statusEl.textContent='2/3 · Limpiando datos de este iPad...';
   await clearLocalSchoolData();

   if(statusEl)statusEl.textContent='3/3 · Restaurando alumno monitor...';

   // El monitor se restaura localmente de inmediato.
   // No dependemos de que la descarga desde Supabase termine en el mismo instante.
   const monitorLocal={
     id:'00001',
     name:'Alumno Monitor del Profe',
     shift:'Matutino',
     group:'MONITOR',
     number:1,
     email:'',
     guardian:'Tutor Monitor',
     phone:'',
     observations:'Cuenta permanente de monitoreo de las apps.',
     incidents:'',
     birthdate:'',
     active:true,
     updated:new Date().toISOString()
   };
   await req(store('students','readwrite').put(monitorLocal));

   // Luego intentamos refrescar desde Supabase para mantener ambos lados sincronizados.
   try{await refreshAll()}catch(e){console.warn('refreshAll post reset',e)}
   try{await refreshHome()}catch(e){console.warn('refreshHome post reset',e)}

   const monitor=await req(store('students').get('00001'));
   if(!monitor){
     throw new Error('No fue posible restaurar localmente al alumno monitor 00001.');
   }

   if(statusEl)statusEl.textContent='✅ Ciclo reiniciado. Alumno monitor 00001 conservado.';
   alert('✅ Ciclo escolar reiniciado correctamente.\n\nSe conservaron únicamente la configuración técnica y el alumno monitor 00001. Ya puedes cargar las listas del nuevo ciclo.');

 }catch(e){
   console.error('RESET ERROR',e);
   if(statusEl){
     statusEl.textContent=e?.name==='AbortError'
       ? '❌ Supabase tardó demasiado. El reinicio se detuvo.'
       : '❌ No se pudo reiniciar: '+(e.message||e);
   }
   alert('No se pudo completar el reinicio.\n\n'+(e.message||e));
 }finally{
   if(resetBtn)resetBtn.disabled=false;
 }
}

async function promptAndResetSchoolCycle(){
 const typed=window.prompt(
   '⚠️ REINICIAR CICLO ESCOLAR\n\nSe eliminarán los alumnos del ciclo terminado y sus asistencias, actividades, calificaciones, mensajes, reportes, sesiones y suscripciones push.\n\nEl alumno monitor 00001, sus accesos y la configuración técnica se conservarán.\n\nEscribe exactamente BORRAR TODO para continuar:'
 );

 if(typed===null)return;

 if(String(typed).trim()!=='BORRAR TODO'){
   alert('No se realizó ningún cambio. Debes escribir exactamente BORRAR TODO.');
   return;
 }

 const sure=window.confirm(
   'ÚLTIMA CONFIRMACIÓN\n\nEsta acción elimina permanentemente los datos del ciclo escolar terminado, excepto el alumno monitor 00001.\n\n¿Reiniciar el ciclo ahora?'
 );
 if(!sure)return;

 const statusEl=$('#resetCycleInlineStatus');
 if(statusEl)statusEl.textContent='Iniciando reinicio...';

 // Deja que Safari pinte el mensaje antes de comenzar la operación.
 await new Promise(r=>setTimeout(r,100));
 await resetSchoolCycle();
}

function bind(){
 $('#resetCycleBtn')&&($('#resetCycleBtn').onclick=promptAndResetSchoolCycle);
 $('#teacherNotifBtn')&&($('#teacherNotifBtn').onclick=openTeacherNotifications);
 $('#refreshAllPortalPins')&&($('#refreshAllPortalPins').onclick=refreshAllTemporaryPins);
 $('#closeSchoolCycleBtn')&&($('#closeSchoolCycleBtn').onclick=closeSchoolCycle);
 $('#teacherLoginBtn')&&($('#teacherLoginBtn').onclick=teacherLogin);$('#teacherLogoutBtn')&&($('#teacherLogoutBtn').onclick=teacherLogout);$('#syncSupabaseBtn')&&($('#syncSupabaseBtn').onclick=syncAllToSupabase);
 $('#refreshPortalAccessReport')&&($('#refreshPortalAccessReport').onclick=renderPortalAccessReport);
 $('#generateGroupAccessPdf')&&($('#generateGroupAccessPdf').onclick=generateGroupAccessPdf);
 $('#portalAccessGroupFilter')&&($('#portalAccessGroupFilter').onchange=renderPortalAccessReport);
 $('#portalAccessSearch')&&($('#portalAccessSearch').oninput=renderPortalAccessReport);
 setTimeout(()=>{decorateStudentAccessStatuses()},300);$$('.tab').forEach(b=>b.onclick=()=>setView(b.dataset.view));document.addEventListener('click',e=>{const menu=$('#mainMenu');if(menu?.open&&!menu.contains(e.target))menu.open=false});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#mainMenu'))$('#mainMenu').open=false});$$('[data-go]').forEach(b=>b.onclick=()=>setView(b.dataset.go));$$('[data-acttab]').forEach(b=>b.onclick=()=>pane('act',b.dataset.acttab));$$('[data-tittab]').forEach(b=>b.onclick=()=>pane('tit',b.dataset.tittab));$$('[data-mettab]').forEach(b=>b.onclick=()=>pane('met',b.dataset.mettab));for(let p of ['att','act','grid','newAct','met','calcMet'])$('#'+p+'Shift').onchange=()=>fillGroups(p);$('#attGroup').onchange=refreshAttendance;$('#attDate').onchange=refreshAttendance;$('#attRegister').onclick=registerAttendance;$('#attScan').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();registerAttendance()}};$('#attMissingBtn').onclick=showMissing;$('#attFinalizeBtn').onclick=finalizeAttendance;populateNewActivityWeeks();
$('#activityForm').onsubmit=createActivity;$('#newActDate').onchange=syncActivityWeekFromDate;$('#cancelActivityEdit').onclick=resetActivityForm;$('#actGroup').onchange=refreshActivitySelectors;$('#actWeek').onchange=refreshActivitySelectors;$('#actSelect').onchange=refreshActivityStats;$('#actRegister').onclick=registerActivity;$('#actScan').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();registerActivity()}};$('#actClose').onclick=()=>closeActivity(true);$('#actReopen').onclick=()=>closeActivity(false);$('#gridGroup').onchange=refreshGridWeeks;$('#gridWeek').onchange=renderActivityGrid;$('#gridPdf').onclick=showWeeklyReportOptions;$('#addCriterionBtn').onclick=()=>addCriterion();$('#methodologyForm').onsubmit=saveMethodology;$('#cancelMethodologyEdit').onclick=resetMethodologyForm;$('#calcMetGroup').onchange=refreshCalculationMethodologies;$('#calcMethodology').onchange=renderMethodologyAssignments;$('#saveAssignmentsBtn').onclick=saveAssignments;$('#calculateMethodologyBtn').onclick=calculateMethodology;$('#methodologyPdfBtn').onclick=printMethodology;$('#methodologyIndividualPdfBtn').onclick=printMethodologyIndividuals;$('#closeMethodologyMonthBtn').onclick=toggleCloseMethodologyMonth;$('#newMethodologyMonthBtn').onclick=()=>startNewMonth();$('#quarterShift').onchange=refreshQuarterSelectors;$('#quarterGroup').onchange=()=>{};$('#calculateQuarterBtn').onclick=calculateQuarter;$('#quarterPdfBtn').onclick=printQuarter;$('#studentForm').onsubmit=saveStudent;$('#studentSearch').oninput=renderStudents;$('#studentGroupFilter')&&($('#studentGroupFilter').onchange=renderStudents);$('#dossierGroup')&&($('#dossierGroup').onchange=()=>refreshDossierSelector());$('#dossierStudent').onchange=e=>renderDossier(e.target.value);
 $('#openMonitorDossier').onclick=async()=>{
   setView('dossier');
   if($('#dossierGroup'))$('#dossierGroup').value='MONITOR';
   await refreshDossierSelector('00001');
 };
 $('#openMonitorPortals').onclick=async()=>{
   setView('portal-access');
   if($('#portalAccessGroupFilter'))$('#portalAccessGroupFilter').value='MONITOR';
   if($('#portalAccessSearch'))$('#portalAccessSearch').value='00001';
   await renderPortalAccessReport();
 };
$('#studentFile').onchange=e=>{if(e.target.files[0])importStudents(e.target.files[0]);e.target.value=''};$('#templateBtn').onclick=()=>download('plantilla_alumnos_minima.csv','ID del alumno,Turno,Grupo,No. de lista,Nombre y primer apellido,Cumpleaños día,Cumpleaños mes,Observaciones,Incidencias\\n22001,Matutino,22,1,Sofía Hernández,14,3,,','text/csv');$('#backupBtn').onclick=()=>saveInternal();$('#saveAllTop').onclick=()=>saveInternal();$('#homeSaveAll').onclick=()=>saveInternal();$('#saveAllReports').onclick=()=>saveInternal();$('#homeRestoreInternal').onclick=restoreInternal;$('#restoreInternalBtn').onclick=restoreInternal;$('#updateAppBtn').onclick=forceUpdate;$('#exportBackupTrigger').onclick=exportBackup;
$('#homeExportBackup').onclick=exportBackup;
$('#reportsExportBackup').onclick=exportBackup;
$('#openDeleteRecords').onclick=openDeleteRecordsDialog;
$('#materialSource').onchange=updateMaterialSourceUI;updateMaterialSourceUI();
$$('.meritNav').forEach(b=>b.onclick=()=>meritPane(b.dataset.meritPane));
 $('#meritPeriodForm').onsubmit=saveMeritPeriod;$('#meritStaffForm').onsubmit=addMeritStaff;
 $('#meritRefreshRanking').onclick=loadMeritRanking;$('#meritRefreshMovements').onclick=loadMeritMovements;$('#meritRefreshStaff').onclick=loadMeritStaff;
 $('#meritRankingPeriod').onchange=loadMeritRanking;$('#meritMovementPeriod').onchange=loadMeritMovements;$('#meritWeeklyPeriod').onchange=meritWeeklyPreview;
 $$('.meritGrade').forEach(b=>b.onclick=()=>{meritGradeFilter=b.dataset.grade;$$('.meritGrade').forEach(x=>x.classList.toggle('active',x===b));renderMeritRanking()});
 $('#meritPreviewWeekly').onclick=meritWeeklyPreview;$('#meritPublishWeekly').onclick=publishMeritWeekly;$('#meritFreezePublic').onclick=()=>setMeritPublicState('frozen');$('#meritProcessPublic').onclick=()=>setMeritPublicState('results_in_process');$('#meritOpenPublic').onclick=()=>setMeritPublicState('open');
 $('#availabilityForm').onsubmit=saveAvailability;
 $('#studentAppHoursForm').onsubmit=saveStudentAppHours;
 $('#refreshStudentAppHours').onclick=loadStudentAppHours;
 $$('.studentTempOpen').forEach(b=>b.onclick=()=>openStudentAppTemporarily(Number(b.dataset.minutes)));
 $('#cancelStudentTempOpen').onclick=()=>openStudentAppTemporarily(0);
 $('#contactOverrideBtn').onclick=toggleContactOverride;
 $('#openStudentChatToday').onclick=()=>setStudentChatTeacherState('open');
 $('#closeStudentChatToday').onclick=()=>setStudentChatTeacherState('closed');
 $('#autoStudentChat').onclick=()=>setStudentChatTeacherState('auto');$('#noticeForm').onsubmit=e=>savePortalEntity('notice',e);$('#materialForm').onsubmit=e=>savePortalEntity('material',e);$('#topicForm').onsubmit=e=>savePortalEntity('topic',e);
const bindRestoreInput=id=>{$('#'+id).onchange=e=>{if(e.target.files[0])restore(e.target.files[0]);e.target.value=''}};
bindRestoreInput('restoreFile');
bindRestoreInput('homeRestoreFile');
bindRestoreInput('reportsRestoreFile');$('#attPdfRange').onclick=printAttendanceRange;$('#scheduleForm').onsubmit=saveScheduleItem;$('#scheduleCancelEdit').onclick=resetScheduleForm;$('#schedulePauseToday').onclick=pauseScheduleToday;$('#scheduleEnablePush').onclick=enableSchedulePush;$('#cancelEdit').onclick=()=>{$('#studentForm').reset();$('#editId').value='';$('#studentTitle').textContent='Agregar alumno';$('#cancelEdit').classList.add('hidden')};$('#titSaveAll').onclick=saveTitularWeek;['titPeriod','titMonth','titWeek','titLabel'].forEach(id=>$('#'+id).onchange=renderTitularGrid);$('#titStudent').onchange=renderTitPreview;$('#titSavedWeek').onchange=renderTitPreview;$('#titPdf').onclick=printTitular;$('#titEmail').onclick=openTitularEmailDialog;$('#weeklyReportShortcut').onclick=()=>setView('activities');$('#attendanceReport').onclick=printAttendance;$('#titularReportShortcut').onclick=()=>{setView('titular');pane('tit','individual')};$('#dialogClose').onclick=()=>$('#dialog').close();window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('#installBtn').classList.remove('hidden')});$('#installBtn').onclick=async()=>{if(deferredPrompt){deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null}}}
window.addEventListener('message',e=>{if(e.data?.type==='OPEN_PUSH_TARGET'){let t=e.data.target;if(t==='messages')showPage('messages');else showPage('home')}});
(async()=>{try{$('#attDate').value=$('#newActDate').value=today();$('#attReportFrom').value=$('#attReportTo').value=today();$('#titMonth').innerHTML=['Agosto','Septiembre','Octubre','Noviembre','Diciembre','Enero','Febrero','Marzo','Abril','Mayo','Junio'].map(x=>`<option>${x}</option>`).join('');bind();fillBirthdayDayOptions();await openDB();await requireTeacherSession();startTeacherNotificationPolling();if(Notification.permission==='granted')syncTeacherPushSubscription().catch(()=>{});await fillSelectors();await refreshHome();await refreshActivitySelectors();await refreshGridWeeks();await refreshTitIndividual();resetMethodologyForm();await refreshMethodologyUI();await refreshQuarterSelectors();if('serviceWorker'in navigator){let reg=await navigator.serviceWorker.register('service-worker.js?v=8170');reg.update().catch(()=>{})}await showLastInternalSave();$('#attScan').focus()}catch(e){console.error(e);alert('La app no pudo iniciar correctamente. Tus registros pueden seguir almacenados. Cierra todas las ventanas de la app y vuelve a abrirla. Detalle: '+(e?.message||e))}})()

// ===== Mérito Gabino A. Palma · ajustes administrativos v8.16.4 =====
let meritPeriodsCacheV8151=[];
let meritStaffCacheV8151=[];

function meritMonthNameV8151(n){
  return ['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][Number(n)]||String(n||'');
}
function meritIsoDateV8151(v){
  if(!v)return '';
  return String(v).slice(0,10);
}

async function meritLoadPeriodsV8151(){
  try{
    const rows=await ProfeSupabase.rpc('teacher_merit_periods',{});
    meritPeriodsCacheV8151=Array.isArray(rows)?rows:[];
    meritDecoratePeriodTableV8151();
  }catch(e){console.warn('merit periods v8151',e)}
}
function meritDecoratePeriodTableV8151(){
  const cards=[...document.querySelectorAll('section,div')].filter(el=>{
    const t=(el.textContent||'').trim();
    return t.includes('Configuración') && t.includes('Periodo') && t.includes('Fechas');
  });
  const root=cards[0]||document;
  const table=root.querySelector('table');
  if(!table)return;

  // Add actions header once
  const hr=table.querySelector('thead tr');
  if(hr && ![...hr.children].some(x=>x.textContent.trim()==='Acciones')){
    const th=document.createElement('th');th.textContent='Acciones';hr.appendChild(th);
  }

  [...table.querySelectorAll('tbody tr')].forEach(tr=>{
    if(tr.dataset.meritEditReady==='1')return;
    const txt=tr.textContent||'';
    const p=meritPeriodsCacheV8151.find(x=>txt.includes(x.label||''));
    if(!p)return;
    const td=document.createElement('td');
    td.innerHTML='<div class="merit-inline-actions"><button type="button" class="secondary">Editar</button></div>';
    td.querySelector('button').onclick=()=>meritOpenPeriodEditV8151(p.id);
    tr.appendChild(td);tr.dataset.meritEditReady='1';
  });
}

function meritOpenPeriodEditV8151(id){
  const p=meritPeriodsCacheV8151.find(x=>String(x.id)===String(id));
  if(!p)return alert('No se encontró el periodo.');
  $('#meritEditPeriodId').value=p.id;
  $('#meritEditPeriodCycle').value=p.school_year||'';
  $('#meritEditPeriodMonth').value=meritMonthNameV8151(p.month_number);
  $('#meritEditPeriodLabel').value=p.label||'';
  $('#meritEditPeriodStart').value=meritIsoDateV8151(p.starts_at);
  $('#meritEditPeriodEnd').value=meritIsoDateV8151(p.ends_at);
  $('#meritEditPeriodStatus').textContent='';
  $('#meritEditPeriodDialog').showModal();
}
async function meritSavePeriodEditV8151(){
  const p=meritPeriodsCacheV8151.find(x=>String(x.id)===String($('#meritEditPeriodId').value));
  if(!p)return;
  const label=$('#meritEditPeriodLabel').value.trim();
  const start=$('#meritEditPeriodStart').value;
  const end=$('#meritEditPeriodEnd').value;
  if(!label||!start||!end)return $('#meritEditPeriodStatus').textContent='Completa todos los campos.';
  if(end<start)return $('#meritEditPeriodStatus').textContent='La fecha de fin no puede ser anterior al inicio.';
  try{
    const d=await ProfeSupabase.rpc('teacher_merit_save_period',{
      p_school_year:p.school_year,
      p_month_number:Number(p.month_number),
      p_label:label,
      p_starts_at:start,
      p_ends_at:end,
      p_status:p.status||'open'
    });
    if(!d?.ok)throw new Error(d?.reason||'No se pudo guardar.');
    $('#meritEditPeriodStatus').textContent='✓ Periodo actualizado correctamente.';
    setTimeout(()=>$('#meritEditPeriodDialog').close(),450);
    if(typeof meritLoadConfiguration==='function')await meritLoadConfiguration();
    if(typeof meritLoadPeriods==='function')await meritLoadPeriods();
    await meritLoadPeriodsV8151();
  }catch(e){
    $('#meritEditPeriodStatus').textContent='No se pudo guardar: '+(e.message||e);
  }
}

async function meritLoadStaffV8151(){
  try{
    const rows=await ProfeSupabase.rpc('teacher_merit_staff',{});
    meritStaffCacheV8151=Array.isArray(rows)?rows:[];
    meritDecorateStaffTableV8151();
  }catch(e){console.warn('merit staff v8151',e)}
}
function meritDecorateStaffTableV8151(){
  const root=[...document.querySelectorAll('section,div')].find(el=>{
    const t=(el.textContent||'').trim();
    return t.includes('Docentes autorizados') && t.includes('Dispositivos') && t.includes('Acciones');
  })||document;
  const table=root.querySelector('table');
  if(!table)return;

  [...table.querySelectorAll('tbody tr')].forEach(tr=>{
    if(tr.dataset.meritStaffEditReady==='1')return;
    const cells=[...tr.children];
    const name=(cells[0]?.textContent||'').trim();
    const st=meritStaffCacheV8151.find(x=>x.display_name===name);
    if(!st)return;
    const actionCell=cells[cells.length-1];
    if(!actionCell)return;
    const wrap=document.createElement('div');
    wrap.className='merit-inline-actions';
    const edit=document.createElement('button');
    edit.type='button';edit.className='secondary';edit.textContent='Editar';
    edit.onclick=()=>meritOpenStaffEditV8151(st.id);
    wrap.appendChild(edit);

    if(st.active===false){
      const archive=document.createElement('button');
      archive.type='button';archive.className='secondary';archive.textContent='Eliminar de la lista';
      archive.onclick=()=>meritArchiveStaffV8151(st.id,st.display_name);
      wrap.appendChild(archive);
    }
    actionCell.appendChild(wrap);
    tr.dataset.meritStaffEditReady='1';
  });
}
function meritOpenStaffEditV8151(id){
  const st=meritStaffCacheV8151.find(x=>String(x.id)===String(id));
  if(!st)return alert('No se encontró el docente.');
  $('#meritEditStaffId').value=st.id;
  $('#meritEditStaffName').value=st.display_name||'';
  $('#meritEditStaffRole').value=st.role_type||'docente';
  $('#meritEditStaffSubject').value=st.subject_area||'';
  $('#meritEditStaffStatus').textContent='';
  $('#meritEditStaffDialog').showModal();
}
async function meritSaveStaffEditV8151(){
  const id=$('#meritEditStaffId').value;
  const name=$('#meritEditStaffName').value.trim();
  if(!name)return $('#meritEditStaffStatus').textContent='Escribe el nombre.';
  try{
    const d=await ProfeSupabase.rpc('teacher_merit_update_staff',{
      p_staff_id:id,
      p_display_name:name,
      p_role_type:$('#meritEditStaffRole').value,
      p_subject_area:$('#meritEditStaffSubject').value.trim()||null
    });
    if(!d?.ok)throw new Error(d?.reason||'No se pudo guardar.');
    $('#meritEditStaffStatus').textContent='✓ Datos actualizados correctamente.';
    setTimeout(()=>$('#meritEditStaffDialog').close(),450);
    if(typeof meritLoadStaff==='function')await meritLoadStaff();
    await meritLoadStaffV8151();
  }catch(e){$('#meritEditStaffStatus').textContent='No se pudo guardar: '+(e.message||e)}
}
async function meritArchiveStaffV8151(id,name){
  if(!confirm(`¿Eliminar a ${name} de la lista?\n\nSu historial de movimientos se conservará para auditoría.`))return;
  try{
    const d=await ProfeSupabase.rpc('teacher_merit_archive_staff',{p_staff_id:id});
    if(!d?.ok)throw new Error(d?.reason||'No se pudo archivar.');
    if(typeof meritLoadStaff==='function')await meritLoadStaff();
    await meritLoadStaffV8151();
  }catch(e){alert('No se pudo eliminar de la lista: '+(e.message||e))}
}

document.addEventListener('DOMContentLoaded',()=>{
  $('#meritCancelEditPeriod')&&($('#meritCancelEditPeriod').onclick=()=>$('#meritEditPeriodDialog').close());
  $('#meritSaveEditPeriod')&&($('#meritSaveEditPeriod').onclick=meritSavePeriodEditV8151);
  $('#meritCancelEditStaff')&&($('#meritCancelEditStaff').onclick=()=>$('#meritEditStaffDialog').close());
  $('#meritSaveEditStaff')&&($('#meritSaveEditStaff').onclick=meritSaveStaffEditV8151);

  // Observe SPA changes and decorate after original module renders.
  const obs=new MutationObserver(()=> {
    if(document.body.textContent.includes('Mérito Gabino A. Palma')){
      meritLoadPeriodsV8151();
      meritLoadStaffV8151();
    }
  });
  obs.observe(document.body,{subtree:true,childList:true});
  setTimeout(()=>{meritLoadPeriodsV8151();meritLoadStaffV8151()},1200);
});


// ===== MÉRITO GABINO A. PALMA · CIERRE FINAL v8.16.4 =====
let meritClosePreviewCache=null;
let meritAnnualCache=[];
let meritAnnualGrade='all';

function meritCandidateText(a,key){
 return (a||[]).map(x=>`Grupo ${safe(x.group_code)} (${Number(x[key]||0)})`).join(', ');
}
function meritBuildTieInputs(preview){
 const box=$('#meritTieResolutions');if(!box)return;
 const cards=[];
 const overall=preview?.overall;
 if(overall?.tied){
   cards.push({key:'overall',title:'Ganador general',candidates:overall.candidates||[]});
 }
 Object.entries(preview?.categories||{}).forEach(([key,c])=>{
   if(c?.tied)cards.push({key,title:meritCriterionLabels[key]||key,candidates:c.candidates||[]});
 });
 if(!cards.length){box.innerHTML='';return}
 box.innerHTML=`<h3>⚠️ Empates por resolver</h3><p class="hint">Elige únicamente entre los grupos empatados y escribe cómo se resolvió.</p>`+
 cards.map(c=>`<div class="merit-tie-card" data-key="${safe(c.key)}"><h3>${safe(c.title)}</h3>
 <label>Grupo ganador<select class="meritTieGroup"><option value="">Selecciona…</option>${c.candidates.map(x=>`<option value="${safe(x.group_code)}">Grupo ${safe(x.group_code)}</option>`).join('')}</select></label>
 <label>Nota de desempate<textarea class="meritTieNote" rows="2" placeholder="Ej. Desempate definido por..."></textarea></label></div>`).join('');
}
function meritCollectResolutions(){
 const r={};
 $$('#meritTieResolutions .merit-tie-card').forEach(card=>{
   const key=card.dataset.key;
   const group=card.querySelector('.meritTieGroup')?.value||'';
   const note=card.querySelector('.meritTieNote')?.value.trim()||'';
   if(group||note)r[key]={group,note};
 });
 return r;
}
async function loadMeritMonthlyPreview(){
 const period=$('#meritMonthlyPeriod')?.value;
 if(!period){
   $('#meritMonthlyStatus').textContent='Selecciona un periodo antes de generar la vista previa.';
   return;
 }
 $('#meritMonthlyStatus').textContent='Calculando vista previa…';
 $('#meritMonthlyPreview').innerHTML='<p class="hint">Consultando los movimientos del periodo…</p>';
 try{
   const p=await meritRpc('teacher_merit_close_preview',{p_period_id:period});
   if(!p || p.ok===false) throw new Error(p?.reason||'La vista previa no devolvió información.');
   meritClosePreviewCache=p;
   const overall=p.overall||{};
   const cats=p.categories||{};
   const html =
   `<div class="merit-result-hero"><div class="hint">Primer lugar general provisional</div><div class="winner">${overall.tied?'⚠️ EMPATE':`Grupo ${safe(overall.candidates?.[0]?.group_code||'—')}`}</div><div>${Number(overall.top_score||0)} puntos</div>${overall.tied?`<p>Empatados: ${meritCandidateText(overall.candidates,'score')}</p>`:''}</div>
   <h3>Reconocimientos del mes</h3><div class="merit-category-grid">${Object.entries(cats).map(([key,c])=>{
      let value='Sin ganador';
      if(!c.no_award){
        value=c.tied?'⚠️ Empate':`Grupo ${safe(c.candidates?.[0]?.group_code||'—')}`;
      }
      return `<div class="merit-category-card"><b>${safe(meritCriterionLabels[key]||key)}</b><div>${value}</div><div class="hint">${Number(c.top_count||0)} registros</div>${c.tied?`<small>${safe(meritCandidateText(c.candidates,'count'))}</small>`:''}</div>`;
   }).join('')}</div>`;
   $('#meritMonthlyPreview').innerHTML=html;
   meritBuildTieInputs(p);
   $('#meritMonthlyStatus').textContent=p.has_ties
     ?'Vista previa lista. Hay empates que deberán resolverse antes de cerrar.'
     :'✓ Vista previa lista.';
 }catch(e){
   $('#meritMonthlyStatus').textContent='No se pudo generar la vista previa: '+(e.message||e);
   $('#meritMonthlyPreview').innerHTML='';
 }
}
async function closeMeritMonth(){
 const period=$('#meritMonthlyPeriod')?.value;
 if(!period)return;
 if(!meritClosePreviewCache||String(meritClosePreviewCache.period_id)!==String(period))await loadMeritMonthlyPreview();
 const resolutions=meritCollectResolutions();
 if(!confirm('¿Cerrar este mes? Después del cierre ya no se usarán movimientos vivos para el acumulado anual.'))return;
 try{
   const d=await meritRpc('teacher_merit_close_month',{p_period_id:period,p_resolutions:resolutions});
   if(!d?.ok){
     if(d?.reason==='ties_require_resolution'){
       $('#meritMonthlyStatus').textContent='Debes resolver todos los empates y escribir una nota antes de cerrar.';
       return;
     }
     throw new Error(d?.reason||'No se pudo cerrar el mes.');
   }
   alert(`✓ Mes cerrado correctamente.\nGanador general: Grupo ${d.overall_winner}\n${d.overall_score} puntos`);
   $('#meritMonthlyStatus').textContent='✓ Mes cerrado. El portal quedó en “Resultados en proceso”.';
   await loadMeritPeriods();
   await loadMeritMonthlyResult();
 }catch(e){$('#meritMonthlyStatus').textContent='No se pudo cerrar: '+(e.message||e)}
}
async function loadMeritMonthlyResult(){
 const period=$('#meritMonthlyPeriod')?.value;if(!period)return;
 try{
   const d=await meritRpc('teacher_merit_monthly_result',{p_period_id:period});
   if(!d?.overall){$('#meritMonthlyResult').innerHTML='';return}
   $('#meritMonthlyResult').innerHTML=`<hr><h3>Resultado guardado</h3><div class="merit-result-hero"><div class="winner">🏆 Grupo ${safe(d.overall.group||'—')}</div><div>${Number(d.overall.score||0)} puntos</div></div>
   <div class="merit-category-grid">${(d.categories||[]).map(c=>`<div class="merit-category-card"><b>${safe(meritCriterionLabels[c.criterion]||c.criterion)}</b><div>${c.group?`Grupo ${safe(c.group)}`:'Sin ganador'}</div><div class="hint">${Number(c.count||0)} registros</div></div>`).join('')}</div>`;
 }catch(e){console.warn(e)}
}
async function publishMeritMonth(){
 const period=$('#meritMonthlyPeriod')?.value;if(!period)return;
 if(!confirm('¿Publicar el resultado oficial de este mes en el portal público?'))return;
 try{
   const d=await meritRpc('teacher_merit_publish_monthly_official',{p_period_id:period});
   if(!d?.ok)throw new Error(d?.reason||'No se pudo publicar.');
   alert('✓ Resultado oficial publicado.');
   $('#meritMonthlyStatus').textContent='✓ Resultado oficial publicado en el portal.';
   await loadMeritPeriods();
   await loadMeritMonthlyResult();
 }catch(e){$('#meritMonthlyStatus').textContent='No se pudo publicar: '+(e.message||e)}
}
async function loadMeritAnnualRanking(){
 try{
   const cycle=$('#meritAnnualCycle')?.value.trim()||'2026-2027';
   meritAnnualCache=await meritRpc('teacher_merit_annual_ranking',{p_cycle:cycle})||[];
   renderMeritAnnualRanking();
 }catch(e){$('#meritAnnualTable').innerHTML=`<p class="message">No se pudo cargar el acumulado: ${safe(e.message||e)}</p>`}
}
function renderMeritAnnualRanking(){
 const rows=(meritAnnualCache||[]).filter(x=>meritAnnualGrade==='all'||String(x.grade)===meritAnnualGrade);
 $('#meritAnnualTable').innerHTML=rows.length?`<table><thead><tr><th>Lugar</th><th>Grupo</th><th>Grado</th><th>Puntos acumulados</th><th>Meses cerrados</th></tr></thead><tbody>${rows.map(x=>`<tr><td><b>${Number(x.rank)}.º</b></td><td><b>${safe(x.group_code)}</b></td><td>${Number(x.grade)}.º</td><td>${Number(x.annual_score||0)}</td><td>${Number(x.months_closed||0)}</td></tr>`).join('')}</tbody></table>`:'<p class="hint">Aún no hay meses cerrados en este ciclo escolar.</p>';
}

document.addEventListener('DOMContentLoaded',()=>{
 $('#meritMonthlyPeriod')&&($('#meritMonthlyPeriod').onchange=()=>{meritClosePreviewCache=null;$('#meritTieResolutions').innerHTML='';$('#meritMonthlyResult').innerHTML='';loadMeritMonthlyPreview();loadMeritMonthlyResult()});
 $$('.meritAnnualGrade').forEach(b=>b.onclick=()=>{meritAnnualGrade=b.dataset.grade;$$('.meritAnnualGrade').forEach(x=>x.classList.toggle('active',x===b));renderMeritAnnualRanking()});
});


// ===== MÉRITO · ELIMINAR PERIODO v8.16.4 =====
async function deleteMeritPeriodV8164(id,label){
  const typed=prompt(
`ELIMINAR PERIODO

Vas a eliminar "${label}".

También se eliminarán los movimientos, reconocimientos y cortes semanales pertenecientes únicamente a este periodo.

Los periodos cerrados o publicados están protegidos.

Para confirmar, escribe exactamente:
${label}`
  );

  if(typed===null)return;

  if(typed.trim()!==label){
    alert('No se eliminó. El nombre escrito no coincide exactamente con el periodo.');
    return;
  }

  if(!confirm(`Última confirmación: ¿eliminar definitivamente "${label}"?`))return;

  try{
    const d=await meritRpc('teacher_merit_delete_period',{
      p_period_id:id,
      p_confirm_label:typed.trim()
    });

    if(!d?.ok){
      if(d?.reason==='historical_period_protected'){
        alert('Este periodo ya está cerrado o publicado y está protegido. No puede eliminarse.');
        return;
      }
      if(d?.reason==='confirmation_mismatch'){
        alert('El nombre de confirmación no coincide.');
        return;
      }
      throw new Error(d?.message||d?.reason||'No se pudo eliminar.');
    }

    alert(
`✓ Periodo eliminado correctamente.

Periodo: ${d.label}
Movimientos eliminados: ${Number(d.movements_deleted||0)}
Cortes semanales eliminados: ${Number(d.weekly_publications_deleted||0)}`
    );

    meritClosePreviewCache=null;
    await loadMeritPeriods();
    await meritLoadPeriodsV8151();
    if(typeof loadMeritRanking==='function') await loadMeritRanking();
  }catch(e){
    alert('No se pudo eliminar el periodo: '+(e.message||e));
  }
}
