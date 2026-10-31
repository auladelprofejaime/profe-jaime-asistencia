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
 document.querySelector('.meritNav[data-merit-pane="teacher-notice"]')?.addEventListener('click',()=>setTimeout(load,80));
 document.addEventListener('click',e=>{if(e.target?.id==='loginBtn')setTimeout(load,1500)});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load);else load();
})();