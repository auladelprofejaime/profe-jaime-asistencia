// App Docente v8.23.50 · grupos de pagos + recibo PNG compartible
(function(){
  function currentPaymentDashboard(){
    try{
      return (typeof bookPayDashboard!=='undefined'&&bookPayDashboard?.students?bookPayDashboard:null)
        || (typeof offlineRpcGet==='function'?offlineRpcGet('teacher_book_payment_dashboard',{}):null)
        || null;
    }catch(_){return null}
  }

  function rebuildPayGroupSelector(preferred){
    const dash=currentPaymentDashboard();
    const g=document.querySelector('#payGroup');
    if(!g||!dash?.students)return false;

    const groups=[...new Set(
      (dash.students||[])
        .map(r=>String(r.group_name??r.group??'').trim())
        .filter(Boolean)
    )].sort((a,b)=>a.localeCompare(b,'es',{numeric:true,sensitivity:'base'}));

    const previous=String(preferred??g.value??'');
    if(!groups.length){
      g.innerHTML='<option value="">Sin grupos disponibles</option>';
      if(document.querySelector('#payStudent'))document.querySelector('#payStudent').innerHTML='<option value="">Sin alumnos disponibles</option>';
      return false;
    }

    g.innerHTML=groups.map(x=>'<option value="'+safe(x)+'">'+safe(x)+'</option>').join('');
    g.value=groups.includes(previous)?previous:groups[0];

    try{fillBookPaymentStudents?.()}catch(_){}
    try{renderBookPaymentRoster?.()}catch(_){}
    return true;
  }

  // Garantiza que todos los caminos de carga (nube, caché o carga reciente)
  // reconstruyan también el selector de grupos.
  try{
    const baseLoadBookPayments=loadBookPayments;
    loadBookPayments=async function(...args){
      const before=document.querySelector('#payGroup')?.value||'';
      const out=await baseLoadBookPayments(...args);
      rebuildPayGroupSelector(before);
      return out;
    };
  }catch(e){console.warn('No se pudo reforzar selector de grupos',e)}

  function cachedPaymentStudent(id){
    id=String(id||'');
    try{
      const cached=typeof offlineRpcGet==='function'?offlineRpcGet('teacher_book_payment_student',{p_student_id:id}):null;
      if(cached?.student)return cached;
    }catch(_){}
    const dash=currentPaymentDashboard();
    const r=(dash?.students||[]).find(x=>String(x.id)===id);
    if(!r)return null;
    const paid=Number(r.paid||0);
    return {
      ok:true,
      student:{id:String(r.id),name:r.name||r.student_name||'Alumno',group_name:r.group_name||'',list_number:r.list_number||''},
      paid,
      pending:Number(r.pending??Math.max(0,280-paid)),
      status:r.status||(paid>=280?'paid':paid>0?'partial':'none'),
      movements:[]
    };
  }

  async function getPaymentStudentForReceipt(id){
    id=String(id||'').trim();
    if(!id)throw new Error('No se identificó al alumno.');
    const cached=cachedPaymentStudent(id);
    if(!navigator.onLine||!window.ProfeSupabase)return cached||Promise.reject(new Error('Sin copia disponible del alumno.'));
    try{
      let fn=null;
      try{fn=(typeof _originalRpc==='function')?_originalRpc:null}catch(_){}
      fn=fn||window.ProfeSupabase.rpc.bind(window.ProfeSupabase);
      const out=await fn('teacher_book_payment_student',{p_student_id:id});
      if(!out?.ok)throw new Error(out?.reason||'No se pudo consultar el pago.');
      try{offlineRpcSet?.('teacher_book_payment_student',{p_student_id:id},out)}catch(_){}
      return out;
    }catch(e){
      if(cached)return {...cached,_stale:true};
      throw e;
    }
  }

  function paymentReceiptState(out){
    const paid=Number(out?.paid||0);
    if(paid>=280||out?.status==='paid')return {label:'LIBRO LIQUIDADO',short:'Libro liquidado'};
    if(paid>0||out?.status==='partial')return {label:'PAGO EN PROCESO',short:'Pago en proceso'};
    return {label:'PENDIENTE DE PAGO',short:'Pendiente de pago'};
  }

  function latestValidPayment(out){
    const rows=(out?.movements||[])
      .filter(m=>m.movement_type!=='reversal'&&!m.reversed)
      .sort((a,b)=>new Date(b.paid_at||b.created_at||0)-new Date(a.paid_at||a.created_at||0));
    return rows[0]||null;
  }

  function wrapCanvasText(ctx,text,x,y,maxWidth,lineHeight,maxLines=3){
    const words=String(text||'').split(/\s+/);let line='',lines=[];
    for(const word of words){
      const test=line?line+' '+word:word;
      if(ctx.measureText(test).width>maxWidth&&line){lines.push(line);line=word}
      else line=test;
    }
    if(line)lines.push(line);
    lines=lines.slice(0,maxLines);
    lines.forEach((ln,i)=>ctx.fillText(ln,x,y+i*lineHeight));
    return y+lines.length*lineHeight;
  }

  function buildReceiptCanvas(out){
    const s=out.student||{};
    const state=paymentReceiptState(out);
    const last=latestValidPayment(out);
    const canvas=document.createElement('canvas');
    canvas.width=1080;canvas.height=1350;
    const ctx=canvas.getContext('2d');

    // Fondo
    ctx.fillStyle='#f6f7fb';ctx.fillRect(0,0,1080,1350);
    ctx.fillStyle='#ffffff';
    ctx.beginPath();ctx.roundRect(70,70,940,1210,36);ctx.fill();

    ctx.textAlign='left';
    ctx.fillStyle='#1f2937';ctx.font='700 54px system-ui,-apple-system,sans-serif';
    ctx.fillText('Comprobante de pago de libro',120,165);
    ctx.fillStyle='#667085';ctx.font='400 30px system-ui,-apple-system,sans-serif';
    ctx.fillText('El Aula del Profe Jaime',120,215);

    // Estado
    ctx.fillStyle=state.label==='LIBRO LIQUIDADO'?'#ecfdf3':state.label==='PAGO EN PROCESO'?'#fffaeb':'#f2f4f7';
    ctx.beginPath();ctx.roundRect(120,270,840,118,28);ctx.fill();
    ctx.fillStyle=state.label==='LIBRO LIQUIDADO'?'#067647':state.label==='PAGO EN PROCESO'?'#b54708':'#475467';
    ctx.font='800 38px system-ui,-apple-system,sans-serif';ctx.textAlign='center';
    ctx.fillText(state.label,540,344);

    ctx.textAlign='left';
    ctx.fillStyle='#344054';ctx.font='600 28px system-ui,-apple-system,sans-serif';
    ctx.fillText('Alumno',120,455);
    ctx.fillStyle='#101828';ctx.font='700 39px system-ui,-apple-system,sans-serif';
    let y=wrapCanvasText(ctx,String(s.name||'Alumno'),120,505,820,46,2);

    ctx.fillStyle='#667085';ctx.font='400 27px system-ui,-apple-system,sans-serif';
    ctx.fillText('Grupo '+String(s.group_name||'—')+'  ·  No. de lista '+String(s.list_number||'—'),120,y+25);
    ctx.fillText('ID '+String(s.id||''),120,y+65);

    y+=135;
    ctx.fillStyle='#f9fafb';ctx.beginPath();ctx.roundRect(120,y,840,220,26);ctx.fill();
    ctx.fillStyle='#667085';ctx.font='500 27px system-ui,-apple-system,sans-serif';
    ctx.fillText('Acumulado pagado',165,y+55);
    ctx.fillText('Restante',610,y+55);
    ctx.fillStyle='#101828';ctx.font='800 52px system-ui,-apple-system,sans-serif';
    ctx.fillText(money(out.paid||0),165,y+125);
    ctx.fillText(money(out.pending||0),610,y+125);
    ctx.fillStyle='#98a2b3';ctx.font='400 24px system-ui,-apple-system,sans-serif';
    ctx.fillText('Total del libro: $280',165,y+178);

    y+=280;
    ctx.fillStyle='#344054';ctx.font='600 28px system-ui,-apple-system,sans-serif';
    ctx.fillText('Último pago registrado',120,y);
    ctx.fillStyle='#101828';ctx.font='700 34px system-ui,-apple-system,sans-serif';
    if(last){
      ctx.fillText(money(last.amount||0)+' · '+(last.method==='transfer'?'Transferencia':'Efectivo'),120,y+52);
      ctx.fillStyle='#667085';ctx.font='400 25px system-ui,-apple-system,sans-serif';
      ctx.fillText(new Date(last.paid_at||last.created_at).toLocaleString('es-MX',{dateStyle:'medium',timeStyle:'short'}),120,y+94);
    }else{
      ctx.fillStyle='#667085';ctx.font='400 27px system-ui,-apple-system,sans-serif';
      ctx.fillText('El acumulado mostrado corresponde al registro disponible.',120,y+52);
    }

    ctx.strokeStyle='#e4e7ec';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(120,1165);ctx.lineTo(960,1165);ctx.stroke();
    ctx.fillStyle='#667085';ctx.font='400 23px system-ui,-apple-system,sans-serif';ctx.textAlign='center';
    ctx.fillText('Registro informativo generado desde App Docente',540,1215);
    ctx.fillText(new Date().toLocaleString('es-MX',{dateStyle:'long',timeStyle:'short'}),540,1255);

    return canvas;
  }

  async function receiptBlob(out){
    const canvas=buildReceiptCanvas(out);
    return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('No se pudo crear la imagen.')),'image/png',0.96));
  }

  async function shareReceiptImage(out){
    const blob=await receiptBlob(out);
    const s=out.student||{};
    const file=new File([blob],'Comprobante_libro_'+String(s.id||'alumno')+'.png',{type:'image/png'});
    if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){
      await navigator.share({
        title:'Comprobante de pago de libro',
        text:'Le comparto el estado registrado del pago del libro.',
        files:[file]
      });
      return;
    }
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=file.name;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
    alert('La imagen quedó generada para que puedas compartirla.');
  }

  async function openShareableReceipt(studentId){
    const out=await getPaymentStudentForReceipt(studentId);
    const s=out.student||{},state=paymentReceiptState(out),last=latestValidPayment(out);
    showDialog('Comprobante de pago de libro',
      '<div class="card" style="text-align:center">'+
        '<p class="eyebrow">COMPROBANTE PARA FAMILIA</p>'+
        '<h2 style="margin:.3rem 0">'+safe(s.name||'Alumno')+'</h2>'+
        '<p class="hint">Grupo '+safe(s.group_name||'—')+' · No. '+safe(s.list_number||'—')+' · ID '+safe(s.id||studentId)+'</p>'+
        '<div style="margin:14px auto;padding:14px;border-radius:14px;background:#f5f7fa"><b style="font-size:1.25rem">'+safe(state.short)+'</b></div>'+
        '<div class="stats"><div><b>'+money(out.paid||0)+'</b><span>Acumulado pagado</span></div><div><b>'+money(out.pending||0)+'</b><span>Restante</span></div></div>'+
        '<p class="hint">Total del libro: <b>$280</b></p>'+
        (last?'<p class="hint">Último pago: <b>'+money(last.amount||0)+'</b> · '+safe(last.method==='transfer'?'Transferencia':'Efectivo')+' · '+safe(new Date(last.paid_at||last.created_at).toLocaleString('es-MX'))+'</p>':'')+
        (out._stale?'<p class="message warn">Se está usando la última copia guardada. No se modificó ningún pago.</p>':'')+
      '</div>'+
      '<div class="actions">'+
        '<button id="bookReceiptShareImage" class="primary" type="button">📤 Compartir imagen</button>'+
        '<button id="bookReceiptPreviewImage" class="secondary" type="button">🖼️ Ver imagen</button>'+
        '<button id="bookReceiptClose2" class="secondary" type="button">Cerrar</button>'+
      '</div>'
    );

    document.querySelector('#bookReceiptClose2')?.addEventListener('click',()=>document.querySelector('#dialog')?.close());
    document.querySelector('#bookReceiptShareImage')?.addEventListener('click',async()=>{
      const b=document.querySelector('#bookReceiptShareImage'),old=b?.textContent;
      try{if(b){b.disabled=true;b.textContent='Generando…'}await shareReceiptImage(out)}
      catch(e){if(e?.name!=='AbortError')alert('No se pudo compartir la imagen: '+(e?.message||e))}
      finally{if(b){b.disabled=false;b.textContent=old||'📤 Compartir imagen'}}
    });
    document.querySelector('#bookReceiptPreviewImage')?.addEventListener('click',()=>{
      const canvas=buildReceiptCanvas(out);
      const url=canvas.toDataURL('image/png');
      showDialog('Vista previa del comprobante','<div style="text-align:center"><img src="'+url+'" alt="Comprobante de pago" style="width:100%;max-width:520px;border-radius:16px"></div><div class="actions"><button id="bookReceiptBack" class="secondary" type="button">Cerrar</button></div>');
      document.querySelector('#bookReceiptBack')?.addEventListener('click',()=>document.querySelector('#dialog')?.close());
    });
  }

  // Tocar un alumno del listado abre el comprobante compartible.
  selectBookPaymentStudent=async function(id){
    if(!id)return;
    const dash=currentPaymentDashboard();
    const row=(dash?.students||[]).find(x=>String(x.id)===String(id));
    if(row){
      const g=document.querySelector('#payGroup');
      if(g&&String(g.value)!==String(row.group_name)){rebuildPayGroupSelector(String(row.group_name))}
      const sel=document.querySelector('#payStudent');if(sel)sel.value=String(id);
      const scan=document.querySelector('#payScan');if(scan)scan.value=String(id);
    }
    try{await openShareableReceipt(id)}
    catch(e){alert('No se pudo abrir el comprobante: '+(e?.message||e))}
  };

  window.addEventListener('load',()=>{
    setTimeout(()=>rebuildPayGroupSelector(document.querySelector('#payGroup')?.value||''),500);
    const g=document.querySelector('#payGroup');
    if(g){
      g.addEventListener('change',()=>{
        try{fillBookPaymentStudents?.();renderBookPaymentRoster?.()}catch(_){}
        const card=document.querySelector('#payStudentCard');
        if(card)card.innerHTML='<div class="empty">Selecciona o escanea un alumno.</div>';
      });
    }
  });
})();