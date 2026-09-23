// App Docente v8.23.52 · transferencias pendientes incluidas en Control de dinero
(function(){
  function pendingBookTransferNet(){
    try{
      const q=typeof offlineQueueGet==='function'?offlineQueueGet():[];
      return (q||[]).reduce((sum,item)=>{
        if(item?.name==='teacher_book_payment_record'&&item?.args?.p_method==='transfer'){
          return sum+Number(item.args.p_amount||0);
        }
        if(item?.name==='teacher_book_payment_void'){
          // La anulación se reflejará al sincronizar/refrescar; no restar aquí sin conocer método.
          return sum;
        }
        return sum;
      },0);
    }catch(_){return 0}
  }

  function effectiveTransferAmount(){
    try{
      const pay=(typeof bookPayDashboard!=='undefined'&&bookPayDashboard)
        ?bookPayDashboard
        :(typeof offlineRpcGet==='function'?offlineRpcGet('teacher_book_payment_dashboard',{}):null)||{};
      const confirmed=Math.max(0,Number(pay.transfer_received||0)||0);
      return confirmed+pendingBookTransferNet();
    }catch(_){return 0}
  }

  try{
    renderBookMoneyTotals=function(){
      const counts=cashCutCounts(),
            cashCounted=cashCutTotal(counts),
            pay=(typeof bookPayDashboard!=='undefined'&&bookPayDashboard)||offlineRpcGet('teacher_book_payment_dashboard',{})||{},
            saved=cashCutLoadSaved();

      const transferExpected=effectiveTransferAmount();
      const transferCounted=transferExpected;

      // El efectivo físico conserva el último corte guardado.
      const cashExpected=Number(saved.cash_expected??(saved.saved_at?cashCounted:(pay.cash_received??0)));
      const received=cashExpected+transferExpected;
      const cashDiff=cashCounted-cashExpected;
      const transferDiff=0;
      const counted=cashCounted+transferCounted;
      const totalDiff=counted-received;

      $$('[data-cash-subtotal]').forEach(el=>{
        const d=Number(el.dataset.cashSubtotal);
        el.textContent=money(Number(counts[String(d)]||0)*d);
      });

      const set=(id,val)=>{const el=$('#'+id);if(el)el.textContent=val};
      set('cashExpected',money(cashExpected));
      set('cashCounted',money(cashCounted));
      set('cashDifference',money(cashDiff));
      set('transferExpected',money(transferExpected));
      set('transferDifference',money(transferDiff));
      set('moneyControlExpected',money(received));
      set('moneyControlCounted',money(counted));
      set('moneyControlDifference',money(totalDiff));

      const transferInput=$('#transferManualAmount');
      if(transferInput){
        transferInput.value=transferExpected||'';
        transferInput.disabled=true;
        transferInput.readOnly=true;
        transferInput.placeholder='Automático';
      }

      const pending=pendingBookTransferNet();
      let note=transferInput?.nextElementSibling;
      if(transferInput&&!note?.classList?.contains('auto-transfer-note')){
        note=document.createElement('small');
        note.className='hint auto-transfer-note';
        transferInput.insertAdjacentElement('afterend',note);
      }
      if(note?.classList?.contains('auto-transfer-note')){
        note.textContent=pending>0
          ?'Incluye '+money(pending)+' en transferencias guardadas en este iPad pendientes de sincronizar.'
          :'Se calcula automáticamente con los pagos registrados como transferencia.';
      }

      const status=$('#cashCutStatus');
      if(status){
        const ok=Math.abs(totalDiff)<.001;
        status.innerHTML=ok
          ?'<i>✓</i><h2>Control correcto</h2><p>Efectivo y transferencias coinciden con lo registrado.'+(pending>0?' Hay '+money(pending)+' en transferencias pendientes de sincronizar.':'')+'</p>'
          :'<i>!</i><h2>Hay una diferencia de '+money(totalDiff)+'</h2><p>Revisa las denominaciones del efectivo. Las transferencias se calculan automáticamente incluyendo las pendientes del iPad.</p>';
        status.className='status '+(ok?'good':'warn');
      }
      setPrivateVisibility('#bookMoneyControlDialog',privateVisible('#bookMoneyControlDialog'));
    };

    saveBookCashCut=function(){
      const counts=cashCutCounts(),
            cash_amount=cashCutTotal(counts),
            transfer_amount=effectiveTransferAmount();
      const payload={
        counts,
        transfer_amount,
        cash_expected:cash_amount,
        transfer_expected:transfer_amount,
        total:cash_amount+transfer_amount,
        saved_at:new Date().toISOString()
      };
      localStorage.setItem(BOOK_CASH_CUT_KEY,JSON.stringify(payload));
      if($('#cashLastSaved'))$('#cashLastSaved').textContent='Último control guardado: '+new Date(payload.saved_at).toLocaleString('es-MX');
      renderBookMoneyTotals();
    };
  }catch(e){console.warn('No se pudo instalar cálculo de transferencias pendientes',e)}

  // Cada vez que cambia la cola offline, refrescar el control si está abierto.
  try{
    const baseQueueSet=offlineQueueSet;
    offlineQueueSet=function(q){
      const r=baseQueueSet(q);
      try{if($('#bookMoneyControlDialog')?.open)renderBookMoneyTotals()}catch(_){}
      return r;
    };
  }catch(e){console.warn('No se pudo enlazar cola con Control de dinero',e)}

  window.addEventListener('load',()=>setTimeout(()=>{
    try{if($('#bookMoneyControlDialog')?.open)renderBookMoneyTotals()}catch(_){}
  },700));
})();