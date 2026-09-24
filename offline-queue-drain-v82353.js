// App Docente v8.23.53 · cola offline continua y pagos idempotentes
(function(){
  let drainBusy=false;
  let drainTimer=null;

  function queueDelay(ms){
    clearTimeout(drainTimer);
    drainTimer=setTimeout(()=>drainOfflineQueueContinuously().catch(()=>{}),ms);
  }

  function is429(e){
    return /\b429\b|too many requests|rate limit|límite temporal/i.test(String(e?.message||e||''));
  }

  function isTemporaryAuth(e){
    return /sesión de supabase temporalmente bloqueada|sesion de supabase temporalmente bloqueada|refresh_token|refresh token|already used|inicia sesión nuevamente|inicia sesion nuevamente/i.test(String(e?.message||e||''));
  }

  function isConnectivity(e){
    try{return typeof connectivityError==='function'&&connectivityError(e)}catch(_){return false}
  }

  async function replayQueueItem(item){
    if(item?.name==='teacher_book_payment_record'){
      return _originalRpc('teacher_book_payment_record_safe',{
        p_student_id:String(item.args?.p_student_id||''),
        p_amount:Number(item.args?.p_amount||0),
        p_method:item.args?.p_method||'cash',
        p_paid_at:item.args?.p_paid_at||new Date().toISOString(),
        p_note:item.args?.p_note??null,
        p_client_operation_id:String(item.id)
      });
    }
    return _originalRpc(item.name,item.args||{});
  }

  async function drainOfflineQueueContinuously(){
    if(drainBusy||!navigator.onLine||!cloudOnline||!_originalRpc)return;
    const initial=offlineQueueGet();
    if(!initial.length){updateConnectivityUi?.();return}

    drainBusy=true;
    try{
      let processedThisRun=0;
      while(navigator.onLine&&cloudOnline){
        const q=offlineQueueGet();
        if(!q.length)break;

        const item=q[0];
        try{
          const out=await replayQueueItem(item);
          if(out?.ok===false)throw new Error(out.reason||'No se pudo sincronizar');

          // Solo se elimina después de confirmación del servidor.
          q.shift();
          offlineQueueSet(q);
          processedThisRun++;
          updateConnectivityUi?.();

          // Ritmo sostenido sin saturar Supabase.
          await new Promise(r=>setTimeout(r,700));
        }catch(e){
          if(is429(e)){
            try{cloudOnline=true;supabaseReady=true}catch(_){}
            updateConnectivityUi?.();
            queueDelay(8000);
            return;
          }

          if(isTemporaryAuth(e)){
            // Mantener intacto el pendiente y esperar; no rotarlo ni bombardear el refresh.
            offlineQueueSet(q);
            updateConnectivityUi?.();
            queueDelay(60000);
            return;
          }

          if(isConnectivity(e)){
            try{cloudOnline=false}catch(_){}
            updateConnectivityUi?.();
            queueDelay(5000);
            return;
          }

          // Error 400/registro concreto: apartarlo al final para que no bloquee toda la cola.
          const q2=offlineQueueGet();
          if(q2.length&&q2[0]?.id===item.id){
            const bad=q2.shift();
            bad.last_error=String(e?.message||e);
            bad.last_error_at=new Date().toISOString();
            bad.retry_count=Number(bad.retry_count||0)+1;
            q2.push(bad);
            offlineQueueSet(q2);
          }

          // Si ya falló varias veces, dejarlo pendiente pero continuar con los demás.
          await new Promise(r=>setTimeout(r,1000));
        }

        // Evitar monopolizar la app, pero continuar enseguida si aún hay cola.
        if(processedThisRun>=12)break;
      }
    }finally{
      drainBusy=false;
      const remain=offlineQueueGet();
      if(remain.length&&navigator.onLine){
        queueDelay(2500);
      }else if(!remain.length){
        try{
          const fresh=await _originalRpc('teacher_book_payment_dashboard',{});
          if(fresh?.ok){
            offlineRpcSet?.('teacher_book_payment_dashboard',{},fresh);
            try{bookPayDashboard=fresh}catch(_){}
            try{renderBookMoneyTotals?.()}catch(_){}
            try{renderBookPaymentRoster?.()}catch(_){}
          }
        }catch(_){}
        updateConnectivityUi?.();
      }
    }
  }

  flushOfflineRpcQueue=drainOfflineQueueContinuously;

  // Cada alta nueva despierta la cola inmediatamente.
  try{
    const baseEnqueue=offlineEnqueueRpc;
    offlineEnqueueRpc=function(name,args={}){
      const id=baseEnqueue(name,args);
      if(navigator.onLine){
        queueDelay(400);
      }
      return id;
    };
  }catch(e){console.warn('No se pudo enlazar alta de cola',e)}

  window.addEventListener('online',()=>queueDelay(500));
  window.addEventListener('load',()=>setTimeout(()=>{
    if(navigator.onLine)drainOfflineQueueContinuously().catch(()=>{});
  },1200));

  // Si sigue habiendo pendientes, revisar periódicamente sin esperar un minuto completo.
  clearInterval(window.__offlineDrainHeartbeat);
  window.__offlineDrainHeartbeat=setInterval(()=>{
    if(navigator.onLine&&offlineQueueGet().length)drainOfflineQueueContinuously().catch(()=>{});
  },15000);
})();