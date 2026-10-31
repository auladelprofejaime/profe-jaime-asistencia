(function(){
 const $=s=>document.querySelector(s);
 async function rpc(name,args={}){window.ProfeSupabase?.restore?.();if(!window.ProfeSupabase)throw new Error('No hay sesión administrativa');return window.ProfeSupabase.rpc(name,args)}
 async function load(){
  const st=$('#meritTeacherNoticeStatus'),period=$('#meritManualPeriodState');
  try{
   const d=await rpc('teacher_merit_runtime_control',{});
   if(!d?.ok)throw new Error('No se pudo consultar la configuración');
   $('#meritTeacherNoticeActive').checked=!!d.teacher_notice_active;
   $('#meritTeacherNoticeTitle').value=d.teacher_notice_title||'';
   $('#meritTeacherNoticeMessage').value=d.teacher_notice_message||'';
   if(period)period.innerHTML=d.active_period_id?'<b>Periodo de captura abierto:</b> '+(d.active_period_label||'Periodo activo'):'<b>Captura cerrada.</b> No hay ningún periodo habilitado manualmente.';
   const periods=await rpc('teacher_merit_periods',{});const sel=$('#meritManualPeriodSelect');if(sel&&Array.isArray(periods)){const old=sel.value;sel.innerHTML=periods.filter(p=>!String(p.label||'').toLowerCase().startsWith('prueba')).map(p=>'<option value="'+p.id+'">'+p.label+' · '+p.status+'</option>').join('');if([...sel.options].some(o=>o.value===old))sel.value=old;if(d.active_period_id)sel.value=d.active_period_id;}
   if(st)st.textContent='';
  }catch(e){if(st)st.textContent='No se pudo cargar: '+(e.message||e)}
 }
 $('#meritTeacherNoticeSave')?.addEventListener('click',async()=>{
  const btn=$('#meritTeacherNoticeSave'),st=$('#meritTeacherNoticeStatus');
  btn.disabled=true;if(st)st.textContent='Guardando…';
  try{
   const d=await rpc('teacher_merit_set_teacher_notice',{
    p_active:$('#meritTeacherNoticeActive').checked,
    p_title:$('#meritTeacherNoticeTitle').value.trim(),
    p_message:$('#meritTeacherNoticeMessage').value.trim()
   });
   if(!d?.ok)throw new Error(d?.reason||'No se guardó');
   if(st)st.innerHTML='<span class="success">✓ Aviso actualizado. La app docente lo consultará automáticamente.</span>';
   await load();
  }catch(e){if(st)st.textContent='Error: '+(e.message||e)}
  finally{btn.disabled=false}
 });
 $('#meritManualPeriodOpen')?.addEventListener('click',async()=>{const sel=$('#meritManualPeriodSelect'),st=$('#meritManualPeriodActionStatus');if(!sel?.value)return;if(!confirm('¿Iniciar este periodo? Al abrirlo se enviará automáticamente la notificación de nuevo mes a los docentes.'))return;try{st.textContent='Abriendo periodo…';const d=await rpc('teacher_merit_open_period_manual',{p_period_id:sel.value});if(!d?.ok)throw new Error(d?.reason||'No se abrió');let push={};try{push=await window.ProfeSupabase.edge('merit-push',{event:'merit_period_started',period_id:sel.value})}catch(e){push={error:e.message||String(e)}};st.innerHTML=push?.ok?'<span class="success">✓ Periodo abierto y notificación enviada.</span>':'<span class="success">✓ Periodo abierto.</span> <span class="error">La notificación no pudo confirmarse: '+(push?.error||'sin respuesta')+'</span>';await load()}catch(e){st.textContent='Error: '+(e.message||e)}});
 $('#meritManualPeriodClose')?.addEventListener('click',async()=>{const st=$('#meritManualPeriodActionStatus');if(!confirm('¿Cerrar la captura del periodo activo?'))return;try{st.textContent='Cerrando captura…';const d=await rpc('teacher_merit_close_period_manual',{});if(!d?.ok)throw new Error(d?.reason||'No se cerró');st.innerHTML='<span class="success">✓ Captura cerrada manualmente.</span>';await load()}catch(e){st.textContent='Error: '+(e.message||e)}});
 document.querySelector('.meritNav[data-merit-pane="teacher-notice"]')?.addEventListener('click',()=>setTimeout(load,80));
 document.addEventListener('click',e=>{if(e.target?.id==='loginBtn')setTimeout(load,1500)});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load);else load();
})();