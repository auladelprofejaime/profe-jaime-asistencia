// App Docente v8.23.47 · conexión estable con Supabase
(function(){
  let confirmedFailures=0;
  let lastConfirmedOnline=Date.now();
  let probeBusy=false;
  let probeTimer=null;

  function statusEl(){return document.getElementById('supabaseSyncState')}
  function paintStable(text,ok=true){const el=statusEl();if(!el)return;if(el.textContent===text)return;el.textContent=text;el.className=ok?'sync-ok':'sync-bad'}
  function pendingCount(){try{return typeof offlineQueueCount==='function'?offlineQueueCount():0}catch(_){return 0}}
  function paintConnected(){const p=pendingCount();paintStable(p?('🟢 Conectado a Supabase · ☁️ '+p+' pendiente'+(p===1?'':'s')+' de sincronizar'):'🟢 Conectado a Supabase · Todo sincronizado',true)}

  async function realProbe(){
    if(!navigator.onLine)return false;
    const client=window.ProfeSupabase;if(!client?.URL)return false;
    const ctl=new AbortController();const timeout=setTimeout(()=>ctl.abort(),7000);
    try{const headers={};if(client.KEY)headers.apikey=client.KEY;const r=await fetch(client.URL+'/auth/v1/settings',{method:'GET',headers,cache:'no-store',signal:ctl.signal});return !!r}
    catch(_){return false}finally{clearTimeout(timeout)}
  }

  async function stableConnectionProbe({force=false}={}){
    if(probeBusy){try{return !!cloudOnline}catch(_){return false}}
    if(!navigator.onLine){confirmedFailures=0;try{cloudOnline=false}catch(_){};const p=pendingCount();paintStable('🟠 Sin internet · trabajando localmente'+(p?' · ☁️ '+p+' pendiente'+(p===1?'':'s'):''),false);return false}
    if(!force&&Date.now()-lastConfirmedOnline<45000){try{cloudOnline=true;supabaseReady=true}catch(_){};paintConnected();return true}
    probeBusy=true;
    try{
      const ok=await realProbe();
      if(ok){confirmedFailures=0;lastConfirmedOnline=Date.now();try{cloudOnline=true;supabaseReady=true;if(typeof cloudLastOk!=='undefined')cloudLastOk=Date.now()}catch(_){};paintConnected();if(Date.now()>=Number(window.__supabaseRateLimitedUntil||0)){try{flushOfflineRpcQueue?.().catch(()=>{})}catch(_){}};return true}
      confirmedFailures++;
      if(confirmedFailures<3){try{cloudOnline=true;supabaseReady=true}catch(_){};paintStable('🟢 Conectado · verificando Supabase…',true);clearTimeout(probeTimer);probeTimer=setTimeout(()=>stableConnectionProbe({force:true}).catch(()=>{}),2500);return true}
      try{cloudOnline=false}catch(_){};const p=pendingCount();paintStable('🟡 Internet disponible · Supabase no responde · usando copia local'+(p?' · ☁️ '+p+' pendiente'+(p===1?'':'s'):''),false);return false
    }finally{probeBusy=false}
  }

  try{
    requireTeacherSession=async function(){
      const client=window.ProfeSupabase;
      if(!client){if(!navigator.onLine){$('#teacherLoginGate')?.classList.add('hidden');try{supabaseReady=false;cloudOnline=false}catch(_){};paintStable('🟠 Sin internet · usando la copia local.',false);return true}paintStable('🟡 Cargando conexión con Supabase…',false);return true}
      const saved=client.restore?.();
      if(!saved){$('#teacherLoginGate')?.classList.remove('hidden');paintStable('Falta iniciar sesión.',false);return false}
      $('#teacherLoginGate')?.classList.add('hidden');try{supabaseReady=true}catch(_){};
      if(navigator.onLine){if(Date.now()-lastConfirmedOnline<60000){try{cloudOnline=true}catch(_){};paintConnected()}stableConnectionProbe({force:false}).catch(()=>{})}
      return true
    }
  }catch(e){console.warn('Sesión estable Supabase',e)}

  try{
    const priorConnectivityError=connectivityError;
    connectivityError=function(e){
      const msg=String(e?.message||e||'').toLowerCase();
      if(/\b429\b|too many requests|rate limit|rate_limit|quota exceeded/.test(msg)){window.__supabaseRateLimitedUntil=Math.max(Number(window.__supabaseRateLimitedUntil||0),Date.now()+90000);try{cloudOnline=true;supabaseReady=true}catch(_){};paintStable('🟢 Conectado a Supabase · límite temporal de solicitudes',true);return false}
      return priorConnectivityError(e)
    }
  }catch(e){console.warn('Clasificación estable de conexión',e)}

  try{
    updateConnectivityUi=function(){
      const p=pendingCount();
      if(!navigator.onLine){paintStable('🟠 Sin internet · trabajando localmente'+(p?' · ☁️ '+p+' pendiente'+(p===1?'':'s'):''),false);return}
      let online=true;try{online=!!cloudOnline}catch(_){};
      if(online){if(Date.now()<Number(window.__supabaseRateLimitedUntil||0))paintStable('🟢 Conectado a Supabase · límite temporal de solicitudes'+(p?' · ☁️ '+p+' pendiente'+(p===1?'':'s'):''),true);else paintConnected()}
      else paintStable('🟡 Internet disponible · usando copia local mientras se reconecta'+(p?' · ☁️ '+p+' pendiente'+(p===1?'':'s'):''),false)
    };
    probeSupabaseConnection=stableConnectionProbe;
  }catch(e){console.warn('Monitor estable Supabase',e)}

  window.addEventListener('online',()=>{confirmedFailures=0;stableConnectionProbe({force:true}).catch(()=>{})});
  window.addEventListener('offline',()=>{confirmedFailures=0;try{cloudOnline=false}catch(_){};updateConnectivityUi()});
  clearInterval(window.__profeSupabaseProbeTimer);
  window.__profeSupabaseProbeTimer=setInterval(()=>{if(navigator.onLine)stableConnectionProbe({force:false}).catch(()=>{})},60000);
  if(navigator.onLine)setTimeout(()=>stableConnectionProbe({force:true}).catch(()=>{}),900);
})();