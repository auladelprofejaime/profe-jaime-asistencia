
const DB_NAME='ProfeJaimeAsistenciaDB', DB_VERSION=1;
let db, deferredPrompt;
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const today=()=>new Date().toISOString().slice(0,10);
const normalize=s=>String(s??'').trim();
const lower=s=>normalize(s).toLowerCase();
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const txStore=(name,mode='readonly')=>db.transaction(name,mode).objectStore(name);
const reqP=req=>new Promise((res,rej)=>{req.onsuccess=()=>res(req.result);req.onerror=()=>rej(req.error)});
const all=(store)=>reqP(txStore(store).getAll());
const put=(store,val)=>reqP(txStore(store,'readwrite').put(val));
const del=(store,key)=>reqP(txStore(store,'readwrite').delete(key));
const clear=(store)=>reqP(txStore(store,'readwrite').clear());

function openDB(){
 return new Promise((res,rej)=>{
  const r=indexedDB.open(DB_NAME,DB_VERSION);
  r.onupgradeneeded=e=>{
   const d=e.target.result;
   if(!d.objectStoreNames.contains('students')){
    const s=d.createObjectStore('students',{keyPath:'id'});
    s.createIndex('group','group'); s.createIndex('shift','shift');
   }
   if(!d.objectStoreNames.contains('attendance')){
    const a=d.createObjectStore('attendance',{keyPath:'key'});
    a.createIndex('date','date'); a.createIndex('studentId','studentId');
   }
  };
  r.onsuccess=()=>{db=r.result;res(db)}; r.onerror=()=>rej(r.error);
 });
}

function setView(name){
 $$('.view').forEach(v=>v.classList.toggle('active',v.id===name));
 $$('.tab').forEach(t=>t.classList.toggle('active',t.dataset.view===name));
 if(name==='scanner') refreshScanner();
 if(name==='students') renderStudents();
 if(name==='history') renderHistory();
}

async function getStudents(){return (await all('students')).sort((a,b)=>a.shift.localeCompare(b.shift)||String(a.group).localeCompare(String(b.group),undefined,{numeric:true})||Number(a.number)-Number(b.number))}
async function getAttendance(){return (await all('attendance')).sort((a,b)=>b.timestamp.localeCompare(a.timestamp))}
function unique(vals){return [...new Set(vals.filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),undefined,{numeric:true}))}

async function refreshSelectors(){
 const students=await getStudents();
 const shifts=unique(students.map(s=>s.shift));
 const currentShift=$('#scanShift').value;
 $('#scanShift').innerHTML=shifts.length?shifts.map(x=>`<option>${safe(x)}</option>`).join(''):'<option>Sin alumnos</option>';
 if(shifts.includes(currentShift)) $('#scanShift').value=currentShift;
 refreshGroups();
 $('#historyShift').innerHTML='<option value="">Todos</option>'+shifts.map(x=>`<option>${safe(x)}</option>`).join('');
 refreshHistoryGroups();
}
async function refreshGroups(){
 const students=await getStudents(), shift=$('#scanShift').value, old=$('#scanGroup').value;
 const groups=unique(students.filter(s=>s.shift===shift).map(s=>s.group));
 $('#scanGroup').innerHTML=groups.length?groups.map(x=>`<option>${safe(x)}</option>`).join(''):'<option>Sin grupo</option>';
 if(groups.includes(old)) $('#scanGroup').value=old;
 refreshScanner();
}
async function refreshHistoryGroups(){
 const students=await getStudents(), shift=$('#historyShift').value, old=$('#historyGroup').value;
 const groups=unique(students.filter(s=>!shift||s.shift===shift).map(s=>s.group));
 $('#historyGroup').innerHTML='<option value="">Todos</option>'+groups.map(x=>`<option>${safe(x)}</option>`).join('');
 if(groups.includes(old)) $('#historyGroup').value=old;
}

async function refreshScanner(){
 if(!db)return;
 const students=await getStudents(), attendance=await getAttendance();
 const shift=$('#scanShift').value, group=$('#scanGroup').value, date=$('#scanDate').value;
 const roster=students.filter(s=>s.shift===shift&&String(s.group)===String(group));
 const records=attendance.filter(a=>a.date===date&&a.shift===shift&&String(a.group)===String(group));
 $('#presentCount').textContent=records.length;
 $('#totalCount').textContent=roster.length;
 $('#missingCount').textContent=Math.max(0,roster.length-records.length);
 const box=$('#todayList');
 if(!records.length){box.className='list empty';box.textContent='Aún no hay registros.';return}
 box.className='list';
 box.innerHTML=records.sort((a,b)=>b.timestamp.localeCompare(a.timestamp)).map(a=>`
  <div class="row"><div><strong>${safe(a.name||'Sin nombre')}</strong>
  <small>ID ${safe(a.studentId)} · Lista ${safe(a.number)} · ${new Date(a.timestamp).toLocaleTimeString('es-MX')}</small></div>
  <div class="row-actions"><button class="delete" data-delete-att="${safe(a.key)}">Eliminar</button></div></div>`).join('');
 $$('[data-delete-att]').forEach(b=>b.onclick=async()=>{if(confirm('¿Eliminar este registro?')){await del('attendance',b.dataset.deleteAtt);refreshScanner();}});
}

function status(type,title,text){
 const p=$('#statusPanel');p.className='status '+type;
 $('.status-icon').textContent=type==='success'?'✓':type==='error'?'⛔':type==='warning'?'⚠':'▣';
 $('#statusTitle').textContent=title;$('#statusText').textContent=text;
 clearTimeout(status.timer);status.timer=setTimeout(()=>{p.className='status neutral';$('.status-icon').textContent='▣';$('#statusTitle').textContent='Escanea la credencial';$('#statusText').textContent='El lector escribirá el ID y enviará Enter.'},2200);
}

async function register(){
 const id=normalize($('#scanInput').value);
 $('#scanInput').value='';$('#scanInput').focus();
 if(!id)return;
 const student=await reqP(txStore('students').get(id));
 if(!student){status('warning','ID no encontrado',`El código ${id} no está cargado.`);return}
 const shift=$('#scanShift').value,group=$('#scanGroup').value,date=$('#scanDate').value;
 if(student.shift!==shift||String(student.group)!==String(group)){
  status('warning','Alumno de otro grupo',`${student.name||id} pertenece a ${student.shift}, grupo ${student.group}.`);return
 }
 const key=`${date}|${id}`;
 const exists=await reqP(txStore('attendance').get(key));
 if(exists){status('error','YA REGISTRADO',`${exists.name||id} · ${new Date(exists.timestamp).toLocaleTimeString('es-MX')}`);return}
 const rec={key,date,studentId:id,name:student.name,shift:student.shift,group:String(student.group),number:student.number,timestamp:new Date().toISOString(),status:'Presente'};
 await put('attendance',rec);
 status('success','REGISTRADO',`${student.name||id} · Lista ${student.number}`);
 if(navigator.vibrate)navigator.vibrate(70);
 refreshScanner();
}

async function saveStudent(e){
 e.preventDefault();
 const original=$('#editingOriginalId').value;
 const student={id:normalize($('#studentId').value),shift:normalize($('#studentShift').value),group:normalize($('#studentGroup').value),number:Number($('#studentNumber').value),name:normalize($('#studentName').value)};
 if(!student.id||!student.group||!student.name||!student.number)return;
 if(original&&original!==student.id)await del('students',original);
 await put('students',student);
 e.target.reset();$('#editingOriginalId').value='';$('#studentFormTitle').textContent='Agregar alumno manualmente';$('#cancelEditBtn').classList.add('hidden');
 await refreshSelectors();renderStudents();
}
async function renderStudents(){
 const q=lower($('#studentSearch').value), students=await getStudents();
 const filtered=students.filter(s=>!q||[s.id,s.shift,s.group,s.number,s.name].some(v=>lower(v).includes(q)));
 const box=$('#studentsList');
 if(!filtered.length){box.className='list empty';box.textContent=students.length?'No se encontraron coincidencias.':'No hay alumnos cargados.';return}
 box.className='list';box.innerHTML=filtered.map(s=>`<div class="row"><div><strong>${safe(s.name)}</strong><small>ID ${safe(s.id)} · ${safe(s.shift)} · Grupo ${safe(s.group)} · Lista ${safe(s.number)}</small></div><div class="row-actions"><button class="edit" data-edit="${safe(s.id)}">Editar</button><button class="delete" data-del="${safe(s.id)}">Eliminar</button></div></div>`).join('');
 $$('[data-edit]').forEach(b=>b.onclick=async()=>{const s=await reqP(txStore('students').get(b.dataset.edit));$('#editingOriginalId').value=s.id;$('#studentId').value=s.id;$('#studentShift').value=s.shift;$('#studentGroup').value=s.group;$('#studentNumber').value=s.number;$('#studentName').value=s.name;$('#studentFormTitle').textContent='Editar alumno';$('#cancelEditBtn').classList.remove('hidden');$('#studentForm').scrollIntoView({behavior:'smooth'})});
 $$('[data-del]').forEach(b=>b.onclick=async()=>{if(confirm('¿Eliminar este alumno?')){await del('students',b.dataset.del);await refreshSelectors();renderStudents();}});
}

function pick(obj,names){
 const entries=Object.entries(obj);
 for(const n of names){const found=entries.find(([k])=>lower(k).replace(/[.\s_]/g,'')===lower(n).replace(/[.\s_]/g,''));if(found)return found[1]}
 return '';
}
async function importExcel(file){
 const msg=$('#importMessage');msg.className='message';msg.textContent='Leyendo archivo...';
 try{
  if(typeof XLSX==='undefined')throw new Error('No se pudo cargar el lector de Excel. Conecta el iPad a internet una vez y vuelve a abrir la app.');
  const data=await file.arrayBuffer(), wb=XLSX.read(data,{type:'array'});
  const preferred=wb.SheetNames.find(n=>lower(n).includes('base_alumnos'))||wb.SheetNames[0];
  const rows=XLSX.utils.sheet_to_json(wb.Sheets[preferred],{defval:''});
  let count=0, skipped=0;
  for(const r of rows){
   const s={
    id:normalize(pick(r,['ID','ID ESCANEADO'])),
    shift:normalize(pick(r,['Turno']))||'Matutino',
    group:normalize(pick(r,['Grupo'])),
    number:Number(pick(r,['No. de lista','No de lista','Numero de lista','Número de lista'])),
    name:normalize(pick(r,['Nombre del alumno','Nombre','Alumno']))
   };
   if(s.id&&s.group&&s.number){await put('students',s);count++;}else skipped++;
  }
  msg.className='message good';msg.textContent=`Importación terminada: ${count} alumnos cargados${skipped?`, ${skipped} filas omitidas`:''}.`;
  await refreshSelectors();renderStudents();
 }catch(err){msg.className='message bad';msg.textContent=err.message||'No fue posible importar el archivo.'}
}

async function renderHistory(){
 const records=await getAttendance();
 const from=$('#historyFrom').value,to=$('#historyTo').value,shift=$('#historyShift').value,group=$('#historyGroup').value;
 const filtered=records.filter(a=>(!from||a.date>=from)&&(!to||a.date<=to)&&(!shift||a.shift===shift)&&(!group||String(a.group)===String(group)));
 const box=$('#historyList');
 if(!filtered.length){box.className='list empty';box.textContent='No hay registros con esos filtros.';return}
 box.className='list';box.innerHTML=filtered.map(a=>`<div class="row"><div><strong>${safe(a.name||a.studentId)}</strong><small>${safe(a.date)} · ${safe(a.shift)} · Grupo ${safe(a.group)} · Lista ${safe(a.number)} · ${new Date(a.timestamp).toLocaleTimeString('es-MX')}</small></div><div class="row-actions"><button class="delete" data-hdel="${safe(a.key)}">Eliminar</button></div></div>`).join('');
 $$('[data-hdel]').forEach(b=>b.onclick=async()=>{if(confirm('¿Eliminar este registro?')){await del('attendance',b.dataset.hdel);renderHistory();}});
}
function download(name,text,type='text/csv;charset=utf-8'){
 const blob=new Blob(['\ufeff'+text],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function exportHistory(){
 const records=await getAttendance();
 const from=$('#historyFrom').value,to=$('#historyTo').value,shift=$('#historyShift').value,group=$('#historyGroup').value;
 const f=records.filter(a=>(!from||a.date>=from)&&(!to||a.date<=to)&&(!shift||a.shift===shift)&&(!group||String(a.group)===String(group)));
 const esc=v=>`"${String(v??'').replaceAll('"','""')}"`;
 const csv=['Fecha,Hora,ID,Nombre,Turno,Grupo,No. de lista,Estatus',...f.map(a=>[a.date,new Date(a.timestamp).toLocaleTimeString('es-MX'),a.studentId,a.name,a.shift,a.group,a.number,a.status].map(esc).join(','))].join('\n');
 download(`asistencia_${today()}.csv`,csv);
}
async function showMissing(){
 const students=await getStudents(),attendance=await getAttendance(),shift=$('#scanShift').value,group=$('#scanGroup').value,date=$('#scanDate').value;
 const present=new Set(attendance.filter(a=>a.date===date&&a.shift===shift&&String(a.group)===String(group)).map(a=>a.studentId));
 const missing=students.filter(s=>s.shift===shift&&String(s.group)===String(group)&&!present.has(s.id));
 $('#missingList').innerHTML=missing.length?missing.map(s=>`<div class="row"><div><strong>${safe(s.name||'Sin nombre')}</strong><small>ID ${safe(s.id)} · Lista ${safe(s.number)}</small></div></div>`).join(''):'<div class="list empty">No hay faltantes.</div>';
 $('#missingDialog').showModal();
}

window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('#installBtn').classList.remove('hidden')});
$('#installBtn').onclick=async()=>{if(deferredPrompt){deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('#installBtn').classList.add('hidden')}};
$$('.tab').forEach(t=>t.onclick=()=>setView(t.dataset.view));
$('#scanDate').value=today();$('#historyFrom').value=today();$('#historyTo').value=today();
$('#registerBtn').onclick=register;$('#scanInput').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();register()}});
$('#scanShift').onchange=refreshGroups;$('#scanGroup').onchange=refreshScanner;$('#scanDate').onchange=refreshScanner;
$('#studentForm').onsubmit=saveStudent;$('#studentSearch').oninput=renderStudents;
$('#cancelEditBtn').onclick=()=>{$('#studentForm').reset();$('#editingOriginalId').value='';$('#studentFormTitle').textContent='Agregar alumno manualmente';$('#cancelEditBtn').classList.add('hidden')};
$('#excelFile').onchange=e=>{const f=e.target.files[0];if(f)importExcel(f);e.target.value=''};
$('#downloadTemplateBtn').onclick=()=>download('plantilla_alumnos.csv','ID,Turno,Grupo,No. de lista,Nombre del alumno\n22001,Matutino,22,1,Nombre Apellido');
$('#deleteAllStudentsBtn').onclick=async()=>{if(confirm('¿Borrar todos los alumnos? El historial de asistencia se conservará.')){await clear('students');await refreshSelectors();renderStudents()}};
$('#historyShift').onchange=async()=>{await refreshHistoryGroups();renderHistory()};
['historyFrom','historyTo','historyGroup'].forEach(id=>$('#'+id).onchange=renderHistory);
$('#exportHistoryBtn').onclick=exportHistory;
$('#deleteHistoryBtn').onclick=async()=>{if(confirm('¿Borrar definitivamente todo el historial?')){await clear('attendance');renderHistory();refreshScanner()}};
$('#showMissingBtn').onclick=showMissing;$('#closeMissingBtn').onclick=()=>$('#missingDialog').close();

(async()=>{await openDB();await refreshSelectors();await refreshScanner();$('#scanInput').focus();if('serviceWorker'in navigator)navigator.serviceWorker.register('service-worker.js')})();
