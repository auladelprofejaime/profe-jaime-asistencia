// App Docente v8.23.65 · pagos no se bloquean por renovación de sesión
(function(){
  function paymentAuthTemporaryError(e){
    const m=String(e?.message||e||'').toLowerCase();
    return /sesión de supabase temporalmente bloqueada|sesion de supabase temporalmente bloqueada|inicia sesión nuevamente|inicia sesion nuevamente|refresh_token|refresh token|already used|over_request_rate_limit|\b429\b|too many requests|rate limit|límite temporal|limite temporal/.test(m);
  }

  const client=window.ProfeSupabase;
  if(!client?.rpc||client.__bookPaymentAuthFallback)return;

  const previousRpc=client.rpc.bind(client);
  client.rpc=async function(name,args={}){
    try{
      return await previousRpc(name,args);
    }catch(e){
      if(name==='teacher_book_payment_record'&&paymentAuthTemporaryError(e)){
        // El cobro nunca se pierde ni se bloquea por autenticación temporal.
        const id=typeof offlineEnqueueRpc==='function'?offlineEnqueueRpc(name,args):null;
        const out=typeof offlineSyntheticResult==='function'
          ?offlineSyntheticResult(name,args)
          :{ok:true,offline_queued:true,queued:true};

        out.offline_queued=true;
        out.queued=true;
        out.auth_deferred=true;
        if(id)out.queue_id=id;

        try{
          cloudOnline=false;
          updateConnectivityUi?.();
        }catch(_){}
        return out;
      }
      throw e;
    }
  };
  client.__bookPaymentAuthFallback=true;

  // Ajustar el mensaje después de un cobro en cola: puede haber internet,
  // solo la sesión está esperando recuperación.
  const observer=new MutationObserver(()=>{
    const msg=document.querySelector('#payScanPopupMsg');
    if(!msg)return;
    const txt=msg.textContent||'';
    if(txt.includes('guardado en el iPad')&&txt.includes('volver internet')){
      msg.innerHTML=msg.innerHTML.replace(
        'Se sincronizará al volver internet.',
        'Quedó protegido en el iPad y se sincronizará automáticamente con Supabase.'
      );
    }
  });
  observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true});
})();