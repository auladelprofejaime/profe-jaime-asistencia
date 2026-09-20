/* App Docente v8.23.26 · Revisión mensual de bitácoras de Mérito */
(function(){
  const $=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function rpc(name,args={}){
    if(!window.ProfeSupabase)throw new Error('Supabase no está disponible.');
    return await window.ProfeSupabase.rpc(name,args);
  }
  const deduction=n=>{
    n=Number(n);
    if(!Number.isFinite(n)||n<=2)return 0;
    if(n<=4)return -2;
    if(n<=6)return -5;
    if(n<=9)return -8;
    return -10;
  };
  function periodId(){return $('#meritMonthlyPeriod')?.value||''}

  function ensurePanel(){
    let p=$('#meritBitacoraPanel');if(p)return p;
    const host=$('#merit-monthly');if(!host)return null;
    p=document.createElement('div');
    p.id='meritBitacoraPanel';
    p.className='card';
    p.style.cssText='margin:14px 0;background:#f7fbff;border:1px solid rgba(24,91,145,.22)';
    p.innerHTML=`
      <div class="section">
        <div>
          <h3 style="margin:0">📋 Revisión mensual de bitácoras</h3>
          <p class="hint" style="margin:5px 0 0">Cuenta las observaciones de cada bitácora y captura únicamente el total. La app calcula el descuento automáticamente antes del cierre.</p>
        </div>
        <button id="meritBitacoraRefresh" class="secondary" type="button">Actualizar</button>
      </div>
      <div style="padding:10px 12px;border-radius:12px;background:#fff;margin:10px 0">
        <b>Escala:</b> 0–2 = sin descuento · 3–4 = −2 · 5–6 = −5 · 7–9 = −8 · 10 o más = −10
      </div>
      <p id="meritBitacoraSummary" class="message"></p>
      <div id="meritBitacoraMatrix" class="tablewrap"></div>
      <div class="actions" style="margin-top:12px">
        <button id="meritBitacoraSave" class="primary" type="button">Guardar revisión de las 18 bitácoras</button>
      </div>
      <p id="meritBitacoraStatus" class="message"></p>`;
    const actions=host.querySelector(':scope > .actions');
    if(actions)host.insertBefore(p,actions); else host.appendChild(p);
    $('#meritBitacoraRefresh').onclick=loadMatrix;
    $('#meritBitacoraSave').onclick=saveMatrix;
    return p;
  }

  function refreshRow(row){
    const input=row.querySelector('.bitObs');
    const dcell=row.querySelector('.bitDed');
    const fcell=row.querySelector('.bitFinal');
    const base=Number(row.dataset.base||0);
    const val=input.value.trim();
    if(val===''){
      dcell.textContent='—';fcell.textContent='—';return;
    }
    const n=Math.max(0,parseInt(val,10)||0),d=deduction(n);
    dcell.textContent=d===0?'0':String(d);
    fcell.textContent=String(base+d);
  }

  async function loadMatrix(){
    const id=periodId(),box=$('#meritBitacoraMatrix'),sum=$('#meritBitacoraSummary'),st=$('#meritBitacoraStatus');
    if(!id||!box)return;
    if(st)st.textContent='Cargando bitácoras…';
    try{
      const [m,r]=await Promise.all([
        rpc('teacher_merit_bitacora_matrix',{p_period_id:id}),
        rpc('teacher_merit_ranking',{p_period_id:id})
      ]);
      if(!m?.ok)throw new Error(m?.reason||'No se pudo cargar la revisión.');
      const ranks=Array.isArray(r)?r:[],byGroup=Object.fromEntries(ranks.map(x=>[String(x.group_code),Number(x.score||0)]));
      const rows=Array.isArray(m.rows)?m.rows:[];
      const editable=m.period_status==='open';
      if(!m.required){
        sum.innerHTML='<span class="success">Este periodo de prueba no requiere revisión de bitácoras para poder cerrarse.</span>';
      }else if(m.complete){
        sum.innerHTML='<span class="success">✓ Revisión completa: '+m.saved_groups+' de '+m.total_groups+' bitácoras registradas.</span>';
      }else{
        sum.innerHTML='<b>Pendiente:</b> '+m.saved_groups+' de '+m.total_groups+' bitácoras guardadas. Para cerrar el mes deben estar las 18, incluso las que tengan 0 observaciones.';
      }
      box.innerHTML=`<table><thead><tr><th>Grupo</th><th>Puntos</th><th>Observaciones del mes</th><th>Descuento</th><th>Final estimado</th></tr></thead><tbody>`+
        rows.map(x=>{
          const base=byGroup[String(x.group_code)]||0;
          const val=x.saved?Number(x.observation_count):'';
          const d=x.saved?Number(x.deduction||0):null;
          return `<tr class="bitRow" data-group="${esc(x.group_code)}" data-base="${base}">
            <td><b>${esc(x.group_code)}</b></td>
            <td>${base}</td>
            <td><input class="bitObs" type="number" min="0" step="1" inputmode="numeric" value="${val}" ${editable?'':'disabled'} style="width:90px"></td>
            <td class="bitDed">${d===null?'—':d}</td>
            <td class="bitFinal">${d===null?'—':base+d}</td>
          </tr>`;
        }).join('')+'</tbody></table>';
      box.querySelectorAll('.bitObs').forEach(i=>i.addEventListener('input',()=>refreshRow(i.closest('.bitRow'))));
      const save=$('#meritBitacoraSave');
      if(save)save.disabled=!editable||!m.required;
      if(st)st.textContent=editable?(m.required?'Captura 0 cuando una bitácora no tenga observaciones.':'Periodo de prueba: no se requiere guardar esta matriz.'):'Este periodo ya no admite cambios en la revisión de bitácoras.';
    }catch(e){
      box.innerHTML='';if(sum)sum.textContent='';
      if(st)st.textContent='No se pudo cargar la matriz: '+(e.message||e);
    }
  }

  async function saveMatrix(){
    const id=periodId(),st=$('#meritBitacoraStatus'),btn=$('#meritBitacoraSave');
    if(!id)return;
    const rows=[...document.querySelectorAll('#meritBitacoraMatrix .bitRow')];
    const missing=rows.filter(r=>r.querySelector('.bitObs').value.trim()==='');
    if(missing.length){
      if(st)st.textContent='Faltan '+missing.length+' grupo(s). Escribe 0 cuando no haya observaciones.';
      missing[0].querySelector('.bitObs')?.focus();return;
    }
    const payload=rows.map(r=>({
      group_code:r.dataset.group,
      observation_count:Math.max(0,parseInt(r.querySelector('.bitObs').value,10)||0)
    }));
    if(!confirm('¿Guardar la revisión de las 18 bitácoras?\n\nLa app aplicará automáticamente los descuentos de acuerdo con la escala establecida.'))return;
    if(btn)btn.disabled=true;if(st)st.textContent='Guardando revisión…';
    try{
      const d=await rpc('teacher_merit_save_bitacora_matrix',{p_period_id:id,p_rows:payload});
      if(!d?.ok){
        if(d?.reason==='all_groups_required'||d?.reason==='duplicate_or_missing_groups')throw new Error('Deben capturarse exactamente los 18 grupos.');
        if(d?.reason==='period_not_open')throw new Error('Este periodo ya no permite modificar la revisión.');
        throw new Error(d?.reason||'No se pudo guardar.');
      }
      if(st)st.innerHTML='<span class="success">✓ Revisión guardada. Los descuentos ya se tomarán en cuenta en el cierre mensual.</span>';
      await loadMatrix();
      try{if(typeof window.loadMeritMonthlyPreview==='function')await window.loadMeritMonthlyPreview()}catch(_){}
    }catch(e){if(st)st.textContent='No se pudo guardar: '+(e.message||e)}
    finally{if(btn)btn.disabled=false}
  }

  const originalClose=window.closeMeritMonth;
  window.closeMeritMonth=async function(){
    const id=periodId(),st=$('#meritMonthlyStatus');
    if(!id)return originalClose?.();
    try{
      const p=await rpc('teacher_merit_close_preview',{p_period_id:id});
      if(p?.bitacora_required&&!p?.bitacora_complete){
        if(st)st.textContent='Antes de cerrar el mes debes revisar y guardar las 18 bitácoras.';
        ensurePanel()?.scrollIntoView({behavior:'smooth',block:'start'});
        await loadMatrix();
        return;
      }
    }catch(e){console.warn(e)}
    return originalClose?.();
  };

  function wire(){
    ensurePanel();
    $('#meritMonthlyPeriod')?.addEventListener('change',()=>setTimeout(loadMatrix,80));
    document.querySelectorAll('.meritNav[data-merit-pane="monthly"]').forEach(b=>b.addEventListener('click',()=>setTimeout(loadMatrix,130)));
    setTimeout(loadMatrix,1700);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
})();