// App Docente v8.23.51 · solicitud masiva segura de libros
(function(){
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
      if(is429(e)){
        alert('Supabase está aplicando un límite temporal. No puedo confirmar el cambio todavía. Espera a que vuelva a verde y vuelve a intentarlo; repetirlo es seguro y no modifica pagos.');
      }else{
        alert('No se pudo solicitar los libros: '+(e?.message||e));
      }
    }finally{
      if(btn){btn.disabled=false;btn.textContent=old||'📦 Solicitar todos los liquidados'}
    }
  }

  // Sustituye el listener anterior antes de que llegue al manejador viejo.
  window.addEventListener('load',()=>{
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
        if(is429(e))alert('Supabase está limitando temporalmente las solicitudes. No puedo confirmar aún el cambio. Espera a que vuelva a verde y vuelve a intentarlo; la acción es segura y no duplica solicitudes.');
        else alert('No se pudo confirmar el cambio: '+(e?.message||e));
      }
    };
  }catch(e){console.warn('Solicitud individual segura',e)}
})();