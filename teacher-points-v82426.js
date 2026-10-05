// App Docente v8.24.26 · puntos por grupo y apertura de donaciones
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
    const matching=periods.filter(p=>groupKey(p.group_name)===groupKey(q('ptGroup').value)&&p.shift===q('ptShift').value);
    const labels={open:'Abierta',scheduled:'Programada',closed:'Cerrada'};
    q('ptPeriods').innerHTML=matching.map(p=>'<div style="padding:10px"><b>'+esc(p.month)+' · '+esc(p.cycle)+' · '+esc(labels[p.state]||p.state)+'</b><p>'+esc(new Date(p.opens_at).toLocaleString('es-MX'))+' → '+esc(new Date(p.closes_at).toLocaleString('es-MX'))+'</p></div>').join('');
  }
  async function loadGroup(){
    const token=++generation;
    roster=[];methodologies=[];periods=[];q('ptMethodology').innerHTML='<option value="">Selecciona una metodología</option>';q('ptEnable').disabled=true;q('ptPeriods').innerHTML='';q('ptPeriodForm').classList.toggle('hidden',q('ptShift').value!=='Matutino');renderRoster();q('ptStatus').textContent='Cargando saldo de puntos…';
    const shift=q('ptShift').value, group=q('ptGroup').value;
    try{
      if(!group){q('ptStatus').textContent='Selecciona un grupo.';return;}
      const result=await Promise.all([
        rpc('teacher_group_points',{p_shift:shift,p_group:group}),
        window.ProfeSupabase.select('methodologies','select=id,shift,group_name,month,cycle,closed,data'),
        rpc('teacher_point_periods')
      ]);
      if(token!==generation)return;
      roster=(result[0]||[]).filter(s=>s.student_id!=='00001');
      methodologies=(result[1]||[]).filter(m=>!m.closed&&m.shift==='Matutino'&&shift==='Matutino'&&groupKey(m.group_name)===groupKey(group));
      periods=result[2]||[];
      q('ptMethodology').innerHTML='<option value="">Selecciona una metodología</option>'+methodologies.map(m=>'<option value="'+esc(m.id)+'">'+esc(m.data?.name||m.month)+' · '+esc(m.month)+' · '+esc(m.cycle)+'</option>').join('');
      currentMethodology();renderPeriods();renderRoster();q('ptStatus').textContent='Saldos actualizados.';
      q('ptPeriodForm').classList.toggle('hidden',shift!=='Matutino');
    }catch(e){if(token===generation)q('ptStatus').textContent='No se pudo cargar: '+e.message;}
  }
  async function loadGroups(){
    const token=++generation;
    try{
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
      await loadGroup();
    }catch(err){q('ptPeriodStatus').textContent='No se pudo habilitar: '+err.message;}
    finally{lock(false);}
  }
  function init(){
    q('ptShift').addEventListener('change',loadGroups);q('ptGroup').addEventListener('change',loadGroup);q('ptRefresh').addEventListener('click',loadGroups);
    q('ptMode').addEventListener('change',renderRoster);q('ptRoster').addEventListener('change',updateCount);
    q('ptMethodology').addEventListener('change',currentMethodology);q('ptAwardForm').addEventListener('submit',award);q('ptPeriodForm').addEventListener('submit',enable);
    document.querySelector('[data-mettab="points"]').addEventListener('click',()=>{pane('met','points');loadGroups();});
  }
  if(document.readyState==='complete')init();else window.addEventListener('load',init,{once:true});
})();
