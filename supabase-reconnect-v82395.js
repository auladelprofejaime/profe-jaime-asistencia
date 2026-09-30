// App Docente v8.23.95 · reconexion visible y segura de Supabase
(function(){
  function gate(){return document.getElementById('teacherLoginGate')}
  function state(msg,ok=false){try{supaState(msg,ok)}catch(_){const el=document.getElementById('supabaseSyncState');if(el)el.textContent=msg}}
  function showGate(){
    const g=gate(); if(g)g.classList.remove('hidden');
    setTimeout(()=>document.getElementById('teacherLoginEmail')?.focus(),50);
  }
  function hideGate(){gate()?.classList.add('hidden')}
  function hasSession(){try{return !!window.ProfeSupabase?.restore?.()?.access_token}catch(_){return false}}

  async function doLogin(){
    const btn=document.getElementById('teacherLoginBtn');
    const err=document.getElementById('teacherLoginError');
    const email=document.getElementById('teacherLoginEmail')?.value?.trim()||'';
    const password=document.getElementById('teacherLoginPassword')?.value||'';
    const remember=!!document.getElementById('teacherRemember')?.checked;
    if(!email||!password){if(err)err.textContent='Escribe correo y contraseña.';return}
    const old=btn?.textContent;
    try{
      if(btn){btn.disabled=true;btn.textContent='Conectando…'}
      if(err)err.textContent='';
      await window.ProfeSupabase.login(email,password,remember);
      hideGate();
      state('🟢 Conectado a Supabase · verificando información…',true);
      try{cloudOnline=true;supabaseReady=true}catch(_){}
      try{await window.reconcileAllActivities?.({manual:false})}catch(_){}
      try{await window.flushOfflineRpcQueue?.()}catch(_){}
      try{updateConnectivityUi?.()}catch(_){}
      state('🟢 Conectado a Supabase',true);
    }catch(e){
      if(err)err.textContent='No se pudo iniciar sesión: '+String(e?.message||e);
      showGate();
    }finally{
      if(btn){btn.disabled=false;btn.textContent=old||'Iniciar sesión'}
    }
  }

  function install(){
    const sync=document.getElementById('syncSupabaseBtn');
    if(sync){
      sync.addEventListener('click',e=>{
        if(!hasSession()){
          e.preventDefault();e.stopImmediatePropagation();
          state('🔐 Inicia sesión de profesor para reconectar Supabase. Tus datos siguen en la app.',false);
          showGate();
        }
      },true);
    }
    const login=document.getElementById('teacherLoginBtn');
    if(login){
      login.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();doLogin()},true);
    }
    for(const id of ['teacherLoginEmail','teacherLoginPassword']){
      document.getElementById(id)?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();doLogin()}});
    }
    if(!hasSession()){
      state('🔐 Supabase desconectado · toca “Sincronizar ahora” para iniciar sesión. Tus datos locales no se borraron.',false);
    }
  }
  window.addEventListener('load',()=>setTimeout(install,700),{once:true});
})();