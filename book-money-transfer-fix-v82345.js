// App Docente v8.23.45 · transferencias automáticas en Control de dinero
(function(){
  function autoTransferAmount(){
    try{
      const pay=(typeof bookPayDashboard!=='undefined'&&bookPayDashboard)
        ?bookPayDashboard
        :(typeof offlineRpcGet==='function'?offlineRpcGet('teacher_book_payment_dashboard',{}):null)||{};
      return Math.max(0,Number(pay.transfer_received||0)||0);
    }catch(_){return 0}
  }

  try{
    renderBookMoneyTotals=function(){
      const counts=cashCutCounts(),
            cashCounted=cashCutTotal(counts),
            pay=(typeof bookPayDashboard!=='undefined'&&bookPayDashboard)||offlineRpcGet('teacher_book_payment_dashboard',{})||{},
            saved=cashCutLoadSaved();

      const transferExpected=Math.max(0,Number(pay.transfer_received||0)||0);
      const transferCounted=transferExpected;

      // El efectivo conserva el corte físico guardado.
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
        if(!transferInput.nextElementSibling?.classList?.contains('auto-transfer-note')){
          const note=document.createElement('small');
          note.className='hint auto-transfer-note';
          note.textContent='Se calcula automáticamente con los pagos registrados como transferencia.';
          transferInput.insertAdjacentElement('afterend',note);
        }
      }

      const status=$('#cashCutStatus');
      if(status){
        const ok=Math.abs(totalDiff)<.001;
        status.innerHTML=ok
          ?'<i>✓</i><h2>Control correcto</h2><p>Efectivo y transferencias coinciden con lo registrado.</p>'
          :`<i>!</i><h2>Hay una diferencia de ${money(totalDiff)}</h2><p>Revisa las denominaciones del efectivo. Las transferencias ya se toman automáticamente de los pagos registrados.</p>`;
        status.className='status '+(ok?'good':'warn');
      }
      setPrivateVisibility('#bookMoneyControlDialog',privateVisible('#bookMoneyControlDialog'));
    };

    saveBookCashCut=function(){
      const counts=cashCutCounts(),
            cash_amount=cashCutTotal(counts),
            transfer_amount=autoTransferAmount();
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

    const baseLoadBookMoneyControl=loadBookMoneyControl;
    loadBookMoneyControl=async function(){
      await baseLoadBookMoneyControl();
      renderBookMoneyTotals();
    };
  }catch(e){
    console.warn('No se pudo instalar transferencias automáticas',e);
  }

  window.addEventListener('load',()=>setTimeout(()=>{
    try{
      const input=$('#transferManualAmount');
      if(input){input.disabled=true;input.readOnly=true;}
      if($('#bookMoneyControlDialog')?.open)renderBookMoneyTotals();
    }catch(_){}
  },600));
})();