/* App Docente v8.23.27 · Periodos + matriz mensual de bitácoras */
(function(){
  const $=s=>document.querySelector(s);
  const $$=s=>[...document.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let retryTimer=null;

  function restoreSession(){
    try{window.ProfeSupabase?.restore?.()}catch(_){}
  }
  async function rpc(name,args={}){
    restoreSession();
    if(!window.ProfeSupabase)throw new Error('Supabase no está disponible.');
    return await window.ProfeSupabase.rpc(name,args);
  }
  function deduction(n){
    n=Number(n);
    if(!Number.isFinite(n)||n<=2)return 0;
    if(n<=4)return -2;
    if(n<=6)return -5;
    if(n<=9)return -8;
    return -10;
  }
  function currentMonthlyId(){return $('#meritMonthlyPeriod')?.value||''}
  function bitacoraId(){return $('#meritBitacoraPeriod')?.value||currentMonthlyId()}

  function fillSelect(el,rows){
    if(!el)return;
    const old=el.value;
    el.innerHTML=rows.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.label)+' · '+esc(p.status)+'</option>').join('');
    if(rows.some(p=>String(p.id)===String(old)))el.value=old;
  }

  function renderPeriodList(rows){
    const box=$('#meritPeriodsList'); if(!box)return;
    if(!rows.length){box.innerHTML='<p class="hint">Aún no hay periodos.</p>';return;}
    box.innerHTML='<table><thead><tr><th>Periodo</th><th>Fechas</th><th>Estado</th><th>Portal</th><th>Acciones</th></tr></thead><tbody>'+
      rows.map(p=>{
        const canDelete=!(p.status==='closed'||p.status==='published');
        return '<tr><td><b>'+esc(p.label)+'</b><br><small>'+esc(p.school_year||'')+'</small></td>'+
          '<td>'+esc(p.starts_at)+' → '+esc(p.ends_at)+'</td><td>'+esc(p.status)+'</td><td>'+esc(p.public_state)+'</td>'+
          '<td><button type="button" class="secondary meritEditPeriodBtn27" data-id="'+esc(p.id)+'">Editar</button> '+
          (canDelete?'<button type="button" class="secondary meritDeletePeriodBtn27" data-id="'+esc(p.id)+'" data-label="'+esc(p.label)+'">Eliminar periodo</button>':'')+'</td></tr>';
      }).join('')+'</tbody></table>';
    $$('.meritEditPeriodBtn27').forEach(b=>b.onclick=()=>{
      if(typeof window.meritOpenPeriodEditV8151==='function')window.meritOpenPeriodEditV8151(b.dataset.id);
      else if(typeof window.openMeritPeriodEdit==='function')window.openMeritPeriodEdit(b.dataset.id);
    });
    $$('.meritDeletePeriodBtn27').forEach(b=>b.onclick=()=>{
      if(typeof window.deleteMeritPeriodV8164==='function')window.deleteMeritPeriodV8164(b.dataset.id,b.dataset.label);
    });
  }

  async function loadPeriods(showError=true){
    const configStatus=$('#meritConfigStatus');
    try{
      restoreSession();
      const rowsRaw=await rpc('teacher_merit_periods',{});
      const rows=Array.isArray(rowsRaw)?rowsRaw:(Array.isArray(rowsRaw?.periods)?rowsRaw.periods:[]);
      window.meritPeriodsCache=rows;
      ['meritRankingPeriod','meritMovementPeriod','meritWeeklyPeriod','meritMonthlyPeriod','meritBitacoraPeriod'].forEach(id=>fillSelect($('#'+id),rows));
      renderPeriodList(rows);
      if(configStatus && rows.length)configStatus.textContent='✓ '+rows.length+' periodo'+(rows.length===1?'':'s')+' disponible'+(rows.length===1?'':'s')+'.';
      if($('#meritBitacoras')?.classList.contains('active'))setTimeout(loadBitacoraMatrix,40);
      return rows;
    }catch(e){
      const msg=String(e?.message||e||'');
      if(configStatus && showError)configStatus.textContent='No se pudieron cargar los periodos: '+msg;
      const box=$('#meritPeriodsList');
      if(box)box.innerHTML='<p class="message">No se pudieron cargar los periodos. '+esc(msg)+'</p>';
      clearTimeout(retryTimer);
      retryTimer=setTimeout(()=>loadPeriods(false).catch(()=>{}),1400);
      throw e;
    }
  }

  function ensureBitacoraPane(){
    let nav=$('.meritNav[data-merit-pane="bitacoras"]');
    const navBox=$('#merit .merit-nav');
    if(!nav && navBox){
      nav=document.createElement('button');
      nav.type='button';nav.className='secondary meritNav';nav.dataset.meritPane='bitacoras';nav.textContent='📋 Bitácoras';
      const monthly=$('.meritNav[data-merit-pane="monthly"]');
      navBox.insertBefore(nav,monthly||null);
    }
    let pane=$('#merit-bitacoras');
    if(!pane){
      pane=document.createElement('div');
      pane.id='merit-bitacoras';pane.className='merit-pane card';
      pane.innerHTML=`
        <div class="section"><div><h2>Revisión mensual de bitácoras</h2>
        <p class="hint">Captura únicamente el total de observaciones de cada grupo. El descuento se calcula automáticamente y se aplica al resultado mensual final.</p></div>
        <button id="meritBitacoraRefresh27" class="secondary" type="button">Actualizar</button></div>
        <label>Periodo<select id="meritBitacoraPeriod"></select></label>
        <div style="padding:10px 12px;border-radius:12px;background:#fffaf0;margin:10px 0">
          <b>Escala:</b> 0–2 = 0 · 3–4 = −2 · 5–6 = −5 · 7–9 = −8 · 10 o más = −10
        </div>
        <p id="meritBitacoraSummary27" class="message"></p>
        <div id="meritBitacoraMatrix27" class="tablewrap"></div>
        <div class="actions" style="margin-top:12px"><button id="meritBitacoraSave27" class="primary" type="button">Guardar revisión de las 18 bitácoras</button></div>
        <p id="meritBitacoraStatus27" class="message"></p>`;
      const monthlyPane=$('#merit-monthly');
      if(monthlyPane?.parentNode)monthlyPane.parentNode.insertBefore(pane,monthlyPane);
      else $('#merit')?.appendChild(pane);
    }

    if(nav && !nav.dataset.wired27){
      nav.dataset.wired27='1';
      nav.addEventListener('click',()=>{
        $$('#merit .meritNav').forEach(b=>b.classList.remove('active'));
        $$('#merit .merit-pane').forEach(p=>p.classList.remove('active'));
        nav.classList.add('active');pane.classList.add('active');
        loadPeriods(false).then(loadBitacoraMatrix).catch(()=>loadBitacoraMatrix());
      });
    }
    $$('#merit .meritNav:not([data-merit-pane="bitacoras"])').forEach(b=>{
      if(b.dataset.bitHide27)return;b.dataset.bitHide27='1';
      b.addEventListener('click',()=>pane.classList.remove('active'));
    });
    $('#meritBitacoraRefresh27').onclick=()=>loadBitacoraMatrix();
    $('#meritBitacoraPeriod').onchange=()=>loadBitacoraMatrix();
    $('#meritBitacoraSave27').onclick=()=>saveBitacoraMatrix();
    return pane;
  }

  function refreshBitRow(row){
    const input=row.querySelector('.bitObs27');
    const dcell=row.querySelector('.bitDed27');
    const fcell=row.querySelector('.bitFinal27');
    const base=Number(row.dataset.base||0),raw=input.value.trim();
    if(raw===''){dcell.textContent='—';fcell.textContent='—';return;}
    const n=Math.max(0,parseInt(raw,10)||0),d=deduction(n);
    dcell.textContent=d===0?'0':String(d);fcell.textContent=String(base+d);
  }

  async function loadBitacoraMatrix(){
    ensureBitacoraPane();
    const id=bitacoraId(),box=$('#meritBitacoraMatrix27'),sum=$('#meritBitacoraSummary27'),st=$('#meritBitacoraStatus27');
    if(!box)return;
    if(!id){
      box.innerHTML='<p class="hint">Selecciona un periodo.</p>';
      if(st)st.textContent='Los periodos se están cargando…';
      try{await loadPeriods(false)}catch(_){}
      return;
    }
    if(st)st.textContent='Cargando revisión…';
    try{
      const [m,r]=await Promise.all([
        rpc('teacher_merit_bitacora_matrix',{p_period_id:id}),
        rpc('teacher_merit_ranking',{p_period_id:id})
      ]);
      if(!m?.ok)throw new Error(m?.reason||'No se pudo cargar la revisión.');
      const ranks=Array.isArray(r)?r:[],byGroup=Object.fromEntries(ranks.map(x=>[String(x.group_code),Number(x.score||0)]));
      const rows=Array.isArray(m.rows)?m.rows:[];
      const editable=m.period_status==='open';
      if(!m.required)sum.innerHTML='<span class="success">Este periodo de prueba no requiere revisión de bitácoras.</span>';
      else if(m.complete)sum.innerHTML='<span class="success">✓ Revisión completa: '+m.saved_groups+' de '+m.total_groups+' grupos.</span>';
      else sum.innerHTML='<b>Pendiente:</b> '+m.saved_groups+' de '+m.total_groups+'. Debes capturar los 18 grupos, incluso con 0 observaciones.';
      box.innerHTML='<table><thead><tr><th>Grupo</th><th>Puntos</th><th>Observaciones</th><th>Descuento</th><th>Final estimado</th></tr></thead><tbody>'+
        rows.map(x=>{
          const base=byGroup[String(x.group_code)]||0,val=x.saved?Number(x.observation_count):'',d=x.saved?Number(x.deduction||0):null;
          return '<tr class="bitRow27" data-group="'+esc(x.group_code)+'" data-base="'+base+'"><td><b>'+esc(x.group_code)+'</b></td><td>'+base+'</td>'+
            '<td><input class="bitObs27" type="number" min="0" step="1" inputmode="numeric" value="'+val+'" '+(editable?'':'disabled')+' style="width:90px"></td>'+
            '<td class="bitDed27">'+(d===null?'—':d)+'</td><td class="bitFinal27">'+(d===null?'—':base+d)+'</td></tr>';
        }).join('')+'</tbody></table>';
      $$('.bitObs27').forEach(i=>i.addEventListener('input',()=>refreshBitRow(i.closest('.bitRow27'))));
      const save=$('#meritBitacoraSave27'); if(save)save.disabled=!editable||!m.required;
      if(st)st.textContent=!editable?'Este periodo ya no admite cambios.':(m.required?'Escribe 0 cuando el grupo no tenga observaciones.':'No se requiere captura en este periodo de prueba.');
    }catch(e){
      box.innerHTML='';
      if(sum)sum.textContent='';
      if(st)st.textContent='No se pudo cargar la matriz: '+(e.message||e);
    }
  }

  async function saveBitacoraMatrix(){
    const id=bitacoraId(),st=$('#meritBitacoraStatus27'),btn=$('#meritBitacoraSave27');
    const rows=$$('.bitRow27');
    if(!id||!rows.length)return;
    const missing=rows.filter(r=>r.querySelector('.bitObs27').value.trim()==='');
    if(missing.length){
      if(st)st.textContent='Faltan '+missing.length+' grupo(s). Escribe 0 cuando no haya observaciones.';
      missing[0].querySelector('.bitObs27')?.focus();return;
    }
    const payload=rows.map(r=>({group_code:r.dataset.group,observation_count:Math.max(0,parseInt(r.querySelector('.bitObs27').value,10)||0)}));
    if(!confirm('¿Guardar la revisión de las 18 bitácoras?\n\nLa aplicación calculará automáticamente los descuentos.'))return;
    if(btn)btn.disabled=true;if(st)st.textContent='Guardando…';
    try{
      const d=await rpc('teacher_merit_save_bitacora_matrix',{p_period_id:id,p_rows:payload});
      if(!d?.ok)throw new Error(d?.reason||'No se pudo guardar.');
      if(st)st.innerHTML='<span class="success">✓ Revisión guardada. El ajuste se aplicará al cierre mensual.</span>';
      await loadBitacoraMatrix();
    }catch(e){if(st)st.textContent='No se pudo guardar: '+(e.message||e)}
    finally{if(btn)btn.disabled=false}
  }

  const previousClose=window.closeMeritMonth;
  window.closeMeritMonth=async function(){
    const id=currentMonthlyId(),st=$('#meritMonthlyStatus');
    if(id){
      try{
        const p=await rpc('teacher_merit_close_preview',{p_period_id:id});
        if(p?.bitacora_required&&!p?.bitacora_complete){
          if(st)st.textContent='Antes de cerrar el mes debes revisar y guardar las 18 bitácoras.';
          const nav=$('.meritNav[data-merit-pane="bitacoras"]');nav?.click();
          const sel=$('#meritBitacoraPeriod');if(sel)sel.value=id;
          await loadBitacoraMatrix();return;
        }
      }catch(e){if(st)st.textContent='No se pudo verificar la revisión de bitácoras: '+(e.message||e);return;}
    }
    if(typeof previousClose==='function')return previousClose();
  };

  function wire(){
    restoreSession();
    ensureBitacoraPane();
    [250,900,1800,3500].forEach(ms=>setTimeout(()=>loadPeriods(false).catch(()=>{}),ms));
    window.addEventListener('focus',()=>loadPeriods(false).catch(()=>{}));
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')loadPeriods(false).catch(()=>{})});
    const original=window.loadMeritPeriods;
    window.loadMeritPeriods=async function(){return await loadPeriods(true)};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
})();