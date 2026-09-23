// App Docente v8.23.48 · Pagos de libros estables y comprobante
(function(){
  let payDashboardPromise=null;
  let payStudentPromises=new Map();
  let lastPayDashboardAt=0;

  function isRateOrBadRequest(e){
    const m=String(e?.message||e||'').toLowerCase();
    return /\b429\b|too many requests|rate limit|\b400\b|supabase 400/.test(m);
  }

  function paymentCachedStudent(id){
    try{
      return (typeof offlineRpcGet==='function' && offlineRpcGet('teacher_book_payment_student',{p_student_id:String(id)}))
        || (typeof localBookPaymentStudent==='function' ? localBookPaymentStudent(String(id)) : null)
        || null;
    }catch(_){return null}
  }

  function paymentRowFromDashboard(id){
    const rows=(typeof bookPayDashboard!=='undefined'&&bookPayDashboard?.students)||[];
    const r=rows.find(x=>String(x.id)===String(id));
    if(!r)return null;
    return {
      ok:true,
      student:{id:String(r.id),name:r.name||r.student_name||'Alumno',group_name:r.group_name||'',list_number:r.list_number||''},
      paid:Number(r.paid||0),
      pending:Number(r.pending??Math.max(0,280-Number(r.paid||0))),
      status:r.status||'none',
      movements:[]
    };
  }

  async function fetchPaymentStudentOnce(id,{force=false}={}){
    id=String(id||'').trim();
    if(!id)throw new Error('Alumno no válido.');
    if(payStudentPromises.has(id))return payStudentPromises.get(id);

    const run=(async()=>{
      const cached=paymentCachedStudent(id)||paymentRowFromDashboard(id);
      if(!navigator.onLine||!window.ProfeSupabase){
        if(cached)return cached;
        throw new Error('Sin conexión y sin copia local de este alumno.');
      }
      try{
        let direct=null;try{direct=(typeof _originalRpc==='function')?_originalRpc:null}catch(_){}
        const fn=direct||window.ProfeSupabase.rpc.bind(window.ProfeSupabase);
        const out=await fn('teacher_book_payment_student',{p_student_id:id});
        if(!out?.ok)throw new Error(out?.reason||'No se pudo cargar el alumno.');
        try{offlineRpcSet?.('teacher_book_payment_student',{p_student_id:id},out)}catch(_){}
        return out;
      }catch(e){
        if(cached&&isRateOrBadRequest(e))return {...cached,_stale:true,_error:String(e?.message||e)};
        throw e;
      }finally{
        payStudentPromises.delete(id);
      }
    })();
    payStudentPromises.set(id,run);
    return run;
  }

  async function stableLoadBookPayments({force=false}={}){
    if(payDashboardPromise)return payDashboardPromise;
    if(!force && Date.now()-lastPayDashboardAt<5000 && typeof bookPayDashboard!=='undefined' && bookPayDashboard?.students){
      renderEditorialFinance?.();fillBookPaymentStudents?.();renderBookPaymentRoster?.();return bookPayDashboard;
    }
    payDashboardPromise=(async()=>{
      const cached=(typeof offlineRpcGet==='function'?offlineRpcGet('teacher_book_payment_dashboard',{}):null)
        || (typeof bookPayDashboard!=='undefined'?bookPayDashboard:null);
      if(cached?.students){
        bookPayDashboard=cached;
        renderEditorialFinance?.();
        fillBookPaymentStudents?.();
        renderBookPaymentRoster?.();
      }
      if(!navigator.onLine||!window.ProfeSupabase)return cached;

      try{
        let direct=null;try{direct=(typeof _originalRpc==='function')?_originalRpc:null}catch(_){}
        const fn=direct||window.ProfeSupabase.rpc.bind(window.ProfeSupabase);
        const out=await fn('teacher_book_payment_dashboard',{});
        if(!out?.ok)throw new Error(out?.reason||'No se pudo cargar pagos');
        bookPayDashboard=out;lastPayDashboardAt=Date.now();
        try{offlineRpcSet?.('teacher_book_payment_dashboard',{},out)}catch(_){}
        renderEditorialFinance?.();
        const rows=out.students||[];
        const groups=[...new Set(rows.map(x=>String(x.group_name||'')).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
        const g=$('#payGroup');
        if(g){
          const old=g.value;
          g.innerHTML=groups.map(x=>'<option value="'+safe(x)+'">'+safe(x)+'</option>').join('');
          if(groups.includes(old))g.value=old;
        }
        fillBookPaymentStudents?.();renderBookPaymentRoster?.();
        if(!$('#payDate')?.value && typeof localDateTimeInput==='function')$('#payDate').value=localDateTimeInput();
        return out;
      }catch(e){
        if(cached?.students && isRateOrBadRequest(e)){
          bookPayDashboard=cached;
          renderEditorialFinance?.();fillBookPaymentStudents?.();renderBookPaymentRoster?.();
          return cached;
        }
        throw e;
      }finally{
        payDashboardPromise=null;
      }
    })();
    return payDashboardPromise;
  }

  function receiptStatus(out){
    if(out.status==='paid')return '✅ Libro liquidado';
    if(out.status==='partial')return '🟡 Pago en proceso';
    return '⚪ Pendiente de pago';
  }

  async function showPaymentReceipt(studentId){
    const out=await fetchPaymentStudentOnce(studentId);
    const s=out.student||{};
    const moves=Array.isArray(out.movements)?out.movements:[];
    const paymentMoves=moves.filter(m=>m.movement_type!=='reversal');
    const lines=paymentMoves.map(m=>{
      const rev=!!m.reversed;
      return '<div class="list-row"><b>'+safe(rev?'↩ Pago anulado':('Abono · '+money(m.amount)))+'</b><small>'+
        safe((m.method==='transfer'?'Transferencia':'Efectivo')+' · '+new Date(m.paid_at).toLocaleString('es-MX'))+
        (m.note?' · '+safe(m.note):'')+'</small></div>';
    }).join('');

    showDialog('Comprobante de pago de libro',
      '<div class="card">'+
      '<p class="eyebrow">ESTADO DEL ALUMNO</p>'+
      '<h2>'+safe(s.list_number||'—')+'. '+safe(s.name||'Alumno')+'</h2>'+
      '<p class="hint">Grupo '+safe(s.group_name||'—')+' · ID '+safe(s.id||studentId)+'</p>'+
      '<div class="stats"><div><b>'+money(out.paid||0)+'</b><span>Pagado</span></div><div><b>'+money(out.pending||0)+'</b><span>Restante</span></div></div>'+
      '<p><b>'+safe(receiptStatus(out))+'</b></p>'+
      (out._stale?'<p class="message warn">Se muestra la última copia guardada porque Supabase respondió temporalmente con límite/error. No se modificó ningún dato.</p>':'')+
      '</div>'+
      '<div class="card"><h3>Historial</h3><div class="list">'+(lines||'<div class="empty">Sin movimientos en la copia disponible.</div>')+'</div></div>'+
      '<div class="actions"><button id="bookReceiptPdf" class="primary" type="button">Generar comprobante PDF</button><button id="bookReceiptClose" class="secondary" type="button">Cerrar</button></div>'
    );
    $('#bookReceiptClose')?.addEventListener('click',()=>$('#dialog')?.close());
    $('#bookReceiptPdf')?.addEventListener('click',()=>generatePaymentReceiptPdf(out));
  }

  function generatePaymentReceiptPdf(out){
    const jsPDF=window.jspdf?.jsPDF;
    if(!jsPDF){alert('No se pudo cargar el generador PDF.');return}
    const s=out.student||{},doc=new jsPDF({unit:'mm',format:'letter'});
    doc.setFontSize(16);doc.text('Comprobante de pago de libro',14,18);
    doc.setFontSize(10);doc.text('El Aula del Profe Jaime',14,24);
    doc.line(14,28,202,28);
    doc.setFontSize(12);doc.text(String(s.name||'Alumno'),14,38);
    doc.setFontSize(10);
    doc.text('Grupo: '+String(s.group_name||'—')+'   No. lista: '+String(s.list_number||'—'),14,44);
    doc.text('ID: '+String(s.id||''),14,50);
    doc.text('Pagado: '+money(out.paid||0),14,60);
    doc.text('Restante: '+money(out.pending||0),14,66);
    doc.text('Estado: '+receiptStatus(out).replace(/[✅🟡⚪]/g,'').trim(),14,72);
    let y=84;doc.setFontSize(11);doc.text('Movimientos',14,y);y+=6;doc.setFontSize(9);
    const moves=(out.movements||[]).filter(m=>m.movement_type!=='reversal');
    if(!moves.length){doc.text('Sin movimientos disponibles en esta copia.',14,y)}
    else for(const m of moves){
      const txt=(m.reversed?'ANULADO · ':'')+money(m.amount)+' · '+(m.method==='transfer'?'Transferencia':'Efectivo')+' · '+new Date(m.paid_at).toLocaleString('es-MX');
      const parts=doc.splitTextToSize(txt,185);doc.text(parts,14,y);y+=parts.length*5;
      if(y>250){doc.addPage();y=18}
    }
    doc.setFontSize(8);doc.text('Documento informativo generado por la App Docente.',14,268);
    doc.save('Comprobante_libro_'+String(s.id||'alumno')+'.pdf');
  }

  // Reemplaza únicamente la carga visual de pagos; no toca registros.
  loadBookPayments=stableLoadBookPayments;

  // Clic en Estado por alumno = comprobante/consulta. No registra ni modifica nada.
  selectBookPaymentStudent=async function(id){
    if(!id)return;
    if($('#payStudent'))$('#payStudent').value=String(id);
    if($('#payScan'))$('#payScan').value=String(id);
    try{
      const out=paymentCachedStudent(id)||paymentRowFromDashboard(id);
      if(out){
        try{offlineRpcSet?.('teacher_book_payment_student',{p_student_id:String(id)},out)}catch(_){}
      }
      await showPaymentReceipt(id);
    }catch(e){alert('No se pudo abrir el detalle: '+(e?.message||e))}
  };

  // El selector de Alumno ahora consulta el comprobante. Para COBRAR se mantiene Buscar/escáner.
  window.addEventListener('load',()=>{
    const sel=$('#payStudent');
    if(sel){
      sel.addEventListener('change',e=>{
        const id=e.target.value;if(!id)return;
        e.stopImmediatePropagation();
        showPaymentReceipt(id).catch(err=>alert('No se pudo abrir el detalle: '+(err?.message||err)));
      },true);
    }
    $('#payRefresh')?.addEventListener('click',e=>{e.stopImmediatePropagation();stableLoadBookPayments({force:true}).catch(err=>alert('No se pudo actualizar: '+(err?.message||err)))},true);
  });

  // Sincronización offline: pocos elementos por ronda y se detiene ante el primer error.
  try{
    flushOfflineRpcQueue=async function(){
      if(!cloudOnline||!navigator.onLine||!_originalRpc)return;
      const q=offlineQueueGet();if(!q.length){updateConnectivityUi();return}
      const remain=[...q];
      let processed=0;
      while(remain.length&&processed<3){
        const item=remain[0];
        try{
          await _originalRpc(item.name,item.args||{});
          remain.shift();processed++;
          offlineQueueSet(remain);updateConnectivityUi();
          await new Promise(r=>setTimeout(r,500));
        }catch(e){
          // Nunca borrar un pendiente que falló.
          offlineQueueSet(remain);
          if(typeof connectivityError==='function'&&connectivityError(e)){try{cloudOnline=false}catch(_){}}
          updateConnectivityUi();
          break;
        }
      }
      if(!remain.length&&q.some(x=>x.name==='teacher_book_payment_record'||x.name==='teacher_book_payment_void')){
        try{
          const fresh=await _originalRpc('teacher_book_payment_dashboard',{});
          if(fresh?.ok){offlineRpcSet('teacher_book_payment_dashboard',{},fresh);bookPayDashboard=fresh}
        }catch(_){}
      }
    };
  }catch(e){console.warn('Cola offline segura de pagos',e)}
})();