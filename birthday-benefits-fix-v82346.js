// App Docente v8.23.46 · estabilidad de Beneficios de cumpleaños
(function(){
  async function birthdayLiveRpc(name,args={}){
    if(!navigator.onLine)throw new Error('Necesitas conexión para modificar beneficios de cumpleaños.');
    try{
      if(typeof probeSupabaseConnection==='function')await probeSupabaseConnection({force:true});
    }catch(_){}
    let direct=null;
    try{direct=(typeof _originalRpc==='function')?_originalRpc:null}catch(_){}
    const fn=direct||window.ProfeSupabase?.rpc?.bind(window.ProfeSupabase);
    if(!fn)throw new Error('No se pudo conectar con Supabase.');
    const out=await fn(name,args);
    try{cloudOnline=true;supabaseReady=true;updateConnectivityUi?.()}catch(_){}
    try{if(typeof offlineRpcSet==='function')offlineRpcSet(name,args,out)}catch(_){}
    return out;
  }

  // Las acciones de cumpleaños requieren confirmación inmediata del servidor.
  try{
    const baseSensitive=offlineSensitiveServerAction;
    offlineSensitiveServerAction=function(name){
      if(/^teacher_birthday_benefit_(reveal|accept|register_use|undo_use)$/.test(String(name||'')))return true;
      return baseSensitive(name);
    };
  }catch(_){}

  async function birthdayRefreshAll(){
    try{
      let direct=null;
      try{direct=(typeof _originalRpc==='function')?_originalRpc:null}catch(_){}
      const fn=direct||window.ProfeSupabase?.rpc?.bind(window.ProfeSupabase);
      if(fn){
        const fresh=await fn('teacher_birthday_benefit_list',{});
        try{if(typeof offlineRpcSet==='function')offlineRpcSet('teacher_birthday_benefit_list',{},fresh)}catch(_){}
      }
    }catch(_){}
    await renderBirthdayBenefitsAdmin();
    try{await loadTeacherBirthdayBenefits()}catch(_){}
    try{
      if(typeof students==='function'){
        const s=await students();
        renderWeeklyBirthdays?.(s);
      }
    }catch(_){}
  }

  birthdayAdminReveal=async function(studentId){
    if(!confirm('¿Revelar ahora el beneficio? Se elegirá aleatoriamente y no podrá volver a sortearse.'))return;
    const btn=document.querySelector('[data-bday-reveal="'+CSS.escape(String(studentId))+'"]');
    const old=btn?.textContent;
    if(btn){btn.disabled=true;btn.textContent='Revelando…'}
    try{
      const out=await birthdayLiveRpc('teacher_birthday_benefit_reveal',{p_student_id:String(studentId)});
      if(!out?.ok)throw new Error(out?.reason==='not_eligible_yet'?'Todavía no llega su cumpleaños.':out?.reason||'No se pudo revelar.');
      const label=out?.benefit?.label||'Beneficio de cumpleaños';
      alert('🎁 Beneficio revelado: '+label);
      await birthdayRefreshAll();
    }catch(e){
      alert('No se pudo revelar el beneficio: '+(e?.message||e));
      if(btn){btn.disabled=false;btn.textContent=old||'🎁 Revelar beneficio'}
    }
  };

  birthdayAdminAccept=async function(studentId){
    if(!confirm('¿Confirmar que el alumno aceptó este beneficio?'))return;
    try{
      const out=await birthdayLiveRpc('teacher_birthday_benefit_accept',{p_student_id:String(studentId)});
      if(!out?.ok)throw new Error(out?.reason||'No se pudo aceptar.');
      await birthdayRefreshAll();
    }catch(e){alert('No se pudo aceptar el beneficio: '+(e?.message||e))}
  };

  birthdayAdminRegisterUse=async function(studentId){
    if(!confirm('¿Registrar un uso de este beneficio?'))return;
    try{
      const out=await birthdayLiveRpc('teacher_birthday_benefit_register_use',{p_student_id:String(studentId)});
      if(!out?.ok)throw new Error(out?.reason||'No se pudo registrar el uso.');
      await birthdayRefreshAll();
    }catch(e){alert('No se pudo registrar el uso: '+(e?.message||e))}
  };

  birthdayAdminUndoUse=async function(studentId){
    if(!confirm('¿Deshacer el último uso registrado de este beneficio?'))return;
    try{
      const out=await birthdayLiveRpc('teacher_birthday_benefit_undo_use',{p_student_id:String(studentId)});
      if(!out?.ok)throw new Error(out?.reason||'No se pudo deshacer el uso.');
      await birthdayRefreshAll();
    }catch(e){alert('No se pudo deshacer el uso: '+(e?.message||e))}
  };
})();