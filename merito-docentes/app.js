const SUPABASE_URL="https://xqeyyjakmeiaahecfdmc.supabase.co";
const SUPABASE_KEY="sb_publishable_GY2NGAigumnZw3rIJKU7LA_a2qigAEA";
const TOKEN_KEY='meritInstallationTokenV1';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let token=localStorage.getItem(TOKEN_KEY)||'', staff=null, grade=null, group=null, points=null;

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
  const text=await r.text(); let d=null; try{d=text?JSON.parse(text):null}catch{d=text}
  if(!r.ok) throw new Error(d?.message||d?.error||text||`HTTP ${r.status}`);
  return d;
 }catch(e){
  if(e?.name==='AbortError')throw new Error('La conexión tardó demasiado. Revisa internet e inténtalo de nuevo.');
  if(!navigator.onLine)throw new Error('No hay conexión a internet.');
  throw e;
 }finally{clearTimeout(timer)}
}
function roleLabel(r){return ({docente:'Docente',direccion:'Dirección',subdireccion:'Subdirección',prefectura:'Prefectura',otro:'Personal autorizado'})[r]||r||''}
async function checkDevice(){
 if(!token) return showActivation();
 try{
   const d=await rpc('merit_device_info',{p_token:token});
   if(!d?.ok)throw new Error(d?.reason||'unauthorized');
   staff=d.staff;
   showCapture();
   if(d.must_change_pin)setTimeout(()=>$('#pinDialog')?.showModal(),80);
 }catch{
   localStorage.removeItem(TOKEN_KEY);token='';showActivation();
 }
}
function showActivation(){$('#activation').classList.remove('hidden');$('#capture').classList.add('hidden')}
function showCapture(){$('#activation').classList.add('hidden');$('#capture').classList.remove('hidden');$('#staffName').textContent=staff.display_name;$('#staffRole').textContent=roleLabel(staff.role_type);checkSystemReady()}
$('#activateBtn').onclick=async()=>{
 const staffCode=$('#staffCode').value.trim();
 const pin=$('#activationCode').value.trim();
 const st=$('#activationStatus');st.textContent='';
 if(!/^\d{6}$/.test(staffCode))return st.innerHTML='<span class="error">Escribe tu ID de 6 dígitos.</span>';
 if(!/^\d{4}$/.test(pin))return st.innerHTML='<span class="error">Escribe tu NIP de 4 dígitos.</span>';
 try{
   const d=await rpc('merit_login_device',{p_staff_code:staffCode,p_pin:pin});
   if(!d?.ok){
     const msgs={invalid_credentials:'ID o NIP incorrectos.',trial_expired:'Este ID de prueba ya venció. Consulta al administrador.'};
     throw new Error(msgs[d?.reason]||'No se pudo ingresar.');
   }
   token=d.installation_token;staff=d.staff;
   localStorage.setItem(TOKEN_KEY,token);
   $('#staffCode').value='';$('#activationCode').value='';
   showCapture();
   if(d.must_change_pin){
     $('#currentPin').value=pin;
     setTimeout(()=>$('#pinDialog')?.showModal(),80);
   }
 }catch(e){st.innerHTML=`<span class="error">${e.message||e}</span>`}
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
 const savedMessage = points===null
   ? '✓ Reconocimiento guardado correctamente.'
   : (cs.length ? '✓ Puntos y reconocimientos guardados correctamente.' : '✓ Puntos guardados correctamente.');
 alert(savedMessage);
 const txt=`Grupo ${group} · ${points===null?'sin puntos':points>0?'+'+points:points}${cs.length?' · '+cs.map(x=>criteriaNames[x]).join(', '):''}`;
 $('#lastRecordText').textContent=txt;$('#lastRecord').classList.remove('hidden');
 points=null;$$('#pointButtons button').forEach(x=>x.classList.toggle('active',x.dataset.points===''));$('#reason').value='';$('#reasonWrap').classList.add('hidden');$$('#criteria input').forEach(x=>x.checked=false);
 }catch(e){$('#confirmDialog').close();$('#captureStatus').innerHTML=`<span class="error">${e.message||e}</span>`}finally{btn.disabled=false}
};
$('#saveNewPin').onclick=async()=>{
 const current=$('#currentPin').value.trim();
 const next=$('#newPin').value.trim();
 const confirmPin=$('#newPinConfirm').value.trim();
 const st=$('#pinChangeStatus');st.textContent='';
 if(!/^\d{4}$/.test(current))return st.innerHTML='<span class="error">Escribe tu NIP actual de 4 dígitos.</span>';
 if(!/^\d{4}$/.test(next))return st.innerHTML='<span class="error">El nuevo NIP debe tener 4 dígitos.</span>';
 if(next!==confirmPin)return st.innerHTML='<span class="error">Los nuevos NIP no coinciden.</span>';
 try{
   const d=await rpc('merit_change_pin',{p_token:token,p_current_pin:current,p_new_pin:next});
   if(!d?.ok){
     const msgs={invalid_current_pin:'El NIP actual no es correcto.',same_pin:'El nuevo NIP debe ser diferente al impreso.',invalid_new_pin:'El nuevo NIP debe tener 4 dígitos.'};
     throw new Error(msgs[d?.reason]||'No se pudo cambiar el NIP.');
   }
   st.innerHTML='<span class="success">✓ NIP actualizado correctamente.</span>';
   setTimeout(()=>$('#pinDialog').close(),600);
 }catch(e){st.innerHTML=`<span class="error">${e.message||e}</span>`}
};
function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c])}
if('serviceWorker'in navigator)navigator.serviceWorker.register('service-worker.js?v=14').catch(()=>{});
checkDevice();
