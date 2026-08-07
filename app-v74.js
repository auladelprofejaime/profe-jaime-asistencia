const DB='ProfeJaimeAsistenciaDB',VER=4;
const subjects=['Artes','Inglés','Español','Matemáticas','Formación Cívica y Ética','Formación Humana','Química','Educación Física','Historia'];
const states=['white','green','yellow','red'];
const stateText={white:'⚪ Sin información',green:'🟢 Al corriente',yellow:'🟡 Requiere atención',red:'🔴 Atención urgente'};let db,deferredPrompt;const LOCAL_BACKUP_KEY='ProfeJaimeControlEscolar_backup_interno';const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];const norm=v=>String(v??'').trim(),low=v=>norm(v).toLowerCase(),today=()=>new Date().toISOString().slice(0,10),safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const req=r=>new Promise((ok,no)=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});function store(n,m='readonly'){if(!db)throw new Error('La base de datos todavía no está abierta. Cierra y vuelve a abrir la app.');return db.transaction(n,m).objectStore(n)}const all=n=>req(store(n).getAll()),put=(n,v)=>req(store(n,'readwrite').put(v)),del=(n,k)=>req(store(n,'readwrite').delete(k)),clear=n=>req(store(n,'readwrite').clear());
const REQUIRED_STORES={students:'id',attendance:'key',activities:'id',activityRecords:'key',titularWeeks:'id',titularRecords:'key',settings:'key',internalBackups:'id',methodologies:'id',availability:'id',notices:'id',materials:'id',studyTopics:'id',studentMessages:'id',portalReports:'id',portalAuth:'id'};
function createMissingStores(database){for(const [name,keyPath] of Object.entries(REQUIRED_STORES))if(!database.objectStoreNames.contains(name))database.createObjectStore(name,{keyPath})}
function openAtVersion(version){return new Promise((ok,no)=>{const r=indexedDB.open(DB,version);r.onupgradeneeded=e=>createMissingStores(e.target.result);r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);r.onblocked=()=>no(new Error('La base de datos está bloqueada por otra ventana de la app. Cierra otras ventanas y vuelve a intentarlo.'))})}
async function openDB(){if(db)return db;let current=await new Promise((ok,no)=>{const r=indexedDB.open(DB);r.onupgradeneeded=e=>createMissingStores(e.target.result);r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);r.onblocked=()=>no(new Error('La base de datos está bloqueada por otra ventana de la app.'))});const missing=Object.keys(REQUIRED_STORES).filter(n=>!current.objectStoreNames.contains(n));if(missing.length){const next=current.version+1;current.close();current=await openAtVersion(next)}db=current;db.onversionchange=()=>{try{db.close()}catch(e){}db=null};return db}
async function ensureDB(){if(!db)await openDB();return db}
const alpha=(a,b)=>norm(a.name||a.id).localeCompare(norm(b.name||b.id),'es',{sensitivity:'base',numeric:true});const students=async()=>((await all('students')).sort((a,b)=>a.shift.localeCompare(b.shift,'es',{sensitivity:'base'})||String(a.group).localeCompare(String(b.group),'es',{numeric:true,sensitivity:'base'})||alpha(a,b)));const uniq=a=>[...new Set(a.filter(Boolean))].sort((x,y)=>String(x).localeCompare(String(y),undefined,{numeric:true}));const canonShift=v=>low(v).replace(/\s+/g,'');const canonGroup=v=>norm(v).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[º°\.\-\s]/g,'');const sameShift=(a,b)=>canonShift(a)===canonShift(b);const sameGroup=(a,b)=>canonGroup(a)===canonGroup(b);const activitySort=(a,b)=>Number(a.order??Number.MAX_SAFE_INTEGER)-Number(b.order??Number.MAX_SAFE_INTEGER)||String(a.date||'').localeCompare(String(b.date||''))||String(a.name||'').localeCompare(String(b.name||''),'es',{sensitivity:'base'});

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

function setView(id){
  $$('.view').forEach(v=>v.classList.toggle('active',v.id===id));
  $$('.tab').forEach(b=>b.classList.toggle('active',b.dataset.view===id));
  const names={
    home:'Inicio',
    attendance:'Asistencia',
    activities:'Actividades',
    methodologies:'Metodologías',
    titular:'Seguimiento 3.º A',
    students:'Alumnos',
    dossier:'Expediente del alumno',
    reports:'Reportes',availability:'Disponibilidad',content:'Contenido',messages:'Mensajes'
  };
  if($('#currentSection'))$('#currentSection').textContent=names[id]||'Menú';
  if($('#mainMenu'))$('#mainMenu').open=false;
  if(id==='home')refreshHome();
  if(id==='attendance')refreshAttendance();
  if(id==='activities')refreshActivitySelectors();
  if(id==='methodologies')refreshMethodologyUI();
  if(id==='titular')renderTitularGrid();
  if(id==='students')renderStudents();
  if(id==='dossier')refreshDossierSelector();
  if(id==='reports'){}if(id==='availability')loadAvailability();if(id==='content')refreshPortalContent();if(id==='messages')renderTeacherMessages();
}
function pane(prefix,name){$$('.'+prefix+'pane').forEach(x=>x.classList.toggle('active',x.id===prefix+'-'+name));$$('[data-'+prefix+'tab]').forEach(x=>x.classList.toggle('active',x.dataset[prefix+'tab']===name));if(prefix==='act'){if(name==='grid')renderActivityGrid();if(name==='manage')renderActivities()}if(prefix==='tit'&&name==='individual')refreshTitIndividual();if(prefix==='met'){if(name==='manage')renderMethodologies();if(name==='calculate')refreshCalculationMethodologies();if(name==='quarter')refreshQuarterSelectors()}}
async function refreshHome(){if(!db)return;let s=await students(),a=await all('activities'),att=await all('attendance');let groups=new Set(s.map(x=>`${x.shift}|${x.group}`));$('#homeGroups').textContent=groups.size;$('#homeStudents').textContent=s.length;$('#homeActivities').textContent=a.length;$('#homeAttendance').textContent=att.length;let d=new Date();$('#welcomeDate').textContent=d.toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).replace(/^./,c=>c.toUpperCase())+' · Cada cambio se guarda automáticamente en este iPad.';await showLastInternalSave()}
async function fillSelectors(){let s=await students(),sh=uniq(s.map(x=>x.shift));for(let id of ['attShift','actShift','gridShift','newActShift','metShift','calcMetShift']){let el=$('#'+id),old=el.value;el.innerHTML=sh.length?sh.map(x=>`<option>${safe(x)}</option>`).join(''):'<option>Sin alumnos</option>';if(sh.includes(old))el.value=old}await fillGroups('att');await fillGroups('act');await fillGroups('grid');await fillGroups('newAct');await fillGroups('met');await fillGroups('calcMet');}
async function fillGroups(prefix){let s=await students(),shift=$('#'+prefix+'Shift').value,id=prefix+'Group',el=$('#'+id),old=el.value,g=uniq(s.filter(x=>x.shift===shift).map(x=>x.group));el.innerHTML=g.length?g.map(x=>`<option>${safe(x)}</option>`).join(''):'<option>Sin grupo</option>';if(g.includes(old))el.value=old;if(prefix==='att')refreshAttendance();if(prefix==='act')refreshActivitySelectors();if(prefix==='grid')refreshGridWeeks();if(prefix==='newAct'){}if(prefix==='met')renderMethodologies();if(prefix==='calcMet')refreshCalculationMethodologies()} 
function status(base,type,title,text){let p=$('#'+base+'Status');p.className='status '+type;p.querySelector('i').textContent=type==='success'?'✓':type==='error'?'⛔':type==='warning'?'⚠':'▣';p.querySelector('h2').textContent=title;p.querySelector('p').textContent=text;clearTimeout(p._t);p._t=setTimeout(()=>{p.className='status neutral';p.querySelector('i').textContent='▣';p.querySelector('h2').textContent=base==='att'?'Escanea la credencial':'Escanea para registrar entrega';p.querySelector('p').textContent=base==='att'?'El lector escribe el ID y envía Enter.':'El alumno quedará con palomita.'},2200)}
async function refreshAttendance(){if(!db)return;let s=await students(),a=await all('attendance'),shift=$('#attShift').value,group=$('#attGroup').value,date=$('#attDate').value,roster=s.filter(x=>sameShift(x.shift,shift)&&sameGroup(x.group,group)),rec=a.filter(x=>x.date===date&&sameShift(x.shift,shift)&&sameGroup(x.group,group));$('#attPresent').textContent=rec.length;$('#attTotal').textContent=roster.length;$('#attMissing').textContent=Math.max(0,roster.length-rec.length);let box=$('#attList');if(!rec.length){box.className='list empty';box.textContent='Aún no hay registros.';return}box.className='list';box.innerHTML=rec.sort((x,y)=>y.timestamp.localeCompare(x.timestamp)).map(x=>`<div class="row"><div><strong>${safe(x.name||x.studentId)}</strong><small>${safe(x.status||'Presente')} · Lista ${safe(x.number)} · ${new Date(x.timestamp).toLocaleTimeString('es-MX')}</small></div><div class="rowactions"><button class="del" data-ad="${safe(x.key)}">Eliminar</button></div></div>`).join('');$$('[data-ad]').forEach(b=>b.onclick=async()=>{if(confirm('¿Eliminar este registro?')){await del('attendance',b.dataset.ad);refreshAttendance()}})}
async function registerAttendance(){let id=norm($('#attScan').value);$('#attScan').value='';$('#attScan').focus();if(!id)return;let s=await req(store('students').get(id));if(!s)return status('att','warning','ID no encontrado',id);let shift=$('#attShift').value,group=$('#attGroup').value,date=$('#attDate').value;if(s.shift!==shift||String(s.group)!==String(group))return status('att','warning','Otro grupo',`${s.name||id}: ${s.shift}, ${s.group}`);let key=`${date}|${id}`,old=await req(store('attendance').get(key));if(old)return status('att','error','YA REGISTRADO',`${old.name||id} · ${new Date(old.timestamp).toLocaleTimeString('es-MX')}`);let st=$('#attMode').value==='retardo'?'Retardo':'Presente';await put('attendance',{key,date,studentId:id,name:s.name,shift:s.shift,group:String(s.group),number:s.number,status:st,timestamp:new Date().toISOString()});status('att','success',st==='Retardo'?'RETARDO REGISTRADO':'REGISTRADO',`${s.name||id} · Lista ${s.number}`);refreshAttendance()}
async function showMissing(){let s=await students(),a=await all('attendance'),shift=$('#attShift').value,group=$('#attGroup').value,date=$('#attDate').value,p=new Set(a.filter(x=>x.date===date&&sameShift(x.shift,shift)&&sameGroup(x.group,group)).map(x=>x.studentId)),m=s.filter(x=>sameShift(x.shift,shift)&&sameGroup(x.group,group)&&!p.has(x.id));showDialog('Faltantes',m.length?m.map(x=>`<div class="row"><div><strong>${safe(x.name||'Sin nombre')}</strong><small>ID ${safe(x.id)} · Lista ${safe(x.number)}</small></div></div>`).join(''):'<p>No hay faltantes.</p>')}
async function createActivity(e){e.preventDefault();let editId=$('#editActivityId').value,old=editId?await req(store('activities').get(editId)):null,newMode=$('#newActEvaluation').value||'delivery';if(old&&(old.evaluationMode||'delivery')!==newMode){let existing=(await all('activityRecords')).some(r=>r.activityId===old.id);if(existing){alert('No se puede cambiar la forma de evaluación porque esta actividad ya tiene registros. Puedes editar nombre, fecha, semana, tipo, turno o grupo sin perderlos.');$('#newActEvaluation').value=old.evaluationMode||'delivery';return}}let v={id:editId||crypto.randomUUID(),shift:$('#newActShift').value,group:$('#newActGroup').value,date:$('#newActDate').value,week:norm($('#newActWeek').value),name:norm($('#newActName').value),type:$('#newActType').value,evaluationMode:newMode,order:old?.order??Date.now(),created:old?.created||new Date().toISOString(),updated:new Date().toISOString()};await put('activities',v);resetActivityForm();await refreshActivitySelectors();await refreshGridWeeks();await renderActivities();await refreshCalculationMethodologies();alert(editId?'Actividad actualizada. Los registros se conservaron.':'Actividad guardada')}

function resetActivityForm(){$('#activityForm').reset();$('#editActivityId').value='';$('#newActDate').value=today();$('#newActEvaluation').value='delivery';$('#activityFormTitle').textContent='Crear actividad';$('#saveActivityBtn').textContent='Guardar actividad';$('#cancelActivityEdit').classList.add('hidden');$('#newActEvaluation').disabled=false;$('#evaluationHelp').textContent='Las actividades de entrega pueden registrarse con el escáner. Las numéricas se capturan directamente en la cuadrícula.';fillGroups('newAct')}
async function editActivity(id){let a=await req(store('activities').get(id));if(!a)return;$('#editActivityId').value=a.id;$('#newActShift').value=[...$('#newActShift').options].find(o=>sameShift(o.value,a.shift))?.value||a.shift;await fillGroups('newAct');$('#newActGroup').value=[...$('#newActGroup').options].find(o=>sameGroup(o.value,a.group))?.value||a.group;$('#newActDate').value=a.date;$('#newActWeek').value=a.week;$('#newActName').value=a.name;$('#newActType').value=a.type||'Actividad';$('#newActEvaluation').value=a.evaluationMode||'delivery';let hasRecords=(await all('activityRecords')).some(r=>r.activityId===a.id);$('#newActEvaluation').disabled=hasRecords;$('#evaluationHelp').textContent=hasRecords?'La forma de evaluación está bloqueada porque ya existen registros. Los demás datos sí pueden editarse.':'Las actividades de entrega usan escáner; las numéricas se capturan en la cuadrícula.';$('#activityFormTitle').textContent='Editar actividad';$('#saveActivityBtn').textContent='Guardar cambios';$('#cancelActivityEdit').classList.remove('hidden');pane('act','manage');$('#activityForm').scrollIntoView({behavior:'smooth'})}
async function refreshActivitySelectors(){if(!db)return;let acts=await all('activities'),shift=$('#actShift').value,group=$('#actGroup').value,weeks=uniq(acts.filter(x=>sameShift(x.shift,shift)&&sameGroup(x.group,group)).map(x=>x.week)),old=$('#actWeek').value;$('#actWeek').innerHTML=weeks.length?weeks.map(x=>`<option>${safe(x)}</option>`).join(''):'<option>Sin actividades</option>';if(weeks.includes(old))$('#actWeek').value=old;let week=$('#actWeek').value,allWeek=acts.filter(x=>sameShift(x.shift,shift)&&sameGroup(x.group,group)&&x.week===week).sort(activitySort),aa=allWeek.filter(x=>(x.evaluationMode||'delivery')==='delivery'),oldA=$('#actSelect').value;$('#actSelect').innerHTML=aa.length?aa.map(x=>`<option value="${x.id}">${safe(x.name)}</option>`).join(''):'<option value="">No hay actividades de entrega</option>';if(aa.some(x=>x.id===oldA))$('#actSelect').value=oldA;let enabled=aa.length>0;$('#actScan').disabled=!enabled;$('#actRegister').disabled=!enabled;$('#actClose').disabled=!enabled;$('#actReopen').disabled=!enabled;if(!enabled){status('act','warning','Sin actividades para escáner','Las actividades numéricas se califican en la cuadrícula semanal.')}refreshActivityStats()}

async function refreshActivityStats(){let id=$('#actSelect').value;if(!id){['actDelivered','actNotDelivered','actPending'].forEach(x=>$('#'+x).textContent='0');return}let act=await req(store('activities').get(id)),s=await students(),r=(await all('activityRecords')).filter(x=>x.activityId===id),roster=s.filter(x=>x.shift===act.shift&&String(x.group)===String(act.group)),yes=r.filter(x=>x.status==='yes').length,no=r.filter(x=>x.status==='no').length;$('#actDelivered').textContent=yes;$('#actNotDelivered').textContent=no;$('#actPending').textContent=Math.max(0,roster.length-yes-no)}
async function registerActivity(){let sid=norm($('#actScan').value);$('#actScan').value='';$('#actScan').focus();let aid=$('#actSelect').value;if(!aid)return status('act','warning','Selecciona una actividad','Primero crea o elige una actividad.');let s=await req(store('students').get(sid));if(!s)return status('act','warning','ID no encontrado',sid);let a=await req(store('activities').get(aid));if((a.evaluationMode||'delivery')!=='delivery')return status('act','warning','Actividad numérica','Captura la calificación desde la cuadrícula semanal.');if(!sameShift(s.shift,a.shift)||!sameGroup(s.group,a.group))return status('act','warning','Otro grupo',`${s.name||sid}: ${s.shift}, ${s.group}`);let key=`${aid}|${sid}`,old=await req(store('activityRecords').get(key));if(old&&old.status==='yes')return status('act','error','YA REGISTRADO',s.name||sid);await put('activityRecords',{key,activityId:aid,studentId:sid,status:'yes',timestamp:new Date().toISOString()});status('act','success','ENTREGADO',`${s.name||sid} · Lista ${s.number}`);refreshActivityStats()}
async function closeActivity(markNo){let aid=$('#actSelect').value;if(!aid)return alert('Selecciona una actividad');let a=await req(store('activities').get(aid));if((a.evaluationMode||'delivery')!=='delivery')return alert('Esta actividad es numérica y no utiliza escáner.');let s=await students(),r=await all('activityRecords'),have=new Set(r.filter(x=>x.activityId===aid).map(x=>x.studentId));if(markNo){for(let st of s.filter(x=>sameShift(x.shift,a.shift)&&sameGroup(x.group,a.group))){if(!have.has(st.id))await put('activityRecords',{key:`${aid}|${st.id}`,activityId:aid,studentId:st.id,status:'no',timestamp:new Date().toISOString()})}}await refreshActivityStats();renderActivityGrid();alert(markNo?'Los no escaneados quedaron con tache.':'Los faltantes se conservaron pendientes.')}
async function refreshGridWeeks(){let acts=await all('activities'),shift=$('#gridShift').value,group=$('#gridGroup').value,weeks=uniq(acts.filter(x=>sameShift(x.shift,shift)&&sameGroup(x.group,group)).map(x=>x.week)),old=$('#gridWeek').value;$('#gridWeek').innerHTML=weeks.length?weeks.map(x=>`<option>${safe(x)}</option>`).join(''):'<option>Sin actividades</option>';if(weeks.includes(old))$('#gridWeek').value=old;renderActivityGrid()}
async function currentWeekActivities(){let shift=$('#gridShift').value,group=$('#gridGroup').value,week=$('#gridWeek').value;return (await all('activities')).filter(x=>sameShift(x.shift,shift)&&sameGroup(x.group,group)&&x.week===week).sort(activitySort)}
async function renderActivityOrder(){let acts=await currentWeekActivities(),box=$('#activityOrderList');if(!box)return;if(!acts.length){box.className='order-list empty';box.textContent='No hay actividades en esta semana.';return}box.className='order-list';box.innerHTML=acts.map((a,i)=>`<div class="order-item"><div><strong>${i+1}. ${safe(a.name)}</strong><small>${safe(a.date)} · ${safe(a.type||'Actividad')}</small></div><div class="order-actions"><button data-move-act="${a.id}|up" ${i===0?'disabled':''}>↑ Subir</button><button data-move-act="${a.id}|down" ${i===acts.length-1?'disabled':''}>↓ Bajar</button></div></div>`).join('');$$('[data-move-act]').forEach(b=>b.onclick=async()=>{let [id,dir]=b.dataset.moveAct.split('|'),list=await currentWeekActivities(),i=list.findIndex(x=>x.id===id),j=dir==='up'?i-1:i+1;if(i<0||j<0||j>=list.length)return;let ai=list[i],aj=list[j],oi=Number(ai.order??i),oj=Number(aj.order??j);ai.order=oj;aj.order=oi;await put('activities',ai);await put('activities',aj);await renderActivityGrid()})}
async function renderActivityGrid(){if(!db)return;let shift=$('#gridShift').value,group=$('#gridGroup').value,week=$('#gridWeek').value,s=(await students()).filter(x=>sameShift(x.shift,shift)&&sameGroup(x.group,group)),acts=await currentWeekActivities(),records=await all('activityRecords'),map=new Map(records.map(x=>[x.key,x]));await renderActivityOrder();let box=$('#activityGrid');if(!s.length||!acts.length){box.innerHTML='<div class="empty">Carga alumnos y crea actividades para esta semana.</div>';return}box.innerHTML=`<table class="matrix"><thead><tr><th class="num">#</th><th class="name">Alumno</th>${acts.map(a=>`<th title="${safe(a.type)} · ${safe(a.date)}">${safe(a.name)}<br><small>${(a.evaluationMode||'delivery')==='numeric'?'0–10':'Entrega'}</small></th>`).join('')}</tr></thead><tbody>${s.map(st=>`<tr><td class="num">${safe(st.number)}</td><td class="name">${safe(st.name||st.id)}</td>${acts.map(a=>{let rec=map.get(`${a.id}|${st.id}`),mode=a.evaluationMode||'delivery';if(mode==='numeric'){let value=rec&&typeof rec.score==='number'?rec.score:'';return `<td class="mark numeric"><input class="numeric-score" data-score="${a.id}|${st.id}" type="number" min="0" max="10" step="0.1" inputmode="decimal" value="${value}" placeholder="—"></td>`}let v=rec?.status||'blank';return `<td class="mark ${v}" data-mark="${a.id}|${st.id}">${v==='yes'?'●':v==='no'?'●':''}</td>`}).join('')}</tr>`).join('')}</tbody></table>`;$$('[data-mark]').forEach(c=>c.onclick=async()=>{let [aid,sid]=c.dataset.mark.split('|'),old=await req(store('activityRecords').get(c.dataset.mark)),next=!old||old.status==='blank'?'yes':old.status==='yes'?'no':'blank';if(next==='blank')await del('activityRecords',c.dataset.mark);else await put('activityRecords',{key:c.dataset.mark,activityId:aid,studentId:sid,status:next,timestamp:new Date().toISOString()});renderActivityGrid()});$$('[data-score]').forEach(inp=>{inp.onchange=async()=>{let [aid,sid]=inp.dataset.score.split('|'),raw=inp.value.trim(),key=inp.dataset.score;if(raw===''){await del('activityRecords',key);return}let score=Number(raw);if(!Number.isFinite(score)||score<0||score>10){alert('La calificación debe estar entre 0 y 10.');let old=await req(store('activityRecords').get(key));inp.value=typeof old?.score==='number'?old.score:'';return}score=Math.round(score*10)/10;inp.value=score;await put('activityRecords',{key,activityId:aid,studentId:sid,score,timestamp:new Date().toISOString()})}})}

async function renderActivities(){let acts=(await all('activities')).sort((a,b)=>b.date.localeCompare(a.date)||a.name.localeCompare(b.name,'es',{sensitivity:'base'})),box=$('#activitiesList');if(!acts.length){box.className='list empty';box.textContent='No hay actividades.';return}box.className='list';box.innerHTML=acts.map(a=>`<div class="row"><div><strong>${safe(a.name)}</strong><small>${safe(a.shift)} · ${safe(a.group)} · ${safe(a.week)} · ${safe(a.date)} · ${safe(a.type||'Actividad')}</small></div><div class="rowactions"><button class="edit activity-edit" title="Editar nombre, fecha, semana, tipo, turno o grupo sin borrar registros" data-actedit="${a.id}">✏️ Editar</button><button class="del" data-actdel="${a.id}">Eliminar</button></div></div>`).join('');$$('[data-actedit]').forEach(b=>b.onclick=()=>editActivity(b.dataset.actedit));$$('[data-actdel]').forEach(b=>b.onclick=async()=>{if(confirm('¿Eliminar la actividad y sus registros?')){let rs=(await all('activityRecords')).filter(x=>x.activityId===b.dataset.actdel);for(let r of rs)await del('activityRecords',r.key);await del('activities',b.dataset.actdel);await refreshActivitySelectors();await refreshGridWeeks();renderActivities()}})}
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
async function showWeeklyReportOptions(){let acts=await currentWeekActivities();if(!acts.length)return alert('No hay actividades en esa semana');let defaultTitle='Reporte semanal de actividades';let html=`<label style="display:block;margin-bottom:14px"><strong>Encabezado del reporte</strong><input id="weeklyReportTitle" value="${defaultTitle}" maxlength="90" style="margin-top:6px;width:100%"></label><p>Selecciona las actividades que deseas incluir. El orden mostrado será el mismo de la cuadrícula.</p><div class="report-options">${acts.map((a,i)=>`<label class="report-option"><input type="checkbox" data-report-act="${a.id}" checked><span><strong>${i+1}. ${safe(a.name)}</strong><br><small>${safe(a.date)} · ${safe(a.type||'Actividad')}</small></span></label>`).join('')}</div><div class="actions"><button id="selectAllReportActs" class="secondary">Seleccionar todas</button><button id="clearReportActs" class="danger-outline">Quitar todas</button><button id="generateSelectedWeeklyPdf" class="primary">Generar PDF</button></div>`;showDialog('Preparar reporte semanal',html);$('#selectAllReportActs').onclick=()=>$$('[data-report-act]').forEach(x=>x.checked=true);$('#clearReportActs').onclick=()=>$$('[data-report-act]').forEach(x=>x.checked=false);$('#generateSelectedWeeklyPdf').onclick=async()=>{let ids=$$('[data-report-act]:checked').map(x=>x.dataset.reportAct);if(!ids.length)return alert('Selecciona al menos una actividad.');let title=($('#weeklyReportTitle').value||defaultTitle).trim();$('#dialog').close();await printWeekly(ids,title)}}
async function printAttendance(){let shift=$('#attShift').value,group=$('#attGroup').value,date=$('#attDate').value,s=(await students()).filter(x=>sameShift(x.shift,shift)&&sameGroup(x.group,group)),a=(await all('attendance')).filter(x=>sameShift(x.shift,shift)&&sameGroup(x.group,group)&&x.date===date),map=new Map(a.map(x=>[x.studentId,x]));if(!pdfReady())return alert('No se cargó el generador de PDF. Abre la app con internet y vuelve a intentarlo.');let html=`<p><b>Fecha:</b> ${date} · <b>Turno:</b> ${safe(shift)} · <b>Grupo:</b> ${safe(group)}</p><table><tr><th>#</th><th>Alumno</th><th>Estatus</th><th>Hora</th></tr>${s.map(st=>{let x=map.get(st.id);return `<tr><td>${st.number}</td><td class="left">${safe(st.name||st.id)}</td><td>${x?safe(x.status||'Presente'):'Falta'}</td><td>${x?new Date(x.timestamp).toLocaleTimeString('es-MX'):''}</td></tr>`}).join('')}</table>`;let {jsPDF}=window.jspdf,doc=new jsPDF({unit:'mm',format:'a4'});pdfHeader(doc,'Reporte de asistencia');doc.setFontSize(10);doc.text(`Fecha: ${date}    Turno: ${shift}    Grupo: ${group}`,14,32);doc.autoTable({startY:37,head:[['#','Alumno','Estatus','Hora']],body:s.map(st=>{let x=map.get(st.id);return [String(st.number),st.name||st.id,x?(x.status||'Presente'):'Falta',x?new Date(x.timestamp).toLocaleTimeString('es-MX'):'' ]}),styles:{fontSize:9,cellPadding:2},headStyles:{fillColor:[245,196,0],textColor:[33,27,18]},columnStyles:{1:{cellWidth:90}}});pdfFooter(doc);printContent('Reporte de asistencia',html,pdfBlob(doc),`asistencia_${shift}_${group}_${date}.pdf`)}
async function printWeekly(selectedIds=null,reportTitle='Reporte semanal de actividades'){let shift=$('#gridShift').value,group=$('#gridGroup').value,week=$('#gridWeek').value,s=(await students()).filter(x=>sameShift(x.shift,shift)&&sameGroup(x.group,group)),acts=await currentWeekActivities(),r=await all('activityRecords'),map=new Map(r.map(x=>[x.key,x]));if(Array.isArray(selectedIds))acts=acts.filter(a=>selectedIds.includes(a.id));if(!acts.length)return alert('No seleccionaste actividades para el reporte');if(!pdfReady())return alert('No se cargó el generador de PDF. Pulsa Actualizar app con internet una vez y vuelve a intentarlo.');let dot=v=>typeof v==='number'?`<strong>${v}</strong>`:v==='yes'?'<span style="display:inline-block;width:22px;height:22px;border-radius:50%;background:#16a34a"></span>':v==='no'?'<span style="display:inline-block;width:22px;height:22px;border-radius:50%;background:#dc2626"></span>':'<span style="color:#777;font-size:18px">—</span>';let html=`<p style="font-weight:800;letter-spacing:.12em;color:#991822">ESPAÑOL</p><p><b>Turno:</b> ${safe(shift)} · <b>Grupo:</b> ${safe(group)} · <b>Semana:</b> ${safe(week)}</p><table><tr><th>#</th><th>Alumno</th>${acts.map(a=>`<th>${safe(a.name)}</th>`).join('')}<th>Entregadas</th></tr>${s.map(st=>{let n=0,cells=acts.map(a=>{let rec=map.get(`${a.id}|${st.id}`),v=(a.evaluationMode||'delivery')==='numeric'?rec?.score:rec?.status;if(v==='yes'||typeof v==='number')n++;return `<td style="text-align:center;vertical-align:middle">${dot(v)}</td>`}).join('');return `<tr><td>${st.number}</td><td class="left">${safe(st.name||st.id)}</td>${cells}<td>${n}/${acts.length}</td></tr>`}).join('')}</table><p><span style="display:inline-block;width:16px;height:16px;border-radius:50%;background:#16a34a;vertical-align:middle"></span> Entregó &nbsp;&nbsp; <span style="display:inline-block;width:16px;height:16px;border-radius:50%;background:#dc2626;vertical-align:middle"></span> No entregó &nbsp;&nbsp; <span style="color:#777">—</span> Pendiente o sin registro</p>`;let {jsPDF}=window.jspdf,doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});pdfHeader(doc,reportTitle,'ESPAÑOL');doc.setFontSize(10);doc.text(`Turno: ${shift}    Grupo: ${group}    Semana: ${week}`,14,36);let head=[['#','Alumno',...acts.map(a=>a.name),'Entregadas']],body=s.map(st=>{let n=0,row=[String(st.number),st.name||st.id];for(let a of acts){let rec=map.get(`${a.id}|${st.id}`),mode=a.evaluationMode||'delivery',v=mode==='numeric'?rec?.score:rec?.status;if(v==='yes'||typeof v==='number')n++;row.push(mode==='numeric'?(typeof v==='number'?String(v):'—'):(v==='yes'?'__YES__':v==='no'?'__NO__':'__PENDING__'))}row.push(`${n}/${acts.length}`);return row});doc.autoTable({startY:41,head,body,styles:{fontSize:7,cellPadding:1.5,halign:'center',valign:'middle',minCellHeight:8},headStyles:{fillColor:[245,196,0],textColor:[33,27,18]},columnStyles:{1:{halign:'left',cellWidth:45}},didParseCell:data=>{if(data.section==='body'&&['__YES__','__NO__','__PENDING__'].includes(data.cell.raw)){data.cell.text=[''];}},didDrawCell:data=>{if(data.section!=='body')return;let raw=data.cell.raw;if(!['__YES__','__NO__','__PENDING__'].includes(raw))return;let cx=data.cell.x+data.cell.width/2,cy=data.cell.y+data.cell.height/2;if(raw==='__YES__'||raw==='__NO__'){let radius=Math.max(2.2,Math.min(data.cell.width,data.cell.height)*0.32);if(raw==='__YES__')doc.setFillColor(22,163,74);else doc.setFillColor(220,38,38);doc.circle(cx,cy,radius,'F')}else{doc.setDrawColor(110,110,110);doc.setLineWidth(.6);doc.line(cx-2.4,cy,cx+2.4,cy)}}});let y=doc.lastAutoTable.finalY+7;doc.setFillColor(22,163,74);doc.circle(16,y-1.2,2.2,'F');doc.setFontSize(10);doc.setTextColor(33,27,18);doc.text('Entregó',21,y);doc.setFillColor(220,38,38);doc.circle(46,y-1.2,2.2,'F');doc.text('No entregó',51,y);doc.setTextColor(110,110,110);doc.text('—',86,y);doc.setTextColor(33,27,18);doc.text('Pendiente o sin registro',92,y);pdfFooter(doc);printContent(reportTitle,html,pdfBlob(doc),`actividades_${shift}_${group}_${week.replace(/[^a-z0-9]+/gi,'_')}.pdf`)}

function canvasWrapText(ctx,text,x,y,maxWidth,lineHeight,maxLines=99){
  const words=String(text||'').split(/\s+/);
  let line='',lines=[],i=0;
  for(const word of words){
    const test=line?`${line} ${word}`:word;
    if(ctx.measureText(test).width>maxWidth&&line){
      lines.push(line);line=word;
      if(lines.length>=maxLines-1)break;
    }else line=test;
    i++;
  }
  if(line&&lines.length<maxLines)lines.push(line);
  if(i<words.length&&lines.length){
    let last=lines[lines.length-1];
    while(ctx.measureText(last+'…').width>maxWidth&&last.length>1)last=last.slice(0,-1);
    lines[lines.length-1]=last+'…';
  }
  lines.forEach((ln,idx)=>ctx.fillText(ln,x,y+idx*lineHeight));
  return lines.length;
}
async function getTitularReportData(){
  const sid=$('#titStudent').value,wid=$('#titSavedWeek').value;
  if(!sid||!wid){alert('Selecciona alumno y semana.');return null}
  const student=await req(store('students').get(sid));
  const week=await req(store('titularWeeks').get(wid));
  const records=(await all('titularRecords')).filter(x=>x.weekId===wid&&x.studentId===sid);
  return {student,week,map:new Map(records.map(x=>[x.subject,x]))};
}
async function buildTitularImageBlob(){
  const data=await getTitularReportData();
  if(!data)return null;
  const {student:s,week:w,map}=data;
  const canvas=document.createElement('canvas');
  canvas.width=1240;canvas.height=1754;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);

  // Header
  ctx.fillStyle='#f5c400';ctx.fillRect(0,0,1240,190);
  ctx.fillStyle='#c9232d';ctx.fillRect(0,178,1240,12);
  ctx.fillStyle='#211b12';ctx.font='bold 48px Arial';ctx.fillText('EL AULA DEL PROFE JAIME',55,65);
  ctx.font='bold 34px Arial';ctx.fillText('Seguimiento académico 3.º A',55,118);
  ctx.font='bold 25px Arial';ctx.fillText('Titular: Profr. Jaime Armando Pérez Vázquez',55,158);

  // Student data
  ctx.fillStyle='#211b12';ctx.font='bold 29px Arial';
  ctx.fillText(`Alumno: ${s.name||s.id}`,55,238);
  ctx.font='24px Arial';
  ctx.fillText(`Grupo: 3.º A   No. de lista: ${s.number}   Semana: ${w.label}`,55,278);

  // Legend
  let y=338;
  ctx.font='bold 26px Arial';ctx.fillText('Significado de los colores',55,y);y+=42;
  const legend=[
    ['#16a34a','Verde:','el alumno se encuentra al corriente en la asignatura.'],
    ['#d4a800','Amarillo:','existen pendientes que deben revisarse directamente con el docente.'],
    ['#dc2626','Rojo — atención urgente:','debe acercarse cuanto antes con el docente para confirmar si existe posibilidad de ponerse al corriente.'],
    ['#c7c7c7','Blanco:','no se recibió información de la asignatura durante esta semana.']
  ];
  for(const [color,label,desc] of legend){
    ctx.beginPath();ctx.fillStyle=color;ctx.arc(69,y-8,14,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#211b12';ctx.font='bold 22px Arial';ctx.fillText(label,98,y);
    ctx.font='21px Arial';
    const used=canvasWrapText(ctx,desc,98+ctx.measureText(label).width+10,y,1015-ctx.measureText(label).width,28,3);
    y+=Math.max(40,used*28+10);
  }

  // Table
  y+=10;
  const left=55,tableW=1130,rowH=72;
  ctx.fillStyle='#f5c400';ctx.fillRect(left,y,tableW,58);
  ctx.fillStyle='#211b12';ctx.font='bold 23px Arial';
  ctx.fillText('Asignatura',left+18,y+37);
  ctx.fillText('Estado',left+355,y+37);
  ctx.fillText('Interpretación',left+560,y+37);
  y+=58;

  const interpretation=st=>st==='green'
    ?'El alumno se encuentra al corriente.'
    :st==='yellow'
    ?'Debe acercarse con el docente para revisar pendientes.'
    :st==='red'
    ?'ATENCIÓN URGENTE: acercarse con el docente y revisar si aún puede ponerse al corriente.'
    :'No se recibió información esta semana.';
  const dotColor={green:'#16a34a',yellow:'#d4a800',red:'#dc2626',white:'#c7c7c7'};
  subjects.forEach((sub,idx)=>{
    const st=map.get(sub)?.status||'white';
    ctx.fillStyle=idx%2?'#f1f1f1':'#ffffff';ctx.fillRect(left,y,tableW,rowH);
    ctx.strokeStyle='#dddddd';ctx.strokeRect(left,y,tableW,rowH);
    ctx.fillStyle='#333';ctx.font='22px Arial';
    canvasWrapText(ctx,sub,left+18,y+29,310,25,2);
    ctx.beginPath();ctx.fillStyle=dotColor[st];ctx.arc(left+405,y+rowH/2,17,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#333';ctx.font='20px Arial';
    canvasWrapText(ctx,interpretation(st),left+560,y+27,600,24,2);
    y+=rowH;
  });

  // Notes
  y+=35;
  ctx.fillStyle='#211b12';ctx.font='bold 23px Arial';ctx.fillText('Observaciones generales:',55,y);
  ctx.font='21px Arial';
  const obs=map.get('OBS')?.text||'Sin observaciones.';
  let obsLines=canvasWrapText(ctx,obs,315,y,870,27,4);
  y+=Math.max(55,obsLines*27+18);

  ctx.fillStyle='#ffe5e5';ctx.fillRect(45,y,1150,112);
  ctx.fillStyle='#991822';ctx.font='bold 20px Arial';
  canvasWrapText(ctx,'IMPORTANTE: Este reporte es informativo. Cada docente determina si recibe actividades atrasadas, bajo qué condiciones y dentro de qué plazo.',65,y+34,1110,27,3);
  y+=132;

  ctx.fillStyle='#fff8dc';ctx.fillRect(45,y,1150,112);
  ctx.fillStyle='#665000';ctx.font='bold 20px Arial';
  canvasWrapText(ctx,'AVISO: Este reporte no sustituye la información oficial publicada en Systelar. Se recomienda revisar constantemente dicha plataforma para consultar avisos, calificaciones, pendientes y actualizaciones.',65,y+34,1110,27,3);

  ctx.fillStyle='#666';ctx.font='18px Arial';
  ctx.fillText(`Generado: ${new Date().toLocaleString('es-MX')}`,55,1710);

  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png',1));
  const name=`seguimiento_3A_${(s.name||s.id).replace(/[^a-z0-9]+/gi,'_')}_${w.label.replace(/[^a-z0-9]+/gi,'_')}.png`;
  return {blob,fileName:name,title:'Seguimiento académico 3.º A',student:s,week:w};
}
function showImageContent(title,blob,fileName){
  closeReportViewer();
  activeReportUrl=URL.createObjectURL(blob);
  const overlay=document.createElement('div');
  overlay.id='reportViewer';
  overlay.style.cssText='position:fixed;inset:0;z-index:99999;background:#ece8dc;display:flex;flex-direction:column;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)';
  const toolbar=document.createElement('div');
  toolbar.style.cssText='display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap;padding:10px;background:#211b12;border-bottom:4px solid #c9232d';
  const mk=(text,bg,fg='#fff')=>{const b=document.createElement('button');b.textContent=text;b.style.cssText=`border:0;border-radius:11px;padding:11px 15px;font-weight:900;font-size:15px;background:${bg};color:${fg}`;return b};
  const close=mk('← Regresar a la app','#c9232d');close.onclick=closeReportViewer;
  const share=mk('Compartir imagen','#25d366','#102b18');share.onclick=async()=>{
    try{
      const file=new File([blob],fileName,{type:'image/png'});
      if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){
        await navigator.share({title,text:'Reporte generado en El Aula del Profe Jaime',files:[file]});
      }else throw new Error('share unavailable');
    }catch(e){
      if(e.name!=='AbortError')alert('No fue posible abrir el menú para compartir. Guarda la imagen y compártela desde Fotos o Archivos.');
    }
  };
  const save=mk('Guardar imagen','#f5c400','#211b12');save.onclick=()=>{
    const a=document.createElement('a');a.href=activeReportUrl;a.download=fileName;document.body.appendChild(a);a.click();a.remove()
  };
  toolbar.append(close,share,save);
  const note=document.createElement('div');
  note.textContent='Puedes compartir esta imagen mediante Gmail, WhatsApp u otra app instalada en el iPad.';
  note.style.cssText='text-align:center;padding:7px;background:#fff8d6;font-size:13px;font-weight:700;color:#554600';
  const area=document.createElement('div');
  area.style.cssText='flex:1;overflow:auto;padding:12px;text-align:center';
  const img=document.createElement('img');img.src=activeReportUrl;img.alt=title;img.style.cssText='max-width:100%;height:auto;background:#fff;box-shadow:0 8px 30px rgba(0,0,0,.18)';
  area.appendChild(img);overlay.append(toolbar,note,area);document.body.appendChild(overlay);document.body.style.overflow='hidden';
}
async function generateTitularImage(){
  const data=await buildTitularImageBlob();
  if(data)showImageContent(data.title,data.blob,data.fileName);
}
async function openTitularEmailDialog(){
  const data=await getTitularReportData();
  if(!data)return;
  const {student:s,week:w}=data;
  const recipient=(s.email||'').trim();
  const defaultSubject=`Seguimiento académico 3.º A - ${s.name||s.id} - ${w.label}`;
  const defaultBody=`Buen día:\n\nComparto el reporte de seguimiento académico correspondiente a ${s.name||s.id}, de la semana ${w.label}.\n\nEste reporte es informativo y no sustituye la información oficial publicada en Systelar. Se recomienda revisar constantemente dicha plataforma.\n\nAtentamente,\nProfr. Jaime Armando Pérez Vázquez`;
  const bodyHtml=`<div class="email-compose">
    <label>Destinatario<input id="emailRecipient" type="email" value="${safe(recipient)}" placeholder="Correo institucional del alumno"></label>
    <label>Asunto<input id="emailSubject" value="${safe(defaultSubject)}"></label>
    <label>Mensaje<textarea id="emailBody">${safe(defaultBody)}</textarea></label>
    <div class="email-note"><b>En iPad hay dos opciones:</b><br>
    • <b>Abrir correo</b> coloca automáticamente destinatario, asunto y mensaje, pero el navegador no puede adjuntar el archivo.<br>
    • <b>Compartir imagen en Gmail</b> adjunta la imagen; por seguridad de iPadOS quizá tengas que pegar el correo del alumno en el campo destinatario.</div>
    <div class="actions">
      <button id="openMailComposer" class="secondary" type="button">Abrir correo</button>
      <button id="shareImageEmail" class="primary" type="button">Compartir imagen en Gmail</button>
    </div>
  </div>`;
  showDialog('Enviar reporte por correo',bodyHtml);
  $('#openMailComposer').onclick=()=>{
    const to=$('#emailRecipient').value.trim(),subject=$('#emailSubject').value,body=$('#emailBody').value;
    if(!to)return alert('El alumno no tiene correo registrado. Escríbelo o agrégalo en la sección Alumnos.');
    window.location.href=`mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };
  $('#shareImageEmail').onclick=async()=>{
    const to=$('#emailRecipient').value.trim();
    const subject=$('#emailSubject').value,body=$('#emailBody').value;
    if(to&&navigator.clipboard){try{await navigator.clipboard.writeText(to)}catch(_){}}
    const image=await buildTitularImageBlob();
    if(!image)return;
    try{
      const file=new File([image.blob],image.fileName,{type:'image/png'});
      if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){
        await navigator.share({title:subject,text:`${body}\n\nDestinatario: ${to}`,files:[file]});
        $('#dialog').close();
      }else{
        showImageContent(image.title,image.blob,image.fileName);
        alert('La imagen quedó lista. El correo del alumno fue copiado para que puedas pegarlo en Gmail.');
      }
    }catch(e){
      if(e.name!=='AbortError')alert('No se pudo abrir el menú para compartir. Genera la imagen y compártela manualmente desde la vista previa.');
    }
  };
}

async function printTitular(){let sid=$('#titStudent').value,wid=$('#titSavedWeek').value;if(!sid||!wid)return alert('Selecciona alumno y semana');if(!pdfReady())return alert('No se cargó el generador de PDF. Abre la app con internet y vuelve a intentarlo.');let s=await req(store('students').get(sid)),w=await req(store('titularWeeks').get(wid)),r=(await all('titularRecords')).filter(x=>x.weekId===wid&&x.studentId===sid),map=new Map(r.map(x=>[x.subject,x]));let html=$('#titPreview').innerHTML,{jsPDF}=window.jspdf,doc=new jsPDF({unit:'mm',format:'a4'});pdfHeader(doc,'Seguimiento académico 3.º A');doc.setFontSize(10);doc.setFont('helvetica','bold');doc.text('Titular: Profr. Jaime Armando Pérez Vázquez',14,33);doc.setFont('helvetica','normal');doc.text(`Alumno: ${s.name||s.id}`,14,39);doc.text(`Grupo: 3.º A    No. de lista: ${s.number}    Semana: ${w.label}`,14,45);doc.setFontSize(9);doc.setTextColor(33,27,18);doc.setFillColor(22,163,74);doc.circle(16,52.8,2.2,'F');doc.text('VERDE: al corriente.',21,54);doc.setFillColor(212,168,0);doc.circle(16,58.8,2.2,'F');doc.text('AMARILLO: requiere acercarse con el docente para revisar pendientes.',21,60);doc.setFillColor(220,38,38);doc.circle(16,64.8,2.2,'F');doc.setTextColor(160,20,20);let red='ROJO - ATENCION URGENTE: el alumno debe acercarse cuanto antes con el docente para revisar su situacion y confirmar si existe posibilidad de ponerse al corriente. La recepcion de trabajos atrasados depende de los criterios, fechas y autorizacion de cada maestro.';let lines=doc.splitTextToSize(red,180);doc.text(lines,14,66);doc.setTextColor(80);let y=66+lines.length*4.2;doc.text('BLANCO: no se recibio informacion de la asignatura durante esta semana.',14,y);y+=7;let interp=st=>st==='green'?'Al corriente':st==='yellow'?'Requiere revisar con el docente':st==='red'?'ATENCION URGENTE: acercarse con el docente para confirmar si aun puede ponerse al corriente':'Sin informacion esta semana';doc.autoTable({startY:y,head:[['Asignatura','Estado','Interpretación']],body:subjects.map(sub=>{let st=map.get(sub)?.status||'white';return [sub,`__STATE_${st.toUpperCase()}__`,interp(st)]}),styles:{fontSize:8,cellPadding:2,valign:'middle'},headStyles:{fillColor:[245,196,0],textColor:[33,27,18]},columnStyles:{0:{cellWidth:48},1:{cellWidth:28,halign:'center'},2:{cellWidth:105}},didParseCell:data=>{if(data.section==='body'&&typeof data.cell.raw==='string'&&data.cell.raw.startsWith('__STATE_'))data.cell.text=[''];},didDrawCell:data=>{if(data.section!=='body'||typeof data.cell.raw!=='string'||!data.cell.raw.startsWith('__STATE_'))return;let state=data.cell.raw.replace('__STATE_','').replace('__','').toLowerCase(),cx=data.cell.x+data.cell.width/2,cy=data.cell.y+data.cell.height/2,radius=2.8;if(state==='green')doc.setFillColor(22,163,74);else if(state==='yellow')doc.setFillColor(212,168,0);else if(state==='red')doc.setFillColor(220,38,38);else doc.setFillColor(255,255,255);doc.circle(cx,cy,radius,'F');if(state==='white'){doc.setDrawColor(145,145,145);doc.setLineWidth(.5);doc.circle(cx,cy,radius,'S')}}});y=doc.lastAutoTable.finalY+7;doc.setFontSize(9);doc.setTextColor(0);let obs=map.get('OBS')?.text||'Sin observaciones.';doc.text(doc.splitTextToSize(`Observaciones generales: ${obs}`,180),14,y);y+=12;doc.setFillColor(255,235,235);doc.rect(12,y-5,186,24,'F');doc.setTextColor(150,20,20);doc.setFont('helvetica','bold');doc.text(doc.splitTextToSize('IMPORTANTE: Este reporte es informativo. Cada docente determina si recibe actividades atrasadas, bajo qué condiciones y dentro de qué plazo. Un estado rojo no garantiza que los trabajos atrasados sean aceptados.',178),16,y);y+=27;doc.setFillColor(255,248,220);doc.rect(12,y-5,186,22,'F');doc.setTextColor(90,65,0);doc.setFont('helvetica','bold');doc.text(doc.splitTextToSize('AVISO: Este reporte no sustituye la información oficial publicada en Systelar. Se recomienda revisar constantemente dicha plataforma para consultar avisos, calificaciones, pendientes y actualizaciones.',178),16,y);pdfFooter(doc);printContent('Seguimiento académico 3.º A',html,pdfBlob(doc),`seguimiento_3A_${(s.name||s.id).replace(/[^a-z0-9]+/gi,'_')}_${w.label.replace(/[^a-z0-9]+/gi,'_')}.pdf`)}
function pick(o,names){let e=Object.entries(o);for(let n of names){let f=e.find(([k])=>low(k).replace(/[.\s_°º]/g,'')===low(n).replace(/[.\s_°º]/g,''));if(f)return f[1]}return ''}
async function importStudents(file){
 let msg=$('#studentMsg');
 try{
  if(typeof XLSX==='undefined')throw Error('No se cargó el lector de Excel. Abre la app una vez con internet.');
  let wb=XLSX.read(await file.arrayBuffer(),{type:'array'}),sheet=wb.SheetNames.find(x=>low(x).includes('base_alumnos'))||wb.SheetNames.find(x=>low(x).includes('base de datos'))||wb.SheetNames[0],rows=XLSX.utils.sheet_to_json(wb.Sheets[sheet],{defval:''}),count=0,skip=0;
  for(let o of rows){
   let id=norm(pick(o,['ID','ID del alumno','ID ESCANEADO'])),num=Number(pick(o,['No. de lista','No de lista','Numero de lista','Número de lista']));
   let s={id,shift:norm(pick(o,['Turno']))||'Vespertino',group:norm(pick(o,['Grupo']))||'3A',number:num,name:norm(pick(o,['Nombre del alumno','Nombre completo del alumno','Nombre completo','Nombre','Alumno'])),email:norm(pick(o,['Correo institucional del alumno','Correo institucional','Correo','Email'])),guardian:norm(pick(o,['Nombre del padre, madre o tutor','Padre, madre o tutor','Nombre del tutor','Tutor'])),phone:norm(pick(o,['Teléfono del padre, madre o tutor','Telefono del padre, madre o tutor','Teléfono WhatsApp','Telefono WhatsApp','WhatsApp','Teléfono','Telefono'])),observations:norm(pick(o,['Observaciones','Observación','Observacion'])),incidents:norm(pick(o,['Incidencias','Incidencia'])),birthdate:norm(pick(o,['Fecha de nacimiento','Nacimiento']))};
   if(!s.id&&num&&s.name)s.id=`${canonGroup(s.group)||'AL'}${String(num).padStart(3,'0')}`;
   if(s.id&&s.number){let prior=await req(store('students').get(s.id));let saved={...(prior||{}),...s};await put('students',saved);await ensurePortalPinsForStudent(saved);count++}else skip++;
  }
  msg.className='message good';msg.textContent=`${count} alumnos cargados${skip?`; ${skip} filas omitidas`:''}.`;await fillSelectors();await renderStudents();await refreshDossierSelector();
 }catch(e){msg.className='message bad';msg.textContent=e.message}
}
async function saveStudent(e){
 e.preventDefault();let old=$('#editId').value,prior=old?await req(store('students').get(old)):null;
 let s={...(prior||{}),id:norm($('#studentId').value),shift:$('#studentShift').value,group:norm($('#studentGroup').value),number:Number($('#studentNumber').value),name:norm($('#studentName').value),email:norm($('#studentEmail').value),guardian:norm($('#studentGuardian').value),phone:norm($('#studentPhone').value),birthdate:norm($('#studentBirthdate').value),observations:norm($('#studentObservations').value),incidents:norm($('#studentIncidents').value)};
 if(old&&old!==s.id){await del('students',old);try{await del('portalAuth',`${old}|student`);await del('portalAuth',`${old}|parent`)}catch(_){}}await put('students',s);await ensurePortalPinsForStudent(s);e.target.reset();$('#editId').value='';$('#studentTitle').textContent='Agregar alumno';$('#cancelEdit').classList.add('hidden');await fillSelectors();await renderStudents();await refreshDossierSelector(s.id);
}
function fillStudentForm(x){$('#editId').value=x.id;$('#studentId').value=x.id;$('#studentShift').value=x.shift||'Matutino';$('#studentGroup').value=x.group||'';$('#studentNumber').value=x.number||'';$('#studentName').value=x.name||'';$('#studentEmail').value=x.email||'';$('#studentGuardian').value=x.guardian||'';$('#studentPhone').value=x.phone||'';$('#studentBirthdate').value=x.birthdate||'';$('#studentObservations').value=x.observations||'';$('#studentIncidents').value=x.incidents||'';$('#studentTitle').textContent='Editar expediente';$('#cancelEdit').classList.remove('hidden')}
async function editStudentById(id){let x=await req(store('students').get(id));if(!x)return alert('No se encontró el alumno.');setView('students');fillStudentForm(x);$('#studentForm').scrollIntoView({behavior:'smooth',block:'start'})}
async function openStudentDossier(id){setView('dossier');await refreshDossierSelector(id)}
async function renderStudents(){
 let q=low($('#studentSearch').value),s=await students(),f=s.filter(x=>!q||[x.id,x.shift,x.group,x.number,x.name,x.email,x.guardian,x.phone].some(v=>low(v).includes(q))),box=$('#studentsList');
 if(!f.length){box.className='list empty';box.textContent='No hay alumnos.';return}
 box.className='list';box.innerHTML=f.map(x=>`<div class="row"><div class="student-open" tabindex="0" role="button" data-profile="${safe(x.id)}"><strong>${safe(x.name||'Sin nombre')}</strong><small>ID ${safe(x.id)} · ${safe(x.shift)} · Grupo ${safe(x.group)} · Lista ${safe(x.number)}${x.guardian?` · Tutor: ${safe(x.guardian)}`:''}</small></div><div class="rowactions"><button class="edit" data-se="${safe(x.id)}">Editar</button><button class="del" data-sd="${safe(x.id)}">Eliminar</button></div></div>`).join('');
 $$('[data-profile]').forEach(el=>{el.onclick=()=>openStudentDossier(el.dataset.profile);el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openStudentDossier(el.dataset.profile)}}});
 $$('[data-se]').forEach(b=>b.onclick=()=>editStudentById(b.dataset.se));
 $$('[data-sd]').forEach(b=>b.onclick=async()=>{if(confirm('¿Eliminar alumno? Los demás registros permanecerán hasta que los borres desde Administración de datos.')){await del('students',b.dataset.sd);await fillSelectors();await renderStudents();await refreshDossierSelector()}});
}
const dossierValue=v=>norm(v)||'No registrado';
function formatBirthdate(v){if(!v)return'No registrada';let d=new Date(`${v}T12:00:00`);return Number.isNaN(d.getTime())?v:d.toLocaleDateString('es-MX',{day:'numeric',month:'long',year:'numeric'})}
function normalizeWhatsAppPhone(phone){let d=String(phone||'').replace(/\D/g,'');if(d.length===10)d='52'+d;return d}
async function copyTextValue(value,label){if(!norm(value))return alert(`${label} no registrado.`);try{await navigator.clipboard.writeText(String(value))}catch(e){let a=document.createElement('textarea');a.value=String(value);document.body.appendChild(a);a.select();document.execCommand('copy');a.remove()}alert(`${label} copiado.`)}
async function refreshDossierSelector(selectedId=null){if(!db)return;let list=await students(),sel=$('#dossierStudent');if(!sel)return;let old=selectedId||sel.value;sel.innerHTML=list.length?'<option value="">Selecciona un alumno</option>'+list.map(x=>`<option value="${safe(x.id)}">${safe(x.name||x.id)} · ${safe(x.group)} · ${safe(x.shift)}</option>`).join(''):'<option value="">No hay alumnos</option>';if(list.some(x=>x.id===old))sel.value=old;await renderDossier(sel.value)}
async function renderDossier(id){
 let empty=$('#dossierEmpty'),content=$('#dossierContent');if(!id){empty.classList.remove('hidden');content.classList.add('hidden');return}
 let s=await req(store('students').get(id));if(!s){empty.classList.remove('hidden');content.classList.add('hidden');empty.textContent='No se encontró el alumno.';return}
 empty.classList.add('hidden');content.classList.remove('hidden');await renderPortalAccess(s);$('#dossierName').textContent=s.name||s.id;$('#dossierSchoolLine').textContent=`Grupo ${s.group} · No. de lista ${s.number} · ID ${s.id}`;let badge=$('#dossierShiftBadge');badge.textContent=s.shift||'Sin turno';badge.className='shift-badge '+(sameShift(s.shift,'Vespertino')?'vespertino':'');
 $('#dossierStudentInfo').innerHTML=`<dt>Nombre completo</dt><dd>${safe(dossierValue(s.name))}</dd><dt>Turno</dt><dd>${safe(dossierValue(s.shift))}</dd><dt>Grupo</dt><dd>${safe(dossierValue(s.group))}</dd><dt>Número de lista</dt><dd>${safe(dossierValue(s.number))}</dd><dt>ID del alumno</dt><dd>${safe(dossierValue(s.id))}</dd><dt>Fecha de nacimiento</dt><dd>${safe(formatBirthdate(s.birthdate))}</dd>`;
 $('#dossierContactInfo').innerHTML=`<dt>Correo institucional</dt><dd>${safe(dossierValue(s.email))}</dd><dt>Padre, madre o tutor</dt><dd>${safe(dossierValue(s.guardian))}</dd><dt>Teléfono / WhatsApp</dt><dd>${safe(dossierValue(s.phone))}</dd>`;$('#dossierObservations').textContent=s.observations||'Sin observaciones.';$('#dossierIncidents').textContent=s.incidents||'Sin incidencias registradas.';
 let att=(await all('attendance')).filter(x=>x.studentId===s.id),act=(await all('activityRecords')).filter(x=>x.studentId===s.id),tit=(await all('titularRecords')).filter(x=>x.studentId===s.id&&x.subject!=='OBS'),done=act.filter(x=>x.status==='yes'||typeof x.score==='number').length;
 let pointMethods=(await all('methodologies')).filter(m=>m.gradeRecords?.[s.id]),pointsEarned=pointMethods.reduce((sum,m)=>sum+Number(m.gradeRecords[s.id]?.pointsGenerated||0),0),pointsUsed=pointMethods.reduce((sum,m)=>sum+Number(m.gradeRecords[s.id]?.pointsUsed||0),0),pointsAvailable=Math.max(0,pointsEarned-pointsUsed);
 $('#dossierHistory').innerHTML=`<div class="history-item"><b>${att.length}</b><span>Asistencias registradas</span></div><div class="history-item"><b>${act.length}</b><span>Registros de actividades</span></div><div class="history-item"><b>${done}</b><span>Entregas o calificaciones</span></div><div class="history-item"><b>${tit.length}</b><span>Estados de seguimiento 3.º A</span></div><div class="history-item"><b>${pointsAvailable.toFixed(2)}</b><span>Puntos disponibles</span></div><div class="history-item"><b>${pointMethods.length}</b><span>Meses evaluados</span></div>`;
 let actions=$('#dossierContactActions'),buttons=[];if(sameShift(s.shift,'Matutino'))buttons.push('<button id="dossierWhatsApp" class="primary" type="button">📱 Enviar WhatsApp</button>');if(sameShift(s.shift,'Vespertino'))buttons.push('<button id="dossierGoogleChat" class="primary" type="button">💬 Abrir Google Chat</button>');buttons.push('<button id="dossierCopyEmail" class="secondary" type="button">Copiar correo institucional</button>','<button id="dossierCopyPhone" class="secondary" type="button">Copiar teléfono</button>');actions.innerHTML=buttons.join('');
 $('#dossierCopyEmail').onclick=()=>copyTextValue(s.email,'Correo institucional');$('#dossierCopyPhone').onclick=()=>copyTextValue(s.phone,'Teléfono');if($('#dossierWhatsApp'))$('#dossierWhatsApp').onclick=()=>prepareWhatsApp(s);if($('#dossierGoogleChat'))$('#dossierGoogleChat').onclick=()=>openGoogleChat(s);$('#dossierEdit').onclick=()=>editStudentById(s.id);$('#dossierPdf').onclick=()=>printStudentDossier(s.id);
}
function prepareWhatsApp(s){if(!norm(s.phone))return alert('Este expediente no tiene teléfono registrado.');let msg=`Buen día. Me comunico con usted respecto al seguimiento escolar de ${s.name||'su hijo(a)'}, del grupo ${s.group}.`;showDialog('Preparar mensaje de WhatsApp',`<div class="email-compose"><label>Destinatario<input value="${safe(s.guardian||'Padre, madre o tutor')}" disabled></label><label>Teléfono<input value="${safe(s.phone)}" disabled></label><label>Mensaje editable<textarea id="dossierWhatsAppMessage">${safe(msg)}</textarea></label><p class="email-note">La app abrirá el chat, pero no enviará el mensaje automáticamente.</p><div class="actions"><button id="openPreparedWhatsApp" class="primary" type="button">Abrir WhatsApp</button></div></div>`);$('#openPreparedWhatsApp').onclick=()=>{let phone=normalizeWhatsAppPhone(s.phone);if(phone.length<10)return alert('Revisa el teléfono registrado.');window.open(`https://wa.me/${phone}?text=${encodeURIComponent($('#dossierWhatsAppMessage').value)}`,'_blank');$('#dialog').close()}}
async function openGoogleChat(s){if(!norm(s.email))return alert('Este expediente no tiene correo institucional registrado.');try{await navigator.clipboard.writeText(s.email)}catch(e){}alert('Correo copiado. Pégalo en Google Chat para iniciar la conversación.');window.open('https://chat.google.com/','_blank')}
async function printStudentDossier(id){
 let s=await req(store('students').get(id));if(!s)return alert('No se encontró el alumno.');if(!pdfReady())return alert('No se cargó el generador de PDF. Abre la app con internet y vuelve a intentarlo.');
 let att=(await all('attendance')).filter(x=>x.studentId===s.id),act=(await all('activityRecords')).filter(x=>x.studentId===s.id),tit=(await all('titularRecords')).filter(x=>x.studentId===s.id&&x.subject!=='OBS'),{jsPDF}=window.jspdf,doc=new jsPDF({unit:'mm',format:'a4'});pdfHeader(doc,'Expediente del alumno');doc.setFontSize(10);doc.setFont('helvetica','bold');doc.text('INFORMACIÓN DEL ALUMNO',14,36);
 doc.autoTable({startY:40,body:[['Nombre completo',s.name||'No registrado'],['Turno',s.shift||'No registrado'],['Grupo',String(s.group||'No registrado')],['Número de lista',String(s.number||'No registrado')],['ID del alumno',s.id||'No registrado'],['Fecha de nacimiento',formatBirthdate(s.birthdate)]],styles:{fontSize:9,cellPadding:2},columnStyles:{0:{fontStyle:'bold',cellWidth:48}},theme:'grid'});
 let y=doc.lastAutoTable.finalY+8;doc.setFont('helvetica','bold');doc.text('CONTACTO',14,y);doc.autoTable({startY:y+4,body:[['Correo institucional',s.email||'No registrado'],['Padre, madre o tutor',s.guardian||'No registrado'],['Teléfono / WhatsApp',s.phone||'No registrado']],styles:{fontSize:9,cellPadding:2},columnStyles:{0:{fontStyle:'bold',cellWidth:48}},theme:'grid'});
 y=doc.lastAutoTable.finalY+8;doc.text('HISTORIAL',14,y);doc.autoTable({startY:y+4,head:[['Asistencias','Actividades','Seguimiento 3.º A']],body:[[String(att.length),String(act.length),String(tit.length)]],styles:{fontSize:9,cellPadding:3,halign:'center'},headStyles:{fillColor:[245,196,0],textColor:[33,27,18]}});
 y=doc.lastAutoTable.finalY+8;doc.text('OBSERVACIONES',14,y);doc.setFont('helvetica','normal');let obs=doc.splitTextToSize(s.observations||'Sin observaciones.',180);doc.text(obs,14,y+5);y+=obs.length*4.3+12;doc.setFont('helvetica','bold');doc.text('INCIDENCIAS',14,y);doc.setFont('helvetica','normal');doc.text(doc.splitTextToSize(s.incidents||'Sin incidencias registradas.',180),14,y+5);pdfFooter(doc);
 printContent('Expediente del alumno',`<p><b>Alumno:</b> ${safe(s.name||s.id)}</p><p><b>Grupo:</b> ${safe(s.group)} · <b>Turno:</b> ${safe(s.shift)}</p>`,pdfBlob(doc),`expediente_${(s.name||s.id).replace(/[^a-z0-9]+/gi,'_')}.pdf`);
}
function newCriterionRow(data={}){let id=data.id||crypto.randomUUID();return `<div class="criterion-row" data-criterion-row="${id}"><label>Nombre del criterio<input data-criterion-name value="${safe(data.name||'')}" placeholder="Ej. Actividades y tareas"></label><label>Porcentaje<input data-criterion-percent type="number" min="0" max="100" step="1" value="${Number(data.percent||0)}"></label><button type="button" class="danger-outline" data-remove-criterion>Eliminar</button></div>`}
function addCriterion(data={}){$('#criteriaEditor').insertAdjacentHTML('beforeend',newCriterionRow(data));bindCriterionEditor();updateCriteriaTotal()}
function bindCriterionEditor(){$$('[data-criterion-percent]').forEach(i=>i.oninput=updateCriteriaTotal);$$('[data-remove-criterion]').forEach(b=>b.onclick=()=>{b.closest('[data-criterion-row]').remove();updateCriteriaTotal()})}
function getCriteriaFromEditor(){return $$('[data-criterion-row]').map(row=>({id:row.dataset.criterionRow,name:norm(row.querySelector('[data-criterion-name]').value),percent:Number(row.querySelector('[data-criterion-percent]').value||0)})).filter(x=>x.name)}
function updateCriteriaTotal(){let total=getCriteriaFromEditor().reduce((s,c)=>s+c.percent,0),ok=Math.abs(total-100)<0.001;$('#criteriaTotal').textContent=`${total}%`;$('#criteriaValidation').className=ok?'ok':'bad';$('#criteriaValidation').textContent=ok?'✓ Correcto':'Debe sumar 100%'}

const MONTH_ORDER=['Agosto','Septiembre','Octubre','Noviembre','Diciembre','Enero','Febrero','Marzo','Abril','Mayo','Junio'];
const roundSchoolGrade=value=>{
  if(value===null||value===undefined||Number.isNaN(Number(value)))return null;
  const capped=Math.min(10,Math.max(0,Number(value)));
  const base=Math.floor(capped+1e-9),decimal=capped-base;
  return Math.min(10,decimal>=.6-1e-9?base+1:base);
};
const periodLabel=m=>`${m.month||'Mes sin definir'} · T${m.quarter||'?'} · ${m.cycle||'Ciclo sin definir'}`;
function resetMethodologyForm(){
  $('#methodologyForm').reset();
  $('#metSubject').value='Español';
  $('#metCycle').value=localStorage.getItem('lastSchoolCycle')||'2026-2027';
  $('#metQuarter').value='1';
  $('#metMonth').value='Agosto';
  $('#editMethodologyId').value='';
  $('#methodologyFormTitle').textContent='Nueva metodología';
  $('#cancelMethodologyEdit').classList.add('hidden');
  $('#criteriaEditor').innerHTML='';
  addCriterion({name:'Actividades y tareas',percent:100});
}
async function saveMethodology(e){
  e.preventDefault();
  let criteria=getCriteriaFromEditor(),total=criteria.reduce((s,c)=>s+c.percent,0);
  if(!criteria.length)return alert('Agrega al menos un criterio.');
  if(Math.abs(total-100)>0.001)return alert('Los porcentajes deben sumar exactamente 100%.');
  let id=$('#editMethodologyId').value||crypto.randomUUID(),old=await req(store('methodologies').get(id));
  let cycle=norm($('#metCycle').value);
  localStorage.setItem('lastSchoolCycle',cycle);
  let m={
    id,shift:$('#metShift').value,group:$('#metGroup').value,
    name:norm($('#metName').value),subject:norm($('#metSubject').value)||'Español',
    cycle,quarter:Number($('#metQuarter').value),month:$('#metMonth').value,
    criteria,assignments:old?.assignments||{},gradeRecords:old?.gradeRecords||{},
    closed:old?.closed||false,closedAt:old?.closedAt||null,
    created:old?.created||new Date().toISOString(),updated:new Date().toISOString()
  };
  await put('methodologies',m);
  resetMethodologyForm();await renderMethodologies();await refreshCalculationMethodologies();
  alert('Metodología guardada.');
}
async function editMethodology(id){
  let m=await req(store('methodologies').get(id));if(!m)return;
  $('#editMethodologyId').value=m.id;
  $('#metShift').value=[...$('#metShift').options].find(o=>sameShift(o.value,m.shift))?.value||m.shift;
  await fillGroups('met');
  $('#metGroup').value=[...$('#metGroup').options].find(o=>sameGroup(o.value,m.group))?.value||m.group;
  $('#metName').value=m.name;$('#metSubject').value=m.subject||'Español';
  $('#metCycle').value=m.cycle||'2026-2027';$('#metQuarter').value=String(m.quarter||1);
  $('#metMonth').value=MONTH_ORDER.includes(m.month)?m.month:'Agosto';
  $('#criteriaEditor').innerHTML='';m.criteria.forEach(addCriterion);
  $('#methodologyFormTitle').textContent='Editar metodología';
  $('#cancelMethodologyEdit').classList.remove('hidden');pane('met','manage');
  $('#methodologyForm').scrollIntoView({behavior:'smooth'});
}
async function renderMethodologies(){
  if(!db)return;
  let list=(await all('methodologies')).sort((a,b)=>
    String(b.cycle||'').localeCompare(String(a.cycle||''))||
    Number(a.quarter||0)-Number(b.quarter||0)||
    MONTH_ORDER.indexOf(a.month)-MONTH_ORDER.indexOf(b.month)
  ),box=$('#methodologiesList');
  if(!list.length){box.className='list empty';box.textContent='No hay metodologías.';return}
  box.className='list';
  box.innerHTML=list.map(m=>`<div class="row"><div><strong>${safe(m.name)}</strong> ${m.closed?'<span class="month-closed">Mes cerrado</span>':'<span class="month-open">Mes abierto</span>'}<small>${safe(m.subject||'Español')} · ${safe(periodLabel(m))} · ${safe(m.shift)} · Grupo ${safe(m.group)} · ${m.criteria.map(c=>`${safe(c.name)} ${c.percent}%`).join(' · ')}</small></div><div class="rowactions"><button class="edit" data-metedit="${m.id}">Editar</button><button class="secondary" data-metcopy="${m.id}">Nuevo mes</button><button class="del" data-metdel="${m.id}">Eliminar</button></div></div>`).join('');
  $$('[data-metedit]').forEach(b=>b.onclick=()=>editMethodology(b.dataset.metedit));
  $$('[data-metcopy]').forEach(b=>b.onclick=()=>startNewMonth(b.dataset.metcopy));
  $$('[data-metdel]').forEach(b=>b.onclick=async()=>{if(confirm('¿Eliminar esta metodología y sus resultados mensuales guardados? Las actividades originales no se borrarán.')){await del('methodologies',b.dataset.metdel);renderMethodologies();refreshCalculationMethodologies()}});
}
async function refreshMethodologyUI(){
  if(!$('#criteriaEditor').children.length)resetMethodologyForm();
  await renderMethodologies();await refreshCalculationMethodologies();await refreshQuarterSelectors();
}
async function refreshCalculationMethodologies(){
  if(!db)return;
  let shift=$('#calcMetShift')?.value,group=$('#calcMetGroup')?.value,allM=await all('methodologies'),
      filtered=allM.filter(m=>sameShift(m.shift,shift)&&sameGroup(m.group,group)),
      sel=$('#calcMethodology');
  if(!sel)return;
  let old=sel.value;
  sel.innerHTML=filtered.length?filtered.map(m=>`<option value="${m.id}">${safe(m.name)} · ${safe(m.month||'Sin mes')} · ${safe(m.cycle||'Sin ciclo')}${m.closed?' · CERRADO':''}</option>`).join(''):'<option value="">Sin metodología</option>';
  if(filtered.some(m=>m.id===old))sel.value=old;
  await renderMethodologyAssignments();
}
async function renderMethodologyAssignments(){
  let id=$('#calcMethodology').value,box=$('#methodologyAssignments');
  if(!id){box.className='list empty';box.textContent='Selecciona una metodología.';$('#methodologyResults').innerHTML='<div class="empty">Pulsa Calcular.</div>';$('#methodologyMonthActions').classList.add('hidden');return}
  let m=await req(store('methodologies').get(id)),
      acts=(await all('activities')).filter(a=>sameShift(a.shift,m.shift)&&sameGroup(a.group,m.group)).sort(activitySort);
  $('#methodologyMonthActions').classList.remove('hidden');
  $('#closeMethodologyMonthBtn').textContent=m.closed?'Reabrir mes':'Cerrar mes';
  if(!acts.length){box.className='list empty';box.textContent='No hay actividades creadas para este grupo.';return}
  box.className='list';
  box.innerHTML=acts.map(a=>`<div class="assignment-row"><div><strong>${safe(a.name)} <span class="activity-mode ${a.evaluationMode||'delivery'}">${(a.evaluationMode||'delivery')==='numeric'?'Numérica 0–10':'Entrega 1/0'}</span></strong><small>${safe(a.week)} · ${safe(a.date)} · ${safe(a.type||'Actividad')}</small></div><select data-assignment="${a.id}" ${m.closed?'disabled':''}><option value="">Sin asignar</option>${m.criteria.map(c=>`<option value="${c.id}" ${m.assignments?.[a.id]===c.id?'selected':''}>${safe(c.name)} (${c.percent}%)</option>`).join('')}</select></div>`).join('');
}
async function saveAssignments(){
  let id=$('#calcMethodology').value;if(!id)return alert('Selecciona una metodología.');
  let m=await req(store('methodologies').get(id));if(m.closed)return alert('El mes está cerrado. Reábrelo para modificar asignaciones.');
  let assignments={};$$('[data-assignment]').forEach(s=>{if(s.value)assignments[s.dataset.assignment]=s.value});
  m.assignments=assignments;m.updated=new Date().toISOString();await put('methodologies',m);alert('Asignaciones guardadas.');
}
async function pointsLedgerFor(m,studentId,excludeCurrent=true){
  let methods=(await all('methodologies')).filter(x=>sameShift(x.shift,m.shift)&&sameGroup(x.group,m.group)&&String(x.cycle||'')===String(m.cycle||''));
  let earned=0,used=0,history=[];
  for(const x of methods){
    if(excludeCurrent&&x.id===m.id)continue;
    let r=x.gradeRecords?.[studentId];if(!r)continue;
    let e=Number(r.pointsGenerated||0),u=Number(r.pointsUsed||0);
    earned+=e;used+=u;
    if(e>0)history.push({month:x.month,type:'earned',amount:e});
    if(u>0)history.push({month:x.month,type:'used',amount:u});
  }
  return {earned,used,available:Math.max(0,earned-used),history};
}
async function calculateMethodology(){
  let id=$('#calcMethodology').value;if(!id)return alert('Selecciona una metodología.');
  let m=await req(store('methodologies').get(id)),total=m.criteria.reduce((s,c)=>s+Number(c.percent),0);
  if(Math.abs(total-100)>0.001)return alert('Los criterios de esta metodología no suman 100%. Edítala antes de calcular.');
  let acts=(await all('activities')).filter(a=>m.assignments?.[a.id]);
  if(!acts.length)return alert('Asigna al menos una actividad a un criterio.');
  let roster=(await students()).filter(s=>sameShift(s.shift,m.shift)&&sameGroup(s.group,m.group)),
      records=await all('activityRecords'),map=new Map(records.map(r=>[r.key,r])),rows=[];
  m.gradeRecords=m.gradeRecords||{};
  for(const st of roster){
    let criterionGrades={},pending=[];
    for(const c of m.criteria){
      let ca=acts.filter(a=>m.assignments[a.id]===c.id),values=[];
      for(const a of ca){
        let rec=map.get(`${a.id}|${st.id}`),mode=a.evaluationMode||'delivery';
        if(mode==='numeric'){if(typeof rec?.score==='number')values.push(rec.score);else pending.push(a.name)}
        else{if(rec?.status==='yes')values.push(10);else if(rec?.status==='no')values.push(0);else pending.push(a.name)}
      }
      criterionGrades[c.id]=ca.length&&values.length===ca.length?values.reduce((x,y)=>x+y,0)/values.length:null;
    }
    let complete=pending.length===0&&m.criteria.every(c=>acts.some(a=>m.assignments[a.id]===c.id)&&criterionGrades[c.id]!==null),
        base=complete?m.criteria.reduce((sum,c)=>sum+(criterionGrades[c.id]*(c.percent/100)),0):null,
        prior=m.gradeRecords[st.id]||{},manualExtra=Number(prior.manualExtra||0),pointsUsed=Number(prior.pointsUsed||0),
        ledger=await pointsLedgerFor(m,st.id,true),maxUsable=ledger.available,
        safeUsed=Math.min(pointsUsed,maxUsable),raw=base===null?null:base+manualExtra+safeUsed,
        finalDecimal=raw===null?null:Math.min(10,Math.max(0,raw)),
        rounded=finalDecimal===null?null:roundSchoolGrade(finalDecimal),
        pointsGenerated=raw===null?0:Math.max(0,raw-10);
    m.gradeRecords[st.id]={...prior,base,manualExtra,pointsUsed:safeUsed,finalDecimal,rounded,pointsGenerated,updated:new Date().toISOString()};
    rows.push({student:st,criterionGrades,pending:[...new Set(pending)],base,final:finalDecimal,manualExtra,pointsUsed:safeUsed,finalDecimal,rounded,pointsGenerated,pointsAvailable:Math.max(0,maxUsable-safeUsed),pointsTotalBefore:maxUsable});
  }
  await put('methodologies',m);
  window._lastMethodologyCalculation={methodology:m,activities:acts,rows};
  renderMethodologyResults(window._lastMethodologyCalculation);
}
function renderMethodologyResults(data){
  let {methodology:m,rows}=data,box=$('#methodologyResults');
  box.innerHTML=`<div class="methodology-summary"><strong>${safe(m.name)}</strong> · ${safe(m.subject||'Español')} · ${safe(periodLabel(m))} · ${safe(m.shift)} · Grupo ${safe(m.group)} · ${m.closed?'<span class="month-closed">Mes cerrado</span>':'<span class="month-open">Mes abierto</span>'}<br>${m.criteria.map(c=>`${safe(c.name)}: ${c.percent}%`).join(' · ')}</div>
  <table class="matrix"><thead><tr><th>#</th><th class="name">Alumno</th>${m.criteria.map(c=>`<th>${safe(c.name)}<br>${c.percent}%</th>`).join('')}<th>Base decimal</th><th>Extra manual</th><th class="points-cell">Puntos disponibles</th><th>Usados</th><th>Final decimal</th><th>Redondeada</th><th>Pendientes</th></tr></thead><tbody>
  ${rows.map(r=>`<tr><td>${r.student.number}</td><td class="name">${safe(r.student.name||r.student.id)}</td>${m.criteria.map(c=>`<td>${r.criterionGrades[c.id]===null?'—':r.criterionGrades[c.id].toFixed(1)}</td>`).join('')}
  <td>${r.base===null?'Pendiente':r.base.toFixed(2)}</td>
  <td><input class="extra-input" data-extra-student="${safe(r.student.id)}" type="number" min="0" step="0.1" value="${Number(r.manualExtra||0).toFixed(1)}" ${m.closed?'disabled':''}></td>
  <td class="points-cell"><span class="points-positive">${r.pointsAvailable.toFixed(2)}</span>${m.closed?'':`<button class="secondary" data-use-points="${safe(r.student.id)}">Usar puntos disponibles</button>`}</td>
  <td>${r.pointsUsed.toFixed(2)}${!m.closed&&r.pointsUsed>0?`<br><button class="secondary" data-return-points="${safe(r.student.id)}">Devolver</button>`:''}</td>
  <td class="${r.finalDecimal===null?'grade-pending':'grade-good'}">${r.finalDecimal===null?'Pendiente':r.finalDecimal.toFixed(2)}${r.pointsGenerated>0?`<br><small>Genera ${r.pointsGenerated.toFixed(2)} puntos</small>`:''}</td>
  <td class="grade-rounded">${r.rounded===null?'—':r.rounded}</td><td>${r.pending.length?safe(r.pending.join(', ')):'—'}</td></tr>`).join('')}
  </tbody></table>`;
  $$('[data-extra-student]').forEach(input=>input.onchange=()=>saveManualExtra(input.dataset.extraStudent,input.value));
  $$('[data-use-points]').forEach(b=>b.onclick=()=>openUsePointsDialog(b.dataset.usePoints));
  $$('[data-return-points]').forEach(b=>b.onclick=()=>returnUsedPoints(b.dataset.returnPoints));
}
async function saveManualExtra(studentId,value){
  let id=$('#calcMethodology').value,m=await req(store('methodologies').get(id));if(m.closed)return;
  m.gradeRecords=m.gradeRecords||{};m.gradeRecords[studentId]=m.gradeRecords[studentId]||{};
  m.gradeRecords[studentId].manualExtra=Math.max(0,Number(value||0));await put('methodologies',m);await calculateMethodology();
}
async function openUsePointsDialog(studentId){
  let data=window._lastMethodologyCalculation;if(!data)return;
  let row=data.rows.find(r=>r.student.id===studentId);if(!row)return;
  let available=row.pointsAvailable+row.pointsUsed;
  showDialog('Usar puntos disponibles',`<p><b>Alumno:</b> ${safe(row.student.name||row.student.id)}</p><div class="period-summary">Disponibles antes de aplicar: <b>${available.toFixed(2)}</b><br>Calificación base con extras: <b>${row.base===null?'Pendiente':(row.base+row.manualExtra).toFixed(2)}</b></div><label>¿Cuántos puntos deseas aplicar?<input id="pointsAmountInput" class="points-modal-number" type="number" inputmode="decimal" min="0" max="${available}" step="0.1" value="${row.pointsUsed.toFixed(2)}"></label><div class="quick-points"><button type="button" data-pquick="0.1">+0.1</button><button type="button" data-pquick="0.2">+0.2</button><button type="button" data-pquick="0.5">+0.5</button><button type="button" data-pall>Usar todos</button></div><div class="actions"><button id="applyPointsBtn" class="primary" type="button">Aplicar puntos</button><button id="cancelPointsBtn" class="secondary" type="button">Cancelar</button></div>`);
  const input=$('#pointsAmountInput');
  $$('[data-pquick]').forEach(b=>b.onclick=()=>input.value=Math.min(available,Number(input.value||0)+Number(b.dataset.pquick)).toFixed(2));
  $('[data-pall]').onclick=()=>input.value=available.toFixed(2);
  $('#cancelPointsBtn').onclick=()=>$('#dialog').close();
  $('#applyPointsBtn').onclick=async()=>{
    let amount=Math.max(0,Number(input.value||0));
    if(amount>available+0.0001)return alert('No puedes aplicar más puntos de los disponibles.');
    let m=await req(store('methodologies').get($('#calcMethodology').value));m.gradeRecords=m.gradeRecords||{};m.gradeRecords[studentId]=m.gradeRecords[studentId]||{};m.gradeRecords[studentId].pointsUsed=amount;await put('methodologies',m);$('#dialog').close();await calculateMethodology();
  };
}
async function returnUsedPoints(studentId){
  if(!confirm('¿Devolver los puntos utilizados en este mes?'))return;
  let m=await req(store('methodologies').get($('#calcMethodology').value));m.gradeRecords=m.gradeRecords||{};m.gradeRecords[studentId]=m.gradeRecords[studentId]||{};m.gradeRecords[studentId].pointsUsed=0;await put('methodologies',m);await calculateMethodology();
}
async function toggleCloseMethodologyMonth(){
  let id=$('#calcMethodology').value;if(!id)return alert('Selecciona una metodología.');
  let m=await req(store('methodologies').get(id));
  if(!m.closed){
    await calculateMethodology();
    if(!window._lastMethodologyCalculation?.rows?.length)return;
    if(!confirm('Al cerrar el mes se bloquearán extras, puntos y asignaciones. ¿Cerrar?'))return;
    m=await req(store('methodologies').get(id));m.closed=true;m.closedAt=new Date().toISOString();
  }else{
    if(!confirm('¿Reabrir este mes para hacer correcciones?'))return;
    m.closed=false;m.closedAt=null;
  }
  await put('methodologies',m);await renderMethodologyAssignments();await calculateMethodology();await renderMethodologies();
}
async function startNewMonth(id=null){
  let sourceId=id||$('#calcMethodology').value;if(!sourceId)return alert('Selecciona una metodología.');
  let m=await req(store('methodologies').get(sourceId)),currentIndex=MONTH_ORDER.indexOf(m.month),nextMonth=MONTH_ORDER[(currentIndex+1)%MONTH_ORDER.length];
  let chosen=prompt('Escribe el mes que deseas iniciar:',nextMonth);if(!chosen)return;
  let newM={...m,id:crypto.randomUUID(),name:`${m.subject||'Evaluación'} · ${chosen}`,month:chosen,assignments:{},gradeRecords:{},closed:false,closedAt:null,created:new Date().toISOString(),updated:new Date().toISOString()};
  await put('methodologies',newM);await renderMethodologies();await refreshCalculationMethodologies();$('#calcMethodology').value=newM.id;await renderMethodologyAssignments();alert(`Se inició ${chosen} desde cero. El mes anterior permanece guardado.`);
}
async function printMethodology(){
  let data=window._lastMethodologyCalculation;if(!data){await calculateMethodology();data=window._lastMethodologyCalculation}if(!data)return;
  if(!pdfReady())return alert('No se cargó el generador de PDF.');
  let {methodology:m,rows}=data,{jsPDF}=window.jspdf,doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
  pdfHeader(doc,'Cálculo mensual de metodología',(m.subject||'Español').toUpperCase());
  doc.setFontSize(10);doc.text(`${m.name} · ${periodLabel(m)} · ${m.shift} · Grupo ${m.group}`,14,36);
  let head=[['#','Alumno',...m.criteria.map(c=>`${c.name} (${c.percent}%)`),'Base','Extra','Puntos usados','Final decimal','Redondeada','Puntos generados']],
      body=rows.map(r=>[String(r.student.number),r.student.name||r.student.id,...m.criteria.map(c=>r.criterionGrades[c.id]===null?'—':r.criterionGrades[c.id].toFixed(1)),r.base===null?'Pendiente':r.base.toFixed(2),r.manualExtra.toFixed(2),r.pointsUsed.toFixed(2),r.finalDecimal===null?'Pendiente':r.finalDecimal.toFixed(2),r.rounded===null?'—':String(r.rounded),r.pointsGenerated.toFixed(2)]);
  doc.autoTable({startY:41,head,body,styles:{fontSize:6.7,cellPadding:1.4,valign:'middle'},headStyles:{fillColor:[245,196,0],textColor:[33,27,18]},columnStyles:{1:{cellWidth:43}}});pdfFooter(doc);
  printContent('Cálculo mensual',`<p><b>${safe(m.name)}</b> · ${safe(periodLabel(m))}</p>`+$('#methodologyResults').innerHTML,pdfBlob(doc),`metodologia_${m.group}_${m.month}_${m.cycle}.pdf`);
}


function scoreForActivity(activity, studentId, recordMap){
  const rec=recordMap.get(`${activity.id}|${studentId}`);
  const mode=activity.evaluationMode||'delivery';
  if(mode==='numeric') return typeof rec?.score==='number'?rec.score:null;
  if(rec?.status==='yes') return 10;
  if(rec?.status==='no') return 0;
  return null;
}
function criterionColor(index){
  const colors=[
    [91,55,145],
    [53,83,145],
    [0,137,123],
    [185,91,23],
    [147,51,84],
    [70,88,108]
  ];
  return colors[index%colors.length];
}
async function printMethodologyIndividuals(){
  let data=window._lastMethodologyCalculation;
  if(!data){
    await calculateMethodology();
    data=window._lastMethodologyCalculation;
  }
  if(!data)return;
  if(!pdfReady())return alert('No se cargó el generador de PDF. Conéctate a internet, pulsa Actualizar app y vuelve a intentarlo.');

  const {methodology:m,activities,rows}=data;
  if(!m.month){
    const entered=prompt('Escribe el mes evaluado para el encabezado:', '');
    if(!entered)return;
    m.month=entered.trim();
    try{await put('methodologies',m)}catch(_){}
  }

  const records=await all('activityRecords');
  const recordMap=new Map(records.map(r=>[r.key,r]));
  const {jsPDF}=window.jspdf;
  const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
  const subject=m.subject||'Español';
  const teacher='Profr. Jaime Armando Pérez Vázquez';

  rows.forEach((row,rowIndex)=>{
    if(rowIndex>0)doc.addPage();
    const student=row.student;
    const finalText=row.final===null?'PENDIENTE':row.final.toFixed(1);

    // Main header
    doc.setFillColor(245,196,0);
    doc.rect(0,0,210,31,'F');
    doc.setFillColor(201,35,45);
    doc.rect(0,29,210,3,'F');
    doc.setTextColor(33,27,18);
    doc.setFont('helvetica','bold');
    doc.setFontSize(16);
    doc.text('EL AULA DEL PROFE JAIME',14,9);
    doc.setFontSize(12);
    doc.text(subject.toUpperCase(),14,17);
    doc.setFontSize(10);
    doc.text(`Docente: ${teacher}`,14,24);

    // Student and final
    doc.setTextColor(33,27,18);
    doc.setFontSize(12);
    doc.text(`Alumno: ${student.name||student.id}`,14,39);
    doc.setFontSize(9);
    doc.text(`Grupo: ${m.group}   No. de lista: ${student.number}   Mes evaluado: ${m.month||'Sin definir'}`,14,45);
    doc.setFont('helvetica','bold');
    doc.setFontSize(11);
    doc.text('CALIFICACIÓN FINAL',158,37);
    doc.setFontSize(20);
    if(row.final===null)doc.setTextColor(180,83,9); else doc.setTextColor(22,101,52);
    doc.text(finalText,177,47,{align:'center'});
    doc.setTextColor(33,27,18);

    let y=55;
    m.criteria.forEach((criterion,criterionIndex)=>{
      const criterionActivities=activities.filter(a=>m.assignments?.[a.id]===criterion.id);
      const criterionGrade=row.criterionGrades[criterion.id];
      const contribution=criterionGrade===null?null:criterionGrade*(Number(criterion.percent)/100);
      const color=criterionColor(criterionIndex);

      if(y>245){
        doc.addPage();
        y=18;
      }

      doc.setFillColor(...color);
      doc.rect(12,y,186,13,'F');
      doc.setTextColor(255,255,255);
      doc.setFont('helvetica','bold');
      doc.setFontSize(11);
      doc.text(criterion.name,16,y+8);
      doc.text(`${criterion.percent.toFixed?criterion.percent.toFixed(0):criterion.percent}%`,155,y+8,{align:'right'});
      doc.text(contribution===null?'Pendiente':contribution.toFixed(2),193,y+8,{align:'right'});
      y+=13;

      if(!criterionActivities.length){
        doc.setFillColor(247,247,247);
        doc.rect(12,y,186,10,'F');
        doc.setTextColor(90,90,90);
        doc.setFont('helvetica','normal');
        doc.setFontSize(9);
        doc.text('Sin actividades asignadas a este criterio.',16,y+6.5);
        y+=10;
      }else{
        criterionActivities.forEach((activity,activityIndex)=>{
          const score=scoreForActivity(activity,student.id,recordMap);
          if(y>273){
            doc.addPage();
            y=18;
          }
          if(activityIndex%2===1)doc.setFillColor(242,242,242);
          else doc.setFillColor(255,255,255);
          doc.rect(12,y,186,10,'F');
          doc.setTextColor(33,33,33);
          doc.setFont('helvetica','normal');
          doc.setFontSize(9.5);
          const activityName=doc.splitTextToSize(activity.name,145);
          doc.text(activityName[0],16,y+6.5);
          doc.setFont('helvetica','bold');
          doc.text(score===null?'—':score.toFixed(1),193,y+6.5,{align:'right'});
          y+=10;
        });
      }
      y+=5;
    });

    if(row.pending.length){
      if(y>255){doc.addPage();y=18}
      doc.setFillColor(255,247,220);
      doc.rect(12,y,186,18,'F');
      doc.setTextColor(150,80,0);
      doc.setFont('helvetica','bold');
      doc.setFontSize(9);
      doc.text('ACTIVIDADES PENDIENTES DE CALIFICAR:',16,y+6);
      doc.setFont('helvetica','normal');
      doc.text(doc.splitTextToSize(row.pending.join(', '),176),16,y+11);
    }

    doc.setTextColor(90,90,90);
    doc.setFontSize(7.5);
    doc.text(`Metodología: ${m.name}`,14,286);
  });

  pdfFooter(doc);
  const preview=`<p><b>Materia:</b> ${safe(subject)} · <b>Mes:</b> ${safe(m.month||'Sin definir')}</p>
  <p><b>Docente:</b> ${safe(teacher)}</p>
  <p>Se generó un solo archivo con <b>${rows.length} páginas</b>: una hoja por alumno, con criterios, porcentajes, aportaciones y actividades.</p>`;
  printContent(
    'Reportes individuales de metodología',
    preview,
    pdfBlob(doc),
    `reportes_individuales_${m.group}_${(m.month||m.name).replace(/[^a-z0-9]+/gi,'_')}.pdf`
  );
}

async function snapshotData(){await ensureDB();let data={version:'7.4',created:new Date().toISOString()};for(let n of ['students','attendance','activities','activityRecords','titularWeeks','titularRecords','settings','methodologies'])data[n]=await all(n);return data}
async function showLastInternalSave(){if(!$('#lastInternalSave'))return;try{await ensureDB();let b=await req(store('internalBackups').get('latest'));if(!b){try{b=JSON.parse(localStorage.getItem(LOCAL_BACKUP_KEY)||'null')}catch(e){}}$('#lastInternalSave').textContent=b?`Último guardado interno: ${new Date(b.created).toLocaleString('es-MX')}`:'Todavía no hay un guardado interno adicional.'}catch(e){$('#lastInternalSave').textContent='No fue posible consultar el último guardado.'}}
async function saveInternal(showMessage=true){try{await ensureDB();if(navigator.storage?.persist)await navigator.storage.persist();let data=await snapshotData();let backup={id:'latest',created:data.created,data};await req(store('internalBackups','readwrite').put(backup));try{localStorage.setItem(LOCAL_BACKUP_KEY,JSON.stringify(backup))}catch(e){}await showLastInternalSave();for(let id of ['saveAllTop','homeSaveAll','backupBtn','saveAllReports']){let b=$('#'+id);if(b){let old=b.textContent;b.textContent='✓ Guardado en la app';setTimeout(()=>b.textContent=old,1800)}}if(showMessage)showDialog('Guardado completo','<p><strong>Todo quedó guardado dentro de esta app en el iPad.</strong></p><p>La app también guarda automáticamente cada asistencia, actividad y cambio en cuanto lo realizas.</p><p class="warning-note">No elimines el ícono de la pantalla de inicio: iPadOS puede borrar los datos locales de la app instalada.</p>')}catch(e){alert('No fue posible crear el guardado interno: '+e.message)}}
async function restoreInternal(){await ensureDB();let b=await req(store('internalBackups').get('latest'));if(!b){try{b=JSON.parse(localStorage.getItem(LOCAL_BACKUP_KEY)||'null')}catch(e){}}if(!b)return alert('Todavía no existe un guardado interno.');if(!confirm(`¿Restaurar el guardado del ${new Date(b.created).toLocaleString('es-MX')}? Se reemplazarán los datos actuales.`))return;let d=b.data;for(let n of ['students','attendance','activities','activityRecords','titularWeeks','titularRecords','settings','methodologies'])if(Array.isArray(d[n])){await clear(n);for(let x of d[n])await put(n,x)}await fillSelectors();await refreshAttendance();await refreshHome();alert('Guardado interno restaurado.')}
async function exportBackup(){
  try{
    let data=await snapshotData();
    data.backupType='EL_AULA_DEL_PROFE_JAIME_FULL_BACKUP';
    data.appVersion='5.7';
    data.exportedAt=new Date().toISOString();
    data.counts={
      students:data.students?.length||0,
      attendance:data.attendance?.length||0,
      activities:data.activities?.length||0,
      activityRecords:data.activityRecords?.length||0,
      methodologies:data.methodologies?.length||0,
      titularWeeks:data.titularWeeks?.length||0,
      titularRecords:data.titularRecords?.length||0
    };
    download(`respaldo_el_aula_del_profe_jaime_${today()}.json`,JSON.stringify(data,null,2));
    showDialog('Respaldo exportado',`<p><strong>El archivo se descargó correctamente.</strong></p>
      <div class="backup-summary">
        <div>Alumnos: <b>${data.counts.students}</b></div>
        <div>Asistencias: <b>${data.counts.attendance}</b></div>
        <div>Actividades: <b>${data.counts.activities}</b></div>
        <div>Registros de actividad: <b>${data.counts.activityRecords}</b></div>
        <div>Metodologías: <b>${data.counts.methodologies}</b></div>
        <div>Registros de 3.º A: <b>${data.counts.titularRecords}</b></div>
      </div>
      <p>Guárdalo en iCloud Drive, OneDrive o Google Drive. Este archivo es el que debes importar en el nuevo dispositivo.</p>`);
  }catch(e){alert('No fue posible exportar el respaldo: '+e.message)}
}
async function restore(file){
  try{
    const text=await file.text();
    const data=JSON.parse(text);
    const required=['students','attendance','activities','activityRecords','titularWeeks','titularRecords','settings'];
    if(!data||typeof data!=='object'||!required.some(k=>Array.isArray(data[k]))){
      throw new Error('El archivo no parece ser un respaldo válido de El Aula del Profe Jaime.');
    }
    const counts={
      students:data.students?.length||0,
      attendance:data.attendance?.length||0,
      activities:data.activities?.length||0,
      activityRecords:data.activityRecords?.length||0,
      methodologies:data.methodologies?.length||0,
      titularWeeks:data.titularWeeks?.length||0,
      titularRecords:data.titularRecords?.length||0
    };
    const ok=confirm(
      `Se importará este respaldo:\n\n`+
      `Alumnos: ${counts.students}\n`+
      `Asistencias: ${counts.attendance}\n`+
      `Actividades: ${counts.activities}\n`+
      `Registros de actividad: ${counts.activityRecords}\n`+
      `Metodologías: ${counts.methodologies}\n`+
      `Registros de 3.º A: ${counts.titularRecords}\n\n`+
      `La información actual de esta app será reemplazada. ¿Continuar?`
    );
    if(!ok)return;
    await ensureDB();
    const names=['students','attendance','activities','activityRecords','titularWeeks','titularRecords','settings','methodologies'];
    for(const name of names){
      if(!db.objectStoreNames.contains(name))continue;
      await req(store(name,'readwrite').clear());
      for(const item of (data[name]||[]))await req(store(name,'readwrite').put(item));
    }
    await saveInternal(false);
    await refreshAll();
    showDialog('Respaldo restaurado',`<p><strong>La información se importó correctamente.</strong></p>
      <div class="backup-summary">
        <div>Alumnos: <b>${counts.students}</b></div>
        <div>Asistencias: <b>${counts.attendance}</b></div>
        <div>Actividades: <b>${counts.activities}</b></div>
        <div>Registros de actividad: <b>${counts.activityRecords}</b></div>
        <div>Metodologías: <b>${counts.methodologies}</b></div>
        <div>Registros de 3.º A: <b>${counts.titularRecords}</b></div>
      </div>
      <p>La app ya puede usarse en este dispositivo.</p>`);
  }catch(e){alert('No fue posible importar el respaldo: '+e.message)}
}
async function openTitularEmailDialog(){
  const data=await getTitularReportData();if(!data)return;const {student:s,week:w}=data,recipient=(s.email||'').trim(),defaultSubject=`Seguimiento académico 3.º A - ${s.name||s.id} - ${w.label}`,defaultBody=`Buen día:\n\nAdjunto el reporte de seguimiento académico correspondiente a ${s.name||s.id}, de la semana ${w.label}.\n\nEste reporte es informativo y no sustituye la información oficial publicada en Systelar. Se recomienda revisar constantemente dicha plataforma.\n\nAtentamente,\nProfr. Jaime Armando Pérez Vázquez`;const bodyHtml=`<div class="email-compose"><label>Destinatario<input id="emailRecipient" type="email" value="${safe(recipient)}" placeholder="Correo institucional del alumno"></label><label>Asunto<input id="emailSubject" value="${safe(defaultSubject)}"></label><label>Mensaje<textarea id="emailBody">${safe(defaultBody)}</textarea></label><div class="pdf-email-note"><b>El reporte se compartirá como archivo PDF.</b><br>Al continuar, selecciona Gmail en el menú de compartir. Si Gmail no coloca el destinatario, pega el correo que la app intentará copiar.</div><div class="actions"><button id="sharePdfEmail" class="primary" type="button">Adjuntar PDF y abrir Gmail</button></div></div>`;showDialog('Enviar reporte PDF por correo',bodyHtml);$('#sharePdfEmail').onclick=async()=>{const to=$('#emailRecipient').value.trim(),subject=$('#emailSubject').value,body=$('#emailBody').value;if(!to)return alert('El alumno no tiene correo registrado. Escríbelo o agrégalo en la sección Alumnos.');const report=await buildTitularPdfBlobV55();if(!report)return;try{if(navigator.clipboard){try{await navigator.clipboard.writeText(to)}catch(_){}}const file=new File([report.blob],report.fileName,{type:'application/pdf'});if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){await navigator.share({title:subject,text:`${body}\n\nDestinatario: ${to}`,files:[file]});$('#dialog').close()}else alert('Este iPad no permite adjuntar el PDF directamente. Usa Generar PDF, guárdalo y adjúntalo desde Gmail.')}catch(e){if(e.name!=='AbortError')alert('No se pudo abrir el menú para compartir. Genera el PDF y adjúntalo manualmente desde Gmail.')}};
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
const authEnc=new TextEncoder();
const authHex=buf=>[...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
const authSalt=()=>authHex(crypto.getRandomValues(new Uint8Array(16)));
function generateTempPortalPin(){let a=new Uint32Array(1);crypto.getRandomValues(a);return String(100000+(a[0]%900000))}
async function hashPortalPin(pin,salt,iterations=120000){let key=await crypto.subtle.importKey('raw',authEnc.encode(String(pin)),'PBKDF2',false,['deriveBits']),bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:authEnc.encode(salt),iterations,hash:'SHA-256'},key,256);return authHex(bits)}
async function ensurePortalPinsForStudent(s){
 if(!s||!sameShift(s.shift,'Matutino'))return;
 for(const role of ['student','parent']){
   let existing=await getPortalAuthRecord(s.id,role);
   if(existing)continue;
   let pin=generateTempPortalPin(),salt=authSalt(),hash=await hashPortalPin(pin,salt);
   await put('portalAuth',{id:`${s.id}|${role}`,studentId:s.id,role,salt,pinHash:hash,tempPinReveal:pin,iterations:120000,mustChange:true,failedAttempts:0,lockedUntil:0,updated:new Date().toISOString()});
 }
}
async function getPortalAuthRecord(studentId,role){return req(store('portalAuth').get(`${studentId}|${role}`))}
async function createOrResetPortalPin(studentId,role){
 let s=await req(store('students').get(studentId));if(!s)return;
 if(!sameShift(s.shift,'Matutino'))return alert('Los portales solo están habilitados para el turno matutino.');
 let pin=generateTempPortalPin(),salt=authSalt(),hash=await hashPortalPin(pin,salt);
 await put('portalAuth',{id:`${studentId}|${role}`,studentId,role,salt,pinHash:hash,tempPinReveal:pin,iterations:120000,mustChange:true,failedAttempts:0,lockedUntil:0,updated:new Date().toISOString()});
 showDialog(role==='student'?'PIN temporal del alumno':'PIN temporal del padre',`<p><b>Alumno:</b> ${safe(s.name||s.id)}</p><p>Entrega este PIN únicamente a ${role==='student'?'el alumno':'su padre, madre o tutor'}.</p><div class="temp-pin-result">${pin}</div><p class="hint">El PIN temporal dejará de funcionar cuando el usuario cree su PIN personal. Si se pierde, puedes restablecerlo desde este expediente.</p>`);
 await renderPortalAccess(s);await renderPortalAccessReport();
}

function portalAuthState(a){
 if(!a)return {key:'none',label:'⚪ No activado',cls:'gray'};
 if(Number(a.lockedUntil||0)>Date.now())return {key:'locked',label:'🔴 Acceso bloqueado',cls:'red'};
 if(a.mustChange)return {key:'temp',label:'🟡 PIN temporal generado',cls:'yellow'};
 return {key:'active',label:'🟢 Cuenta activada',cls:'green'};
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
 const students=(await all('students')).filter(s=>sameShift(s.shift,'Matutino')).sort((a,b)=>(a.name||'').localeCompare(b.name||'','es'));
 let rows=[],counts={studentActive:0,studentPending:0,parentActive:0,parentPending:0};
 for(const s of students){
   const st=await getStudentPortalStates(s.id);
   if(st.studentState.key==='active')counts.studentActive++;else counts.studentPending++;
   if(st.parentState.key==='active')counts.parentActive++;else counts.parentPending++;
   rows.push(`<tr><td><b>${safe(s.name||'')}</b><small>${safe(s.group||'')} · ID ${safe(s.id)}</small></td><td>${portalStatePill(st.student)}</td><td>${portalStatePill(st.parent)}</td></tr>`);
 }
 sum.innerHTML=`
  <div class="access-summary-box"><small>Alumnos activados</small><b>${counts.studentActive}</b></div>
  <div class="access-summary-box"><small>Alumnos pendientes</small><b>${counts.studentPending}</b></div>
  <div class="access-summary-box"><small>Familias activadas</small><b>${counts.parentActive}</b></div>
  <div class="access-summary-box"><small>Familias pendientes</small><b>${counts.parentPending}</b></div>`;
 wrap.innerHTML=students.length?`<table class="access-table"><thead><tr><th>Alumno</th><th>Acceso alumno</th><th>Acceso familia</th></tr></thead><tbody>${rows.join('')}</tbody></table>`:'<div class="empty">No hay alumnos matutinos cargados.</div>';
}
async function renderPortalAccess(s){
 let box=$('#portalAccessStatus');if(!box)return;
 if(!sameShift(s.shift,'Matutino')){box.innerHTML='<div class="empty">Los portales Mi Español y Seguimiento Familiar no se utilizan en el turno vespertino.</div>';return}
 let sa=await getPortalAuthRecord(s.id,'student'),pa=await getPortalAuthRecord(s.id,'parent');
 const temp=a=>a?.mustChange&&a?.tempPinReveal?`<div class="temp-pin-result">${safe(a.tempPinReveal)}</div><small>PIN temporal actual</small>`:'';
 box.innerHTML=`<div class="auth-grid">
 <div class="auth-box"><h4>👨‍🎓 Alumno</h4><div class="auth-status">${portalStatePill(sa)}</div>${temp(sa)}<button id="resetStudentPin" class="secondary" type="button">Generar nuevo PIN temporal del alumno</button></div>
 <div class="auth-box"><h4>👨‍👩‍👦 Padre / tutor</h4><div class="auth-status">${portalStatePill(pa)}</div>${temp(pa)}<button id="resetParentPin" class="secondary" type="button">Generar nuevo PIN temporal para padre/tutor</button></div></div>`;
 $('#resetStudentPin').onclick=()=>createOrResetPortalPin(s.id,'student');$('#resetParentPin').onclick=()=>createOrResetPortalPin(s.id,'parent');
}
const defaultAvailability={id:'main',days:[1,2,3,4,5],start:'12:00',end:'15:00',suspended:false,vacationStart:'',vacationEnd:'',technicalCouncilDates:[],temporaryNotice:''};
async function loadAvailability(){
 let a=await req(store('availability').get('main'))||defaultAvailability;
 $('#availabilityStart').value=a.start||'12:00';$('#availabilityEnd').value=a.end||'15:00';$('#vacationStart').value=a.vacationStart||'';$('#vacationEnd').value=a.vacationEnd||'';$('#technicalDates').value=(a.technicalCouncilDates||[]).join(', ');$('#temporaryNotice').value=a.temporaryNotice||'';$('#attentionSuspended').checked=!!a.suspended;
 $$('[data-weekday]').forEach(c=>c.checked=(a.days||[]).includes(Number(c.dataset.weekday)));
}
async function saveAvailability(e){
 e.preventDefault();let days=$$('[data-weekday]:checked').map(x=>Number(x.dataset.weekday));
 await put('availability',{id:'main',days,start:$('#availabilityStart').value||'12:00',end:$('#availabilityEnd').value||'15:00',vacationStart:$('#vacationStart').value,vacationEnd:$('#vacationEnd').value,technicalCouncilDates:$('#technicalDates').value.split(',').map(x=>x.trim()).filter(Boolean),temporaryNotice:norm($('#temporaryNotice').value),suspended:$('#attentionSuspended').checked,updated:new Date().toISOString()});alert('Disponibilidad guardada.');
}
async function savePortalEntity(type,e){
 e.preventDefault();
 if(type==='notice')await put('notices',{id:crypto.randomUUID(),group:norm($('#noticeGroup').value),title:norm($('#noticeTitle').value),text:norm($('#noticeText').value),created:new Date().toISOString(),active:true});
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
     material.fileName=file.name;
     material.mime=file.type||'application/octet-stream';
     material.size=file.size;
     material.fileData=await file.arrayBuffer();
     material.storagePath='';
   }
   await put('materials',material);
 }
 if(type==='topic')await put('studyTopics',{id:crypto.randomUUID(),group:norm($('#topicGroup').value),title:norm($('#topicTitle').value),notes:norm($('#topicNotes').value),created:new Date().toISOString(),active:true});
 e.target.reset();await refreshPortalContent();
}
async function refreshPortalContent(){
 const render=(id,list,fmt)=>{let box=$(id);if(!box)return;box.innerHTML=list.length?list.sort((a,b)=>String(b.created).localeCompare(String(a.created))).map(fmt).join(''):'<div class="empty">Sin publicaciones.</div>'};
 render('#noticeList',await all('notices'),x=>`<div class="mini-item"><b>${safe(x.title)}</b><small>${safe(x.group||'Todos')} · ${new Date(x.created).toLocaleDateString('es-MX')}</small><div>${safe(x.text)}</div></div>`);
 render('#materialList',await all('materials'),x=>`<div class="mini-item"><b>${safe(x.title)}</b><span class="material-source-badge">${x.source==='file'?'Archivo':'Enlace'}</span><small>${safe(x.type)} · ${safe(x.group||'Todos')}</small>${x.fileName?`<span class="material-file-name">${safe(x.fileName)} · ${(Number(x.size||0)/1024/1024).toFixed(1)} MB</span>`:''}${x.url?`<span class="material-file-name">${safe(x.url)}</span>`:''}</div>`);
 render('#topicList',await all('studyTopics'),x=>`<div class="mini-item"><b>${safe(x.title)}</b><small>${safe(x.group||'Todos')}</small></div>`);
}
async function renderTeacherMessages(){
 let list=(await all('studentMessages')).sort((a,b)=>String(b.created).localeCompare(String(a.created))),studentsList=await students(),names=new Map(studentsList.map(s=>[s.id,s]));
 let box=$('#teacherMessages');if(!box)return;
 box.innerHTML=list.length?list.map(m=>{let s=names.get(m.studentId);return `<div class="message-card ${m.teacherRead?'':'unread'}"><b>${safe(s?.name||m.studentId)} · ${safe(m.category||'Otro')}</b><small>${new Date(m.created).toLocaleString('es-MX')}</small><p>${safe(m.text)}</p>${m.reply?`<p><b>Respuesta:</b> ${safe(m.reply)}</p>`:`<div class="actions"><button data-reply-message="${m.id}" class="primary">Responder</button></div>`}</div>`}).join(''):'<div class="empty">No hay mensajes.</div>';
 $$('[data-reply-message]').forEach(b=>b.onclick=()=>replyStudentMessage(b.dataset.replyMessage));
}
async function replyStudentMessage(id){
 let m=await req(store('studentMessages').get(id));if(!m)return;
 let reply=prompt('Escribe la respuesta:');if(!reply)return;
 m.reply=reply;m.repliedAt=new Date().toISOString();m.teacherRead=true;await put('studentMessages',m);await renderTeacherMessages();
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
 const students=(await all('students')).filter(s=>sameShift(s.shift,'Matutino'));
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
function bind(){
 $('#refreshPortalAccessReport')&&($('#refreshPortalAccessReport').onclick=renderPortalAccessReport);
 setTimeout(()=>{renderPortalAccessReport();decorateStudentAccessStatuses()},300);$$('.tab').forEach(b=>b.onclick=()=>setView(b.dataset.view));document.addEventListener('click',e=>{const menu=$('#mainMenu');if(menu?.open&&!menu.contains(e.target))menu.open=false});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#mainMenu'))$('#mainMenu').open=false});$$('[data-go]').forEach(b=>b.onclick=()=>setView(b.dataset.go));$$('[data-acttab]').forEach(b=>b.onclick=()=>pane('act',b.dataset.acttab));$$('[data-tittab]').forEach(b=>b.onclick=()=>pane('tit',b.dataset.tittab));$$('[data-mettab]').forEach(b=>b.onclick=()=>pane('met',b.dataset.mettab));for(let p of ['att','act','grid','newAct','met','calcMet'])$('#'+p+'Shift').onchange=()=>fillGroups(p);$('#attGroup').onchange=refreshAttendance;$('#attDate').onchange=refreshAttendance;$('#attRegister').onclick=registerAttendance;$('#attScan').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();registerAttendance()}};$('#attMissingBtn').onclick=showMissing;$('#activityForm').onsubmit=createActivity;$('#cancelActivityEdit').onclick=resetActivityForm;$('#actGroup').onchange=refreshActivitySelectors;$('#actWeek').onchange=refreshActivitySelectors;$('#actSelect').onchange=refreshActivityStats;$('#actRegister').onclick=registerActivity;$('#actScan').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();registerActivity()}};$('#actClose').onclick=()=>closeActivity(true);$('#actReopen').onclick=()=>closeActivity(false);$('#gridGroup').onchange=refreshGridWeeks;$('#gridWeek').onchange=renderActivityGrid;$('#gridPdf').onclick=showWeeklyReportOptions;$('#addCriterionBtn').onclick=()=>addCriterion();$('#methodologyForm').onsubmit=saveMethodology;$('#cancelMethodologyEdit').onclick=resetMethodologyForm;$('#calcMetGroup').onchange=refreshCalculationMethodologies;$('#calcMethodology').onchange=renderMethodologyAssignments;$('#saveAssignmentsBtn').onclick=saveAssignments;$('#calculateMethodologyBtn').onclick=calculateMethodology;$('#methodologyPdfBtn').onclick=printMethodology;$('#methodologyIndividualPdfBtn').onclick=printMethodologyIndividuals;$('#closeMethodologyMonthBtn').onclick=toggleCloseMethodologyMonth;$('#newMethodologyMonthBtn').onclick=()=>startNewMonth();$('#quarterShift').onchange=refreshQuarterSelectors;$('#quarterGroup').onchange=()=>{};$('#calculateQuarterBtn').onclick=calculateQuarter;$('#quarterPdfBtn').onclick=printQuarter;$('#studentForm').onsubmit=saveStudent;$('#studentSearch').oninput=renderStudents;$('#dossierStudent').onchange=e=>renderDossier(e.target.value);$('#studentFile').onchange=e=>{if(e.target.files[0])importStudents(e.target.files[0]);e.target.value=''};$('#templateBtn').onclick=()=>download('plantilla_expedientes_alumnos.csv','ID del alumno,Turno,Grupo,No. de lista,Nombre completo,Correo institucional,Nombre del padre madre o tutor,Teléfono del padre madre o tutor,Observaciones,Incidencias,Fecha de nacimiento\n22001,Matutino,22,1,Nombre Apellido,correo@escuela.edu.mx,Nombre Tutor,5512345678,,,2013-05-20','text/csv');$('#backupBtn').onclick=()=>saveInternal();$('#saveAllTop').onclick=()=>saveInternal();$('#homeSaveAll').onclick=()=>saveInternal();$('#saveAllReports').onclick=()=>saveInternal();$('#homeRestoreInternal').onclick=restoreInternal;$('#restoreInternalBtn').onclick=restoreInternal;$('#updateAppBtn').onclick=forceUpdate;$('#exportBackupTrigger').onclick=exportBackup;
$('#homeExportBackup').onclick=exportBackup;
$('#reportsExportBackup').onclick=exportBackup;
$('#openDeleteRecords').onclick=openDeleteRecordsDialog;
$('#materialSource').onchange=updateMaterialSourceUI;updateMaterialSourceUI();
$('#availabilityForm').onsubmit=saveAvailability;$('#noticeForm').onsubmit=e=>savePortalEntity('notice',e);$('#materialForm').onsubmit=e=>savePortalEntity('material',e);$('#topicForm').onsubmit=e=>savePortalEntity('topic',e);$('#refreshMessages').onclick=renderTeacherMessages;
const bindRestoreInput=id=>{$('#'+id).onchange=e=>{if(e.target.files[0])restore(e.target.files[0]);e.target.value=''}};
bindRestoreInput('restoreFile');
bindRestoreInput('homeRestoreFile');
bindRestoreInput('reportsRestoreFile');$('#cancelEdit').onclick=()=>{$('#studentForm').reset();$('#editId').value='';$('#studentTitle').textContent='Agregar alumno';$('#cancelEdit').classList.add('hidden')};$('#titSaveAll').onclick=saveTitularWeek;['titPeriod','titMonth','titWeek','titLabel'].forEach(id=>$('#'+id).onchange=renderTitularGrid);$('#titStudent').onchange=renderTitPreview;$('#titSavedWeek').onchange=renderTitPreview;$('#titPdf').onclick=printTitular;$('#titEmail').onclick=openTitularEmailDialog;$('#weeklyReportShortcut').onclick=()=>setView('activities');$('#attendanceReport').onclick=printAttendance;$('#titularReportShortcut').onclick=()=>{setView('titular');pane('tit','individual')};$('#dialogClose').onclick=()=>$('#dialog').close();window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('#installBtn').classList.remove('hidden')});$('#installBtn').onclick=async()=>{if(deferredPrompt){deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null}}}
(async()=>{try{$('#attDate').value=$('#newActDate').value=today();$('#titMonth').innerHTML=['Agosto','Septiembre','Octubre','Noviembre','Diciembre','Enero','Febrero','Marzo','Abril','Mayo','Junio'].map(x=>`<option>${x}</option>`).join('');bind();await openDB();await fillSelectors();await refreshHome();await refreshActivitySelectors();await refreshGridWeeks();await refreshTitIndividual();resetMethodologyForm();await refreshMethodologyUI();await refreshQuarterSelectors();if('serviceWorker'in navigator){let reg=await navigator.serviceWorker.register('service-worker.js?v=7.4');reg.update().catch(()=>{})}await showLastInternalSave();$('#attScan').focus()}catch(e){console.error(e);alert('La app no pudo iniciar correctamente. Tus registros pueden seguir almacenados. Cierra todas las ventanas de la app y vuelve a abrirla. Detalle: '+(e?.message||e))}})()