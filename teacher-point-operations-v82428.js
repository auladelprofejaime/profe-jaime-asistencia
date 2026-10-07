// App Docente v8.24.28 · movimientos y operación de puntos por ID
(()=>{
 const q=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let detail=null,busy=false,pending=null,generation=0;
 const labels={award:'Puntos otorgados',donation_out:'Donó a',donation_in:'Recibió de',grade_use:'Aplicó a calificación',grade_refund:'Devolución de puntos',earned:'Puntos generados'};
 const choices={used:'Usó puntos',donated:'Donó puntos',mixed:'Usó y donó',keep:'Conserva puntos'};
 async function rpc(n,a={}){if(!window.ProfeSupabase)throw Error('Inicia sesión docente con internet.');const r=await window.ProfeSupabase.rpc(n,a);if(r?.ok===false)throw Error(r.error||r.reason||'El servidor no confirmó el movimiento.');return r;}
 const student=id=>detail?.students?.find(s=>s.student_id===id);
 // The server authorizes teacher intervention independently of student dates.
 const isOpen=()=>detail?.teacher_can_operate===true;
 function periodMessage(){
  const p=detail?.period;if(!p)return 'Selecciona un periodo y actualiza los movimientos.';
  if(isOpen())return p.state==='open'?'Dinámica abierta para alumnos. Como docente puedes registrar donaciones y aplicar puntos.':'Dinámica cerrada para alumnos por horario. Tú puedes registrar donaciones y aplicar puntos como docente, sin reabrirla para ellos.';
  const fmt=v=>new Date(v).toLocaleString('es-MX',{timeZone:'America/Mexico_City'});
  if(p.closed_at)return 'Periodo cerrado definitivamente: solo consulta.';
  if(detail.teacher_can_operate===false)return 'El mes está cerrado. Reábrelo en Metodologías antes de modificar puntos como docente.';
  if(p.closes_at&&Date.now()>=Date.parse(p.closes_at))return 'El plazo terminó el '+fmt(p.closes_at)+' (hora de México). Para continuar, usa Editar horario en Periodos de puntos guardados. No se ha movido ningún saldo.';
  if(p.opens_at&&Date.now()<Date.parse(p.opens_at))return 'La dinámica abre el '+fmt(p.opens_at)+' (hora de México).';
  return 'Periodo no abierto: solo consulta. Revisa el horario en Periodos de puntos guardados.';
 }
 function lock(on){busy=on;for(const e of q('ptOperations').querySelectorAll('input,select,button'))e.disabled=on;if(!on){q('pxDonateSave').disabled=!isOpen();q('pxUseSave').disabled=!isOpen();}}
 function identify(input,box,grade=false){
  const id=q(input).value.trim(),s=student(id);
  q(box).textContent=s?s.student_name+' · Saldo: '+Number(s.balance||0).toFixed(2):id?'ID no encontrado en este grupo.':'';
  if(s&&grade){const r=detail.grade_records?.[id]||{};q(box).textContent+=' · Aplicados: '+Number(r.pointsUsed||0).toFixed(2)+(r.base==null?' · Falta calcular su calificación.':' · Máximo para llegar a 10: '+Math.max(0,10-Number(r.base)-Number(r.manualExtra||0)).toFixed(2));}
  return s;
 }
 function render(){
  const sum=detail.summary||{};q('pxSummary').innerHTML='<div><b>'+Number(sum.donations||0)+'</b><span>Donaciones</span></div><div><b>'+Number(sum.points_donated||0).toFixed(2)+'</b><span>Puntos donados</span></div><div><b>'+Number(sum.points_used||0).toFixed(2)+'</b><span>Puntos aplicados netos</span></div>';
  q('pxStudents').innerHTML='<table><thead><tr><th>#</th><th>Alumno / ID</th><th>Saldo</th><th>Aplicados al mes</th><th>Decisión</th></tr></thead><tbody>'+detail.students.filter(s=>s.student_id!=='00001').map(s=>'<tr><td>'+esc(s.list_number??'')+'</td><td>'+esc(s.student_name)+'<br><small>'+esc(s.student_id)+'</small></td><td>'+Number(s.balance||0).toFixed(2)+'</td><td>'+Number(detail.grade_records?.[s.student_id]?.pointsUsed||0).toFixed(2)+'</td><td>'+esc(choices[s.choice]||'Sin movimiento registrado')+'</td></tr>').join('')+'</tbody></table>';
  const rows=detail.transactions||[];
  q('pxHistory').innerHTML=rows.length?'<table><thead><tr><th>Fecha</th><th>Alumno</th><th>Movimiento</th><th>Puntos</th><th>Registrado desde</th></tr></thead><tbody>'+rows.map(t=>'<tr><td>'+esc(new Date(t.created_at).toLocaleString('es-MX'))+'</td><td>'+esc(t.student_name||t.student_id)+'<br><small>'+esc(t.student_id)+'</small></td><td>'+esc(labels[t.type]||t.type)+(t.counterpart_id?' '+esc(t.counterpart_name||t.counterpart_id)+' ('+esc(t.counterpart_id)+')':'')+(t.reason?'<br><small>'+esc(t.reason)+'</small>':'')+'</td><td>'+Number(t.amount).toFixed(2)+'</td><td>'+esc(t.source==='teacher'?'Docente':t.source==='student'?'Alumno':t.source||'Sistema')+'</td></tr>').join('')+'</tbody></table>':'<p class="hint">Todavía no hay movimientos en este periodo.</p>';
  q('pxStatus').textContent=periodMessage();
  identify('pxDonor','pxDonorInfo');identify('pxRecipient','pxRecipientInfo');identify('pxUseStudent','pxUseInfo',true);lock(false);
 }
 async function load(){
  const id=q('pxPeriod').value,version=++generation;detail=null;lock(true);q('pxStatus').textContent='Consultando movimientos…';
  try{if(!id)throw Error('Selecciona un periodo.');const r=await rpc('teacher_point_period_activity',{p_period_id:id});if(version!==generation)return;detail=r;render();}
  catch(e){if(version===generation){q('pxStatus').textContent=e.message;q('pxHistory').textContent='';q('pxStudents').textContent='';q('pxSummary').textContent='';lock(false);}}
 }
 async function refresh(){
  if(busy)return;try{const selected=q('pxPeriod').value,periods=await rpc('teacher_point_periods');q('pxPeriod').innerHTML=(periods||[]).map(p=>'<option value="'+esc(p.id)+'">Grupo '+esc(p.group_name)+' · '+esc(p.month)+' · '+esc(p.cycle)+' · '+esc(p.state==='open'?'Abierto':p.state==='scheduled'?'Programado':'Cerrado')+'</option>').join('');if([...q('pxPeriod').options].some(o=>o.value===selected))q('pxPeriod').value=selected;await load();}catch(e){q('pxStatus').textContent=e.message;}
 }
 async function donate(e){
  e.preventDefault();if(busy)return;if(!isOpen()){q('pxDonateStatus').textContent=periodMessage();lock(false);return;}
  const donor=identify('pxDonor','pxDonorInfo'),recipient=identify('pxRecipient','pxRecipientInfo'),amount=Number(q('pxDonationAmount').value);
  if(!donor||!recipient||donor.student_id===recipient.student_id||!Number.isFinite(amount)||amount<0.01||amount>Number(donor.balance)){q('pxDonateStatus').textContent='Revisa ambos IDs: deben ser distintos, del mismo grupo, y la cantidad no debe superar el saldo.';return;}
  if(!confirm(donor.student_name+' donará '+amount.toFixed(2)+' puntos a '+recipient.student_name+' del grupo '+detail.period.group_name+' ¿Guardar?'))return;
  const payload={p_donor_id:donor.student_id,p_recipient_id:recipient.student_id,p_period_id:detail.period.id,p_amount:amount},fingerprint=JSON.stringify(payload);
  if(!pending||pending.fingerprint!==fingerprint)pending={fingerprint,id:crypto.randomUUID()};
  lock(true);q('pxDonateStatus').textContent='Guardando donación…';
  try{const r=await rpc('teacher_donate_points_safe',{...payload,p_request_id:pending.id});if(!r?.ok)throw Error('Sin confirmación del servidor.');pending=null;q('pxDonateStatus').textContent='✓ Donación guardada: '+donor.student_name+' → '+recipient.student_name+' · '+amount.toFixed(2)+' puntos.';q('pxDonor').value='';q('pxRecipient').value='';q('pxDonationAmount').value='';await load();q('ptRefresh')?.click();}
  catch(err){q('pxDonateStatus').textContent='No se pudo confirmar: '+err.message+'. Puedes reintentar esta solicitud sin duplicarla.';}
  finally{lock(false);}
 }
 async function use(e){
  e.preventDefault();if(busy)return;if(!isOpen()){q('pxUseStatus').textContent=periodMessage();lock(false);return;}
  const s=identify('pxUseStudent','pxUseInfo',true),amount=Number(q('pxUseAmount').value);
  if(!s||!Number.isFinite(amount)||amount<=0){q('pxUseStatus').textContent='Revisa el ID y la cantidad.';return;}
  if(!confirm('Sumar '+amount.toFixed(2)+' puntos adicionales a la calificación de '+s.student_name+' en '+detail.period.month+' ¿Guardar?'))return;
  lock(true);q('pxUseStatus').textContent='Guardando…';
  try{const payload={p_student_id:s.student_id,p_period_id:detail.period.id,p_amount:amount},fingerprint=JSON.stringify(payload),key='teacherPendingGradeAdd';
  let request;try{request=JSON.parse(sessionStorage.getItem(key)||'null')}catch(_){}
  if(!request||request.fingerprint!==fingerprint){request={fingerprint,id:crypto.randomUUID()};sessionStorage.setItem(key,JSON.stringify(request));}
  const r=await rpc('teacher_add_grade_points',{...payload,p_request_id:request.id});if(!r?.ok)throw Error('Sin confirmación del servidor.');sessionStorage.removeItem('teacherPendingGradeAdd');q('pxUseAmount').value='';q('pxUseStatus').textContent='✓ Puntos aplicados guardados. Calificación: '+Number(r.final_decimal).toFixed(2);await load();q('ptRefresh')?.click();}
  catch(err){q('pxUseStatus').textContent='No se pudo guardar: '+err.message;}
  finally{lock(false);}
 }
 function init(){
  q('pxPeriod').addEventListener('change',()=>{pending=null;for(const id of ['pxDonor','pxRecipient','pxUseStudent','pxDonationAmount','pxUseAmount'])q(id).value='';load();});
  q('pxRefresh').addEventListener('click',refresh);q('pxDonateForm').addEventListener('submit',donate);q('pxUseForm').addEventListener('submit',use);
  for(const [id,info,next,grade] of [['pxDonor','pxDonorInfo','pxRecipient',false],['pxRecipient','pxRecipientInfo','pxDonationAmount',false],['pxUseStudent','pxUseInfo','pxUseAmount',true]]){
   q(id).addEventListener('blur',()=>identify(id,info,grade));q(id).addEventListener('keydown',e=>{if(e.key==='Enter'||e.key==='NumpadEnter'){e.preventDefault();if(identify(id,info,grade))q(next).focus();}});
  }
  document.querySelector('[data-mettab="points"]').addEventListener('click',refresh);
  // Expiry must also lock a page left open across the closing time.
  setInterval(()=>{if(detail&&!busy){q('pxStatus').textContent=periodMessage();q('pxDonateSave').disabled=!isOpen();q('pxUseSave').disabled=!isOpen();}},15000);
  document.addEventListener('click',async e=>{const b=e.target.closest('[data-pt-history]');if(!b||busy)return;await refresh();q('pxPeriod').value=b.dataset.ptHistory;await load();q('ptOperations').scrollIntoView({behavior:'smooth',block:'start'});});
 }
 if(document.readyState==='complete')init();else window.addEventListener('load',init,{once:true});
})();
