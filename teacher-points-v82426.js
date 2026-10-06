// App Docente v8.24.27 · puntos por grupo y apertura de donaciones
(() => {
  const q=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const groupKey=v=>String(v??'').trim().toLowerCase().replace(/[^a-z0-9]/g,'');
  let roster=[], methodologies=[], periods=[], generation=0, busy=false, pending=null;
  const rpc=async(name,args={})=>{
    if(!window.ProfeSupabase)throw Error('Abre la app con internet e inicia sesión docente.');
    const out=await window.ProfeSupabase.rpc(name,args);
    if(out?.ok===false)throw Error(out.error||out.reason||'El servidor no confirmó la operación.');
    return out;
  };
  const localDate=v=>{const d=new Date(v);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16)};
  const recipients=()=>q('ptMode').value==='all'?roster.map(s=>s.student_id):[...q('ptRoster').querySelectorAll('input:checked')].map(i=>i.value);
  function updateCount(){const n=recipients().length;q('ptCount').textContent=n+' alumno'+(n===1?'':'s')+' recibirá'+(n===1?'':'n')+' la misma cantidad de puntos.';q('ptAward').disabled=busy||!n;}
  function renderRoster(){
    const selected=q('ptMode').value==='selected';
    q('ptRoster').innerHTML=roster.length?roster.map(s=>'<label style="display:flex;gap:10px;align-items:center;padding:9px;flex-wrap:wrap">'+(selected?'<input type="checkbox" value="'+esc(s.student_id)+'">':'')+'<span>'+esc(s.list_number??'')+' · '+esc(s.student_name)+' <small>('+esc(s.student_id)+')</small></span><b>Saldo: '+Number(s.balance||0).toFixed(2)+'</b></label>').join(''):'<p class="hint">No hay alumnos activos en este grupo.</p>';
    updateCount();
  }
  function currentMethodology(){
    const m=methodologies.find(m=>m.id===q('ptMethodology').value);
    const p=periods.find(p=>p.methodology_id===m?.id);
    q('ptOpen').value=p?localDate(p.opens_at):'';
    q('ptClose').value=p?localDate(p.closes_at):'';
    q('ptEnable').disabled=busy||!m;
  }
  function renderPeriods(){
    const labels={open:'Abierta',scheduled:'Programada',closed:'Cerrada'};
    q('ptPeriods').innerHTML=periods.length?periods.map(p=>'<div style="padding:14px;border-bottom:1px solid #ddd"><b>Grupo '+esc(p.group_name)+' · '+esc(p.shift)+' · '+esc(p.month)+' · '+esc(p.cycle)+'</b><p><b>'+esc(labels[p.state]||p.state)+'</b><br>Apertura: '+esc(new Date(p.opens_at).toLocaleString('es-MX'))+'<br>Cierre: '+esc(new Date(p.closes_at).toLocaleString('es-MX'))+'</p>'+(p.closed_at?'<small>Cerrado definitivamente.</small>':'<button type="button" class="secondary" data-pt-edit="'+esc(p.id)+'">Editar horario</button>')+'</div>').join(''):'<p class="hint">Todavía no hay periodos de puntos guardados.</p>';
  }
  async function refreshPeriods(){
    periods=await rpc('teacher_point_periods')||[];renderPeriods();
  }
  function editPeriod(id){
    if(busy)return;
    const p=periods.find(p=>p.id===id);if(!p)return;
    showDialog('Editar horario · Grupo '+p.group_name,'<p><b>'+esc(p.shift)+' · '+esc(p.month)+' · '+esc(p.cycle)+'</b></p><p class="hint">Se conserva el mismo periodo, sus puntos y donaciones. Horarios en la hora local de tu dispositivo.</p><label>Apertura<input id="ptEditOpen" type="datetime-local" value="'+localDate(p.opens_at)+'"></label><label>Cierre<input id="ptEditClose" type="datetime-local" value="'+localDate(p.closes_at)+'"></label><div class="actions"><button type="button" id="ptEditSave" class="primary">Guardar horario</button><button type="button" id="ptEditCancel" class="secondary">Cancelar</button></div><p id="ptEditStatus" role="status" aria-live="polite"></p>');
    q('ptEditCancel').onclick=()=>q('dialog').close();
    q('ptEditSave').onclick=async()=>{
      if(busy)return;
      const open=new Date(q('ptEditOpen').value),close=new Date(q('ptEditClose').value);
      if(!Number.isFinite(open.getTime())||!Number.isFinite(close.getTime())||close<=open){q('ptEditStatus').textContent='El cierre debe ser posterior a la apertura.';return;}
      if(!confirm('Cambiar únicamente el horario del grupo '+p.group_name+' a '+open.toLocaleString('es-MX')+' → '+close.toLocaleString('es-MX')+' ¿Continuar?'))return;
      busy=true;q('ptEditSave').disabled=true;q('ptEditCancel').disabled=true;
      try{
        await rpc('teacher_edit_point_period_schedule',{p_period_id:p.id,p_opens_at:open.toISOString(),p_closes_at:close.toISOString()});
        q('dialog').close();q('ptPeriodStatus').textContent='✓ Horario actualizado del grupo '+p.group_name+'. Se conservaron sus registros.';
        await refreshPeriods();currentMethodology();
      }catch(e){if(q('dialog').open)q('ptEditStatus').textContent='No se pudo actualizar: '+e.message;else q('ptPeriodStatus').textContent='Horario guardado; no se pudo refrescar la lista: '+e.message;}
      finally{busy=false;if(q('ptEditSave'))q('ptEditSave').disabled=false;if(q('ptEditCancel'))q('ptEditCancel').disabled=false;}
    };
  }
  async function loadGroup(){
    const token=++generation;
    roster=[];methodologies=[];q('ptMethodology').innerHTML='<option value="">Selecciona una metodología</option>';q('ptEnable').disabled=true;q('ptPeriodForm').classList.toggle('hidden',q('ptShift').value!=='Matutino');renderRoster();q('ptStatus').textContent='Cargando saldo de puntos…';
    const shift=q('ptShift').value, group=q('ptGroup').value;
    try{
      if(!group){q('ptStatus').textContent='Selecciona un grupo.';return;}
      const result=await Promise.all([
        rpc('teacher_group_points',{p_shift:shift,p_group:group}),
        window.ProfeSupabase.select('methodologies','select=id,shift,group_name,month,cycle,closed,data')
      ]);
      if(token!==generation)return;
      roster=(result[0]||[]).filter(s=>s.student_id!=='00001');
      methodologies=(result[1]||[]).filter(m=>!m.closed&&m.shift==='Matutino'&&shift==='Matutino'&&groupKey(m.group_name)===groupKey(group));
      q('ptMethodology').innerHTML='<option value="">Selecciona una metodología</option>'+methodologies.map(m=>'<option value="'+esc(m.id)+'">'+esc(m.data?.name||m.month)+' · '+esc(m.month)+' · '+esc(m.cycle)+'</option>').join('');
      currentMethodology();renderPeriods();renderRoster();q('ptStatus').textContent='Saldos actualizados.';
      q('ptPeriodForm').classList.toggle('hidden',shift!=='Matutino');
    }catch(e){if(token===generation)q('ptStatus').textContent='No se pudo cargar: '+e.message;}
  }
  async function loadGroups(){
    const token=++generation;
    try{
      await refreshPeriods();
      const data=await students();if(token!==generation)return;
      const groups=[...new Set(data.filter(s=>s.shift===q('ptShift').value).map(s=>s.group||s.group_name).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'es',{numeric:true}));
      const prior=q('ptGroup').value;
      q('ptGroup').innerHTML=groups.map(g=>'<option>'+esc(g)+'</option>').join('');
      if(groups.includes(prior))q('ptGroup').value=prior;
      await loadGroup();
    }catch(e){q('ptStatus').textContent='No se pudieron cargar los grupos: '+e.message;}
  }
  function lock(value){busy=value;for(const el of q('met-points').querySelectorAll('input,select,button'))el.disabled=value;if(!value){updateCount();q('ptEnable').disabled=!q('ptMethodology').value;}}
  async function award(e){
    e.preventDefault();if(busy)return;
    const ids=recipients(), amount=Number(q('ptAmount').value),reason=q('ptReason').value.trim();
    if(!ids.length||!Number.isFinite(amount)||amount<0.01||!reason){q('ptAwardStatus').textContent='Selecciona alumnos, puntos y motivo.';return;}
    const payload={p_shift:q('ptShift').value,p_group:q('ptGroup').value,p_student_ids:ids,p_amount:amount,p_reason:reason};
    const fingerprint=JSON.stringify(payload);
    if(!confirm('Asignar '+amount.toFixed(2)+' puntos a cada uno de los '+ids.length+' alumnos del grupo '+payload.p_group+' ('+payload.p_shift+'). Motivo: '+reason+' ¿Continuar?'))return;
    if(!pending||pending.fingerprint!==fingerprint)pending={fingerprint,id:crypto.randomUUID()};
    lock(true);q('ptAwardStatus').textContent='Guardando puntos…';
    try{
      const out=await rpc('teacher_award_points_batch',{...payload,p_request_id:pending.id});
      if(!out?.ok)throw Error('El servidor no confirmó los puntos.');
      pending=null;q('ptAmount').value='';q('ptReason').value='';
      q('ptAwardStatus').textContent='✓ '+Number(out.amount_each).toFixed(2)+' puntos asignados a '+out.count+' alumnos.';
      await loadGroup();
    }catch(err){q('ptAwardStatus').textContent='No se pudo confirmar la asignación: '+err.message+'. Puedes reintentar sin duplicar esta solicitud.';}
    finally{lock(false);}
  }
  async function enable(e){
    e.preventDefault();if(busy)return;
    const id=q('ptMethodology').value, open=new Date(q('ptOpen').value),close=new Date(q('ptClose').value);
    if(!id||!Number.isFinite(open.getTime())||!Number.isFinite(close.getTime())||close<=open||close<=new Date()){q('ptPeriodStatus').textContent='Selecciona el mes y un cierre futuro posterior a la apertura.';return;}
    if(!confirm('Habilitar puntos y donaciones del grupo '+q('ptGroup').value+' desde '+open.toLocaleString('es-MX')+' hasta '+close.toLocaleString('es-MX')+' ¿Continuar?'))return;
    lock(true);q('ptPeriodStatus').textContent='Guardando dinámica…';
    try{
      const m=await window.ProfeSupabase.select('methodologies','select=id,closed&id=eq.'+encodeURIComponent(id));
      if(!m?.length||m[0].closed)throw Error('La metodología mensual ya está cerrada.');
      await rpc('teacher_save_point_period',{p_methodology_id:id,p_opens_at:open.toISOString(),p_closes_at:close.toISOString()});
      q('ptPeriodStatus').textContent='✓ Dinámica guardada. Los alumnos podrán usar o donar dentro del plazo indicado.';
      await refreshPeriods();await loadGroup();
    }catch(err){q('ptPeriodStatus').textContent='No se pudo habilitar: '+err.message;}
    finally{lock(false);}
  }
  function init(){
    q('ptPeriods').addEventListener('click',e=>{const b=e.target.closest('[data-pt-edit]');if(b)editPeriod(b.dataset.ptEdit);});
    q('ptShift').addEventListener('change',loadGroups);q('ptGroup').addEventListener('change',loadGroup);q('ptRefresh').addEventListener('click',loadGroups);
    q('ptMode').addEventListener('change',renderRoster);q('ptRoster').addEventListener('change',updateCount);
    q('ptMethodology').addEventListener('change',currentMethodology);q('ptAwardForm').addEventListener('submit',award);q('ptPeriodForm').addEventListener('submit',enable);
    document.querySelector('[data-mettab="points"]').addEventListener('click',()=>{pane('met','points');loadGroups();});
  }
  if(document.readyState==='complete')init();else window.addEventListener('load',init,{once:true});
})();
