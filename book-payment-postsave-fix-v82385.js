// App Docente v8.23.85 · corrección de cobro: fecha ausente + protección contra doble registro
(function(){
  function localNowInput(){
    try{
      if(typeof localDateTimeInput==='function') return localDateTimeInput();
    }catch(_){}
    const d=new Date();
    const z=n=>String(n).padStart(2,'0');
    return d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate())+'T'+z(d.getHours())+':'+z(d.getMinutes());
  }

  function ensurePayDate(){
    let el=document.getElementById('payDate');
    if(!el){
      el=document.createElement('input');
      el.id='payDate';
      el.type='datetime-local';
      el.hidden=true;
      el.setAttribute('aria-hidden','true');
      document.body.appendChild(el);
    }
    if(!el.value) el.value=localNowInput();
    return el;
  }

  // La versión actual del modal ya no muestra #payDate, pero el flujo antiguo
  // todavía lo actualiza después de guardar. Mantener este campo oculto evita
  // que un pago ya insertado termine mostrando un error falso.
  function arm(){
    ensurePayDate();

    document.addEventListener('click',function(ev){
      const btn=ev.target?.closest?.('button');
      if(!btn) return;
      const label=String(btn.textContent||'').trim().toLowerCase();
      if(label!=='registrar pago') return;

      ensurePayDate();

      // Evitar reintentos rápidos que puedan duplicar un cobro.
      if(btn.dataset.bookPaymentSubmitting==='1'){
        ev.preventDefault();
        ev.stopImmediatePropagation();
        return;
      }
      btn.dataset.bookPaymentSubmitting='1';
      const original=btn.textContent;
      btn.disabled=true;
      btn.textContent='Registrando…';

      // El listener original del pago corre en este mismo evento.
      // Si por cualquier motivo el modal sigue abierto, se permite reintentar
      // después de unos segundos, pero nunca mediante doble toque inmediato.
      setTimeout(()=>{
        if(document.contains(btn)){
          btn.dataset.bookPaymentSubmitting='0';
          btn.disabled=false;
          if(btn.textContent==='Registrando…') btn.textContent=original||'Registrar pago';
        }
      },8000);
    },true);

    const obs=new MutationObserver(()=>ensurePayDate());
    obs.observe(document.documentElement,{childList:true,subtree:true});
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',arm,{once:true});
  else arm();
})();