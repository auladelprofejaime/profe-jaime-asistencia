// App Docente v8.23.51 · solicitud masiva segura de libros
(function(){
  const REQUESTED_RECONCILE_IDS=["22001","22004","22005","22007","22009","22010","22013","22017","22026","22028","23003","23006","23011","23016","23017","23027","23039","23041","24002","24006","24010","24011","24013","24015","24018","24022","24024","24026","24027","24030","24033","24036","25013","25016","25019","25024","25027","25032","25036","25037","26001","26006","26008","26009","26012","26014","26016","26018","26020","26021","26023","26028","26031","26032"];

  function reconcileKnownRequested(){
    const ids=new Set(REQUESTED_RECONCILE_IDS);
    try{
      if(bookPayDashboard?.students){
        for(const r of bookPayDashboard.students){
          if(ids.has(String(r.id))&&!r.fulfillment_status)r.fulfillment_status='requested';
        }
        offlineRpcSet?.('teacher_book_payment_dashboard',{},bookPayDashboard);
      }
    }catch(_){}
    try{
      if(bookFulfillmentDashboard?.students){
        for(const r of bookFulfillmentDashboard.students){
          if(ids.has(String(r.id))&&!r.fulfillment_status){
            r.fulfillment_status='requested';
            r.requested_at=r.requested_at||'2026-09-24T00:00:00-06:00';
          }
        }
      }
    }catch(_){}
    try{renderBookPaymentRoster?.();renderEditorialFinance?.()}catch(_){}
  }

  function requestQueueKey(ids){return [...new Set((ids||[]).map(String))].sort().join(',')}
  function queueBookRequestOnce(ids){
    const key=requestQueueKey(ids);
    const q=offlineQueueGet?.()||[];
    const exists=q.some(x=>x?.name==='teacher_book_mark_requested'&&requestQueueKey(x?.args?.p_student_ids||[])===key);
    if(!exists)offlineEnqueueRpc?.('teacher_book_mark_requested',{p_student_ids:[...new Set(ids.map(String))]});
  }

  function temporaryRequestError(e){
    return /\b429\b|too many requests|rate limit|límite temporal|limite temporal|sesión de supabase temporalmente bloqueada|sesion de supabase temporalmente bloqueada|refresh_token|refresh token|already used|inicia sesión nuevamente|inicia sesion nuevamente|failed to fetch|network|timeout|offline/i.test(String(e?.message||e||''));
  }

  function is429(e){
    return /\b429\b|too many requests|rate limit|límite temporal/i.test(String(e?.message||e||''));
  }

  function setRequestedLocally(ids){
    const set=new Set((ids||[]).map(String));
    if(!set.size)return;

    try{
      if(bookPayDashboard?.students){
        for(const r of bookPayDashboard.students){
          if(set.has(String(r.id)))r.fulfillment_status='requested';
        }
        offlineRpcSet?.('teacher_book_payment_dashboard',{},bookPayDashboard);
      }
    }catch(_){}

    try{
      if(bookFulfillmentDashboard?.students){
        for(const r of bookFulfillmentDashboard.students){
          if(set.has(String(r.id))){
            r.fulfillment_status='requested';
            r.requested_at=r.requested_at||new Date().toISOString();
          }
        }
      }
    }catch(_){}

    try{renderBookPaymentRoster?.()}catch(_){}
    try{renderEditorialFinance?.()}catch(_){}
  }

  async function directRpc(name,args={}){
    if(!navigator.onLine)throw new Error('Sin internet');
    let fn=null;
    try{fn=(typeof _originalRpc==='function')?_originalRpc:null}catch(_){}
    fn=fn||window.ProfeSupabase?.rpc?.bind(window.ProfeSupabase);
    if(!fn)throw new Error('No hay conexión con Supabase.');
    return fn(name,args);
  }

  async function safeRequestAllLiquidated(){
    if(!navigator.onLine){
      alert('Necesitas internet para solicitar los libros. No se cambió ningún estado.');
      return;
    }

    const fulfillmentRows=(typeof bookFulfillmentDashboard!=='undefined'&&bookFulfillmentDashboard?.students)
      ?bookFulfillmentDashboard.students:[];
    const paymentRows=(typeof bookPayDashboard!=='undefined'&&bookPayDashboard?.students)
      ?bookPayDashboard.students:[];

    // Fuente preferida: tablero de gestión. Respaldo: tablero de pagos.
    let ids=fulfillmentRows.length
      ?fulfillmentRows.filter(r=>r.payment_status==='paid'&&!r.fulfillment_status).map(r=>String(r.id))
      :paymentRows.filter(r=>r.status==='paid'&&!r.fulfillment_status).map(r=>String(r.id));

    ids=[...new Set(ids)];

    if(!ids.length){
      alert('No hay libros liquidados pendientes de solicitar.');
      return;
    }

    if(!confirm('¿Marcar como solicitados los '+ids.length+' libros liquidados pendientes?\n\nMonto a editorial: '+money(ids.length*EDITORIAL_UNIT_COST)+'\n\nEsta acción no modifica pagos ni saldos.'))return;

    const btn=document.querySelector('#bookRequestAllPaid');
    const old=btn?.textContent;
    if(btn){btn.disabled=true;btn.textContent='Solicitando…'}

    try{
      // Usa la función existente y estable de Supabase.
      const out=await directRpc('teacher_book_mark_requested',{p_student_ids:ids});
      if(!out?.ok)throw new Error(out?.reason||'No se pudo completar la solicitud.');

      setRequestedLocally(ids);
      alert('Listo. '+ids.length+' libro(s) quedaron marcados como solicitados.');

      // Refresco silencioso y separado; nunca convierte una acción exitosa en error.
      setTimeout(()=>{
        try{if(navigator.onLine&&typeof loadBookFulfillment==='function')loadBookFulfillment().catch(()=>{})}catch(_){}
      },10000);
    }catch(e){
      if(temporaryRequestError(e)){
        queueBookRequestOnce(ids);
        setRequestedLocally(ids);
        alert('La solicitud quedó protegida en este iPad. Los '+ids.length+' libro(s) se muestran como solicitados y se sincronizarán automáticamente con Supabase. No se modificó ningún pago ni saldo.');
      }else{
        alert('No se pudo solicitar los libros: '+(e?.message||e));
      }
    }finally{
      if(btn){btn.disabled=false;btn.textContent=old||'📦 Solicitar todos los liquidados'}
    }
  }

  // Sustituye el listener anterior antes de que llegue al manejador viejo.
  window.addEventListener('load',()=>{
    setTimeout(reconcileKnownRequested,500);
    const btn=document.querySelector('#bookRequestAllPaid');
    if(!btn)return;
    btn.addEventListener('click',e=>{
      e.preventDefault();
      e.stopImmediatePropagation();
      safeRequestAllLiquidated().catch(err=>alert('No se pudo completar: '+(err?.message||err)));
    },true);
  });

  // También deja segura la acción individual "Solicitar libro".
  try{
    markBooksRequested=async function(forcedIds=null){
      const ids=(forcedIds||[...document.querySelectorAll('[data-book-request]:checked')].map(x=>x.dataset.bookRequest)).map(String);
      if(!ids.length)return alert('Selecciona al menos un libro liquidado.');
      if(!navigator.onLine)return alert('Necesitas internet para cambiar el estado a solicitado.');
      if(!confirm('¿Marcar '+ids.length+' libro(s) como solicitado(s) a la editorial?'))return;

      try{
        const out=await directRpc('teacher_book_mark_requested',{p_student_ids:ids});
        if(!out?.ok)throw new Error(out?.reason||'No se pudo guardar');
        setRequestedLocally(ids);
        alert('Libro(s) marcado(s) como solicitado(s).');
        setTimeout(()=>{try{loadBookFulfillment?.().catch(()=>{})}catch(_){}},8000);
      }catch(e){
        if(temporaryRequestError(e)){
          queueBookRequestOnce(ids);
          setRequestedLocally(ids);
          alert('La solicitud quedó guardada en este iPad y se sincronizará automáticamente. No se modificó ningún pago.');
        }else alert('No se pudo confirmar el cambio: '+(e?.message||e));
      }
    };
  }catch(e){console.warn('Solicitud individual segura',e)}
})();