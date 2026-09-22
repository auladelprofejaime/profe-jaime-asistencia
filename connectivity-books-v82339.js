// App Docente v8.23.39 · estabilidad de conexión + acción masiva de libros
(function(){
  let stableProbeBusy=false;
  let stableFailures=0;
  let lastStableOk=0;
  let recoveryTimer=null;
  let visualTimer=null;

  const getSyncState=()=>document.getElementById('supabaseSyncState');

  function setStableStatus(text,ok=true){
    const el=getSyncState();
    if(!el)return;
    el.textContent=text;
    el.className=ok?'sync-ok':'sync-bad';
  }

  async function actualSupabaseReachability(){
    const client=window.ProfeSupabase;
    if(!navigator.onLine||!client?.URL)return false;
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),8000);
    try{
      const headers={};
      if(client.KEY)headers.apikey=client.KEY;
      // /auth/v1/settings es una consulta pequeña que obliga a comprobar
      // conectividad real con el proyecto, a diferencia de leer solo el token local.
      await fetch(client.URL+'/auth/v1/settings',{
        method:'GET',
        headers,
        cache:'no-store',
        signal:controller.signal
      });
      return true; // cualquier respuesta HTTP demuestra que el proyecto es alcanzable
    }catch(_){
      return false;
    }finally{
      clearTimeout(timeout);
    }
  }

  async function stableProbe({force=false}={}){
    if(!navigator.onLine){
      try{cloudOnline=false}catch(_){}
      stableFailures=0;
      lastStableOk=0;
      if(typeof updateConnectivityUi==='function')updateConnectivityUi();
      return false;
    }
    if(stableProbeBusy){
      try{return !!cloudOnline}catch(_){return false}
    }
    if(!force&&lastStableOk&&Date.now()-lastStableOk<30000){
      try{
        cloudOnline=true;
        supabaseReady=true;
      }catch(_){}
      if(typeof updateConnectivityUi==='function')updateConnectivityUi();
      return true;
    }

    stableProbeBusy=true;
    try{
      const ok=await actualSupabaseReachability();
      if(ok){
        stableFailures=0;
        lastStableOk=Date.now();
        try{
          cloudOnline=true;
          supabaseReady=true;
          if(typeof cloudLastOk!=='undefined')cloudLastOk=Date.now();
        }catch(_){}
        if(typeof updateConnectivityUi==='function')updateConnectivityUi();
        try{if(typeof flushOfflineRpcQueue==='function')flushOfflineRpcQueue().catch(()=>{})}catch(_){}
        return true;
      }

      stableFailures++;
      // Un único fallo con Wi‑Fi/Internet activo se trata como transitorio.
      // Solo después de dos comprobaciones reales fallidas se muestra reconexión.
      if(stableFailures>=2){
        try{cloudOnline=false}catch(_){}
        if(typeof updateConnectivityUi==='function')updateConnectivityUi();
      }else{
        try{cloudOnline=true}catch(_){}
        setStableStatus('🟢 Internet disponible · verificando conexión con Supabase…',true);
        scheduleRecoveryProbe(1400);
      }
      return false;
    }finally{
      stableProbeBusy=false;
    }
  }

  function scheduleRecoveryProbe(delay=500){
    clearTimeout(recoveryTimer);
    recoveryTimer=setTimeout(()=>stableProbe({force:true}).catch(()=>{}),delay);
  }

  // Sustituye solo la presentación del estado de conexión.
  // No borra cola offline ni modifica datos.
  try{
    const baseUpdate=updateConnectivityUi;
    updateConnectivityUi=function(){
      let online=false;
      try{online=!!cloudOnline}catch(_){}
      const pending=(typeof offlineQueueCount==='function'?offlineQueueCount():0);

      if(!navigator.onLine){
        clearTimeout(visualTimer);
        return baseUpdate();
      }

      if(online){
        clearTimeout(visualTimer);
        stableFailures=0;
        lastStableOk=Date.now();
        return baseUpdate();
      }

      // Evita el "conectado / desconectado" instantáneo por un solo request lento.
      setStableStatus(
        pending
          ? '🟢 Internet disponible · verificando Supabase · ☁️ '+pending+' pendiente'+(pending===1?'':'s')
          : '🟢 Internet disponible · verificando Supabase…',
        true
      );
      scheduleRecoveryProbe(350);

      clearTimeout(visualTimer);
      visualTimer=setTimeout(()=>{
        let stillOffline=false;
        try{stillOffline=!cloudOnline}catch(_){stillOffline=true}
        if(navigator.onLine&&stillOffline&&stableFailures>=2){
          baseUpdate();
        }
      },9000);
    };

    // El monitor de 60 s del archivo principal llama esta función por nombre,
    // por lo que desde aquí usa la comprobación más tolerante.
    probeSupabaseConnection=stableProbe;
  }catch(e){
    console.warn('No se pudo instalar estabilizador de Supabase',e);
  }

  // Evita que requireTeacherSession marque la nube como desconectada solo por
  // restaurar una sesión local válida. El archivo principal usa local-first, pero
  // no debe degradar cloudOnline cada vez que se abre un módulo.
  try{
    const baseRequireTeacherSession=requireTeacherSession;
    requireTeacherSession=async function(){
      let wasOnline=false;
      try{wasOnline=!!cloudOnline}catch(_){}
      const ok=await baseRequireTeacherSession();
      if(ok&&navigator.onLine){
        if(wasOnline){
          try{cloudOnline=true;supabaseReady=true}catch(_){}
          if(typeof updateConnectivityUi==='function')updateConnectivityUi();
        }else{
          scheduleRecoveryProbe(150);
        }
      }
      return ok;
    };
  }catch(e){
    console.warn('No se pudo estabilizar la validación de sesión',e);
  }

  // Después de cualquier RPC, si hubo un fallo transitorio que dejó cloudOnline
  // en falso, se comprueba la conectividad real sin esperar un minuto completo.
  try{
    const client=window.ProfeSupabase;
    if(client?.rpc&&!client.__stabilityRecoveryWrapped){
      const rpcNow=client.rpc.bind(client);
      client.rpc=async function(name,args={}){
        try{
          return await rpcNow(name,args);
        }finally{
          let online=false;
          try{online=!!cloudOnline}catch(_){}
          if(navigator.onLine&&!online)scheduleRecoveryProbe(250);
        }
      };
      client.__stabilityRecoveryWrapped=true;
    }
  }catch(e){
    console.warn('No se pudo instalar recuperación rápida de conexión',e);
  }

  async function markAllLiquidatedBooksRequested(){
    if(!navigator.onLine){
      alert('Necesitas conexión para marcar los libros como solicitados. No se modificó ningún registro.');
      return;
    }

    // Primero refresca el resumen si existe conexión real.
    try{
      let online=false;
      try{online=!!cloudOnline}catch(_){}
      if(!online)await stableProbe({force:true});
      if(typeof loadBookFulfillment==='function')await loadBookFulfillment();
    }catch(_){}

    const fulfillmentRows=(typeof bookFulfillmentDashboard!=='undefined'&&bookFulfillmentDashboard?.students)
      ?bookFulfillmentDashboard.students:[];
    let ids=fulfillmentRows
      .filter(r=>r.payment_status==='paid'&&!r.fulfillment_status)
      .map(r=>String(r.id));

    // Respaldo: si el tablero de cumplimiento todavía no cargó, usa el tablero
    // de pagos y excluye cualquier ID ya solicitado/entregado/externo conocido.
    if(!ids.length&&typeof bookPayDashboard!=='undefined'&&bookPayDashboard?.students){
      const fulfillmentMap=new Map(fulfillmentRows.map(r=>[String(r.id),r.fulfillment_status||null]));
      ids=bookPayDashboard.students
        .filter(r=>r.status==='paid'&&!fulfillmentMap.get(String(r.id)))
        .map(r=>String(r.id));
    }

    ids=[...new Set(ids)];
    if(!ids.length){
      alert('No hay libros liquidados pendientes de solicitar.');
      return;
    }

    if(typeof markBooksRequested!=='function'){
      alert('No se pudo abrir la acción de libros. Actualiza la app e intenta de nuevo.');
      return;
    }

    // markBooksRequested ya muestra confirmación con cantidad y monto editorial.
    await markBooksRequested(ids);
  }

  function bindBulkBookRequest(){
    const btn=document.getElementById('bookRequestAllPaid');
    if(!btn)return;
    btn.type='button';
    btn.addEventListener('click',e=>{
      e.preventDefault();
      markAllLiquidatedBooksRequested().catch(err=>{
        console.error(err);
        alert('No se modificó ningún registro: '+(err?.message||err));
      });
    });
  }


  // v8.23.43 · protección contra 429 en Pagos de libros
  // Nunca dejar la pantalla vacía si Supabase limita temporalmente las consultas.
  try{
    const baseLoadBookPayments=loadBookPayments;
    let bookPaymentsLoading=false;
    let lastBookPaymentsAttempt=0;

    loadBookPayments=async function(){
      const now=Date.now();
      if(bookPaymentsLoading){
        const cached=offlineRpcGet('teacher_book_payment_dashboard',{})||bookPayDashboard;
        if(cached?.students){
          bookPayDashboard=cached;
          renderEditorialFinance();
          const rows=cached.students||[];
          const groups=[...new Set(rows.map(x=>String(x.group_name||'')).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
          const g=$('#payGroup');
          if(g){
            const old=g.value;
            g.innerHTML=groups.map(x=>`<option value="${safe(x)}">${safe(x)}</option>`).join('');
            if(groups.includes(old))g.value=old;
          }
          fillBookPaymentStudents();
          renderBookPaymentRoster();
        }
        return;
      }

      // Evita dobles cargas casi simultáneas al abrir/cambiar de sección.
      if(now-lastBookPaymentsAttempt<1200){
        const cached=offlineRpcGet('teacher_book_payment_dashboard',{})||bookPayDashboard;
        if(cached?.students){
          bookPayDashboard=cached;
          renderEditorialFinance();
          fillBookPaymentStudents();
          renderBookPaymentRoster();
        }
        return;
      }

      bookPaymentsLoading=true;
      lastBookPaymentsAttempt=now;

      // Mostrar primero la copia local, sin esperar a la nube.
      const cached=offlineRpcGet('teacher_book_payment_dashboard',{})||bookPayDashboard;
      if(cached?.students){
        bookPayDashboard=cached;
        renderEditorialFinance();
        const rows=cached.students||[];
        const groups=[...new Set(rows.map(x=>String(x.group_name||'')).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
        const g=$('#payGroup');
        if(g){
          const old=g.value;
          g.innerHTML=groups.map(x=>`<option value="${safe(x)}">${safe(x)}</option>`).join('');
          if(groups.includes(old))g.value=old;
        }
        fillBookPaymentStudents();
        renderBookPaymentRoster();
      }

      try{
        await baseLoadBookPayments();
      }catch(e){
        const msg=String(e?.message||e||'');
        const fallback=offlineRpcGet('teacher_book_payment_dashboard',{})||bookPayDashboard;
        if(fallback?.students){
          bookPayDashboard=fallback;
          renderEditorialFinance();
          fillBookPaymentStudents();
          renderBookPaymentRoster();
          const box=$('#payRoster');
          if(box && /429|too many requests|rate limit/i.test(msg)){
            const note=document.createElement('div');
            note.className='message warn';
            note.innerHTML='Supabase está limitando temporalmente las consultas. Se muestra la última copia guardada; tus pagos siguen registrados.';
            box.prepend(note);
          }
        }else{
          throw e;
        }
      }finally{
        bookPaymentsLoading=false;
      }
    };
  }catch(e){
    console.warn('No se pudo instalar protección 429 de pagos',e);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{
    bindBulkBookRequest();
    if(navigator.onLine)setTimeout(()=>stableProbe({force:true}).catch(()=>{}),500);
  });
  else{
    bindBulkBookRequest();
    if(navigator.onLine)setTimeout(()=>stableProbe({force:true}).catch(()=>{}),500);
  }
})();