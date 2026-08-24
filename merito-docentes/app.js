const SUPABASE_URL="https://xqeyyjakmeiaahecfdmc.supabase.co";
const SUPABASE_KEY="sb_publishable_GY2NGAigumnZw3rIJKU7LA_a2qigAEA";
const TOKEN_KEY='meritInstallationTokenV1';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let token=localStorage.getItem(TOKEN_KEY)||'', staff=null, grade=null, group=null, points=null;

async function rpc(name,args={}){
 const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(args)});
 const text=await r.text(); let d=null; try{d=text?JSON.parse(text):null}catch{d=text}
 if(!r.ok) throw new Error(d?.message||d?.error||text||`HTTP ${r.status}`);
 return d;
}
function roleLabel(r){return ({docente:'Docente',direccion:'Dirección',subdireccion:'Subdirección',prefectura:'Prefectura',otro:'Personal autorizado'})[r]||r||''}
async function checkDevice(){
 if(!token) return showActivation();
 try{const d=await rpc('merit_device_info',{p_token:token});if(!d?.ok)throw 0;staff=d.staff;showCapture()}catch{localStorage.removeItem(TOKEN_KEY);token='';showActivation()}
}
function showActivation(){$('#activation').classList.remove('hidden');$('#capture').classList.add('hidden')}
function showCapture(){$('#activation').classList.add('hidden');$('#capture').classList.remove('hidden');$('#staffName').textContent=staff.display_name;$('#staffRole').textContent=roleLabel(staff.role_type)}
$('#activateBtn').onclick=async()=>{
 const code=$('#activationCode').value.trim();const st=$('#activationStatus');st.textContent='';
 if(!/^\d{4}$/.test(code))return st.innerHTML='<span class="error">Escribe los 4 dígitos.</span>';
 try{const d=await rpc('merit_activate_device',{p_code:code});if(!d?.ok)throw new Error('Código inválido o inactivo.');token=d.installation_token;staff=d.staff;localStorage.setItem(TOKEN_KEY,token);$('#activationCode').value='';showCapture()}catch(e){st.innerHTML=`<span class="error">${e.message||e}</span>`}
};
$('#forgetDevice').onclick=()=>{if(confirm('¿Desvincular este dispositivo? Para volver a usarlo necesitarás un código de activación vigente.')){localStorage.removeItem(TOKEN_KEY);location.reload()}};
$$('#gradeButtons button').forEach(b=>b.onclick=()=>{grade=Number(b.dataset.grade);group=null;const gc=$('#selectedGroupConfirm');if(gc)gc.textContent='';$$('#gradeButtons button').forEach(x=>x.classList.toggle('active',x===b));renderGroups()});
function renderGroups(){
 const box=$('#groupButtons');box.innerHTML='';if(!grade)return;
 const start=grade*10+1;
 for(let n=start;n<=start+5;n++){const b=document.createElement('button');b.className='yellow';b.textContent=n;b.onclick=()=>{group=String(n);[...box.children].forEach(x=>x.classList.toggle('active',x===b));const c=$('#selectedGroupConfirm');if(c)c.textContent=`✓ Grupo ${group} seleccionado`};box.appendChild(b)}
}
$$('#pointButtons button').forEach(b=>b.onclick=()=>{points=b.dataset.points===''?null:Number(b.dataset.points);$$('#pointButtons button').forEach(x=>x.classList.toggle('active',x===b));$('#reasonWrap').classList.toggle('hidden',points===null)});
const criteriaNames={cleanliness:'Limpieza',uniform:'Uniforme',punctuality:'Puntualidad',coexistence:'Convivencia',responsibility:'Responsabilidad',attitude:'Actitud',institutional_participation:'Participación institucional'};
function selectedCriteria(){return $$('#criteria input:checked').map(x=>x.value)}
$('#reviewBtn').onclick=async()=>{
 $('#captureStatus').textContent='';
 try{const d=await rpc('merit_device_info',{p_token:token});if(!d?.ok)throw new Error('Este dispositivo ya no está autorizado.');staff=d.staff}catch(e){localStorage.removeItem(TOKEN_KEY);return location.reload()}
 if(!group)return $('#captureStatus').innerHTML='<span class="error">Selecciona un grupo.</span>';
 const cs=selectedCriteria(); const reason=$('#reason').value.trim();
 if(points!==null&&!reason)return $('#captureStatus').innerHTML='<span class="error">Escribe el motivo de los puntos.</span>';
 if(points===null&&!cs.length)return $('#captureStatus').innerHTML='<span class="error">Selecciona puntos o al menos un reconocimiento.</span>';
 $('#confirmSummary').innerHTML=`<p><b>Docente:</b> ${staff.display_name}</p><p><b>Grupo:</b> ${group}</p><p><b>Puntos:</b> ${points===null?'Sin puntos':points>0?'+'+points:points}</p>${points!==null?`<p><b>Motivo:</b> ${escapeHtml(reason)}</p>`:''}<p><b>Reconocimientos:</b> ${cs.length?cs.map(x=>criteriaNames[x]).join(', '):'Ninguno'}</p><p class="muted">Una vez guardado, el docente no puede borrarlo.</p>`;
 $('#confirmDialog').showModal();
};
$('#cancelConfirm').onclick=()=>$('#confirmDialog').close();
$('#sendConfirm').onclick=async()=>{
 const btn=$('#sendConfirm');btn.disabled=true;
 try{const cs=selectedCriteria(), reason=$('#reason').value.trim(); const d=await rpc('merit_register_movement',{p_token:token,p_group_code:group,p_points:points,p_reason:points===null?null:reason,p_criteria:cs});
 if(!d?.ok){
   const msgs={daily_positive_limit:`Ya alcanzaste el límite positivo para este grupo hoy. Te quedan ${d.remaining??0} puntos.`,daily_negative_limit:`Ya alcanzaste el límite negativo para este grupo hoy. Te quedan ${d.remaining??0} puntos.`,no_open_period:'No hay un periodo abierto para la fecha actual.',unauthorized:'Este dispositivo ya no está autorizado.'};
   throw new Error(msgs[d.reason]||d.reason||'No se pudo guardar.');
 }
 $('#confirmDialog').close();$('#captureStatus').innerHTML='<span class="success">✓ Registro guardado correctamente.</span>';
 const txt=`Grupo ${group} · ${points===null?'sin puntos':points>0?'+'+points:points}${cs.length?' · '+cs.map(x=>criteriaNames[x]).join(', '):''}`;
 $('#lastRecordText').textContent=txt;$('#lastRecord').classList.remove('hidden');
 points=null;$$('#pointButtons button').forEach(x=>x.classList.toggle('active',x.dataset.points===''));$('#reason').value='';$('#reasonWrap').classList.add('hidden');$$('#criteria input').forEach(x=>x.checked=false);
 }catch(e){$('#confirmDialog').close();$('#captureStatus').innerHTML=`<span class="error">${e.message||e}</span>`}finally{btn.disabled=false}
};
function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c])}
if('serviceWorker'in navigator)navigator.serviceWorker.register('service-worker.js').catch(()=>{});
checkDevice();
