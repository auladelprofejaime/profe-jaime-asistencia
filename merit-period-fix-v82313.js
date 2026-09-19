// Hotfix v8.23.13 · visualización de periodos Mérito Gabino A. Palma
(function(){
  async function refreshMeritPeriodsHotfix(){
    try{
      const rowsRaw=await window.ProfeSupabase.rpc('teacher_merit_periods',{});
      const rows=Array.isArray(rowsRaw)?rows:(Array.isArray(rowsRaw?.periods)?rowsRaw.periods:[]);
      window.meritPeriodsCache=rows;
      try{ window.meritPeriodsCacheV8151=rows; }catch(_){}

      ['meritRankingPeriod','meritMovementPeriod','meritWeeklyPeriod','meritMonthlyPeriod'].forEach(id=>{
        const el=document.getElementById(id); if(!el)return;
        const old=el.value;
        el.innerHTML=rows.map(p=>'<option value="'+String(p.id).replace(/"/g,'&quot;')+'">'+
          String(p.label||'')+' · '+String(p.status||'')+'</option>').join('');
        if(rows.some(p=>String(p.id)===String(old)))el.value=old;
      });

      const box=document.getElementById('meritPeriodsList');
      if(box){
        if(!rows.length){
          box.innerHTML='<p class="hint">Aún no hay periodos.</p>';
        }else{
          box.innerHTML='<table><thead><tr><th>Periodo</th><th>Fechas</th><th>Estado</th><th>Portal</th><th>Acciones</th></tr></thead><tbody>'+
            rows.map(p=>'<tr><td><b>'+safe(p.label)+'</b><br><small>'+safe(p.school_year||'')+'</small></td><td>'+safe(p.starts_at)+' → '+safe(p.ends_at)+'</td><td>'+safe(p.status)+'</td><td>'+safe(p.public_state)+'</td><td><button type="button" class="secondary meritEditPeriodBtn" data-id="'+safe(p.id)+'">Editar</button>'+((p.status==='closed'||p.status==='published')?'':'<button type="button" class="secondary meritDeletePeriodBtn" data-id="'+safe(p.id)+'" data-label="'+safe(p.label)+'">Eliminar periodo</button>')+'</td></tr>').join('')+
            '</tbody></table>';
          document.querySelectorAll('.meritEditPeriodBtn').forEach(b=>b.onclick=()=>meritOpenPeriodEditV8151(b.dataset.id));
          document.querySelectorAll('.meritDeletePeriodBtn').forEach(b=>b.onclick=()=>deleteMeritPeriodV8164(b.dataset.id,b.dataset.label));
        }
      }
      return rows;
    }catch(e){
      const box=document.getElementById('meritPeriodsList');
      if(box)box.innerHTML='<p class="message">No se pudieron cargar los periodos: '+safe(e.message||e)+'</p>';
      throw e;
    }
  }

  async function saveMeritPeriodHotfix(e){
    e?.preventDefault?.();
    const status=document.getElementById('meritConfigStatus');
    try{
      if(status)status.textContent='Guardando periodo…';
      const d=await window.ProfeSupabase.rpc('teacher_merit_save_period',{
        p_school_year:document.getElementById('meritSchoolYear').value.trim(),
        p_month_number:Number(document.getElementById('meritMonthNumber').value),
        p_label:document.getElementById('meritPeriodLabel').value.trim(),
        p_starts_at:document.getElementById('meritPeriodStart').value,
        p_ends_at:document.getElementById('meritPeriodEnd').value,
        p_status:'open'
      });
      if(!d?.ok)throw new Error(d?.reason||'No se pudo guardar');
      await new Promise(r=>setTimeout(r,120));
      let rows=await refreshMeritPeriodsHotfix();
      if(!rows.some(p=>String(p.id)===String(d.period_id))){
        await new Promise(r=>setTimeout(r,350));
        rows=await refreshMeritPeriodsHotfix();
      }
      if(status)status.textContent='✓ Periodo guardado y visible. '+rows.length+' periodo'+(rows.length===1?'':'s')+' registrado'+(rows.length===1?'':'s')+'.';
    }catch(e2){
      if(status)status.textContent='No se pudo actualizar la lista de periodos.';
      alert('No se pudo guardar o mostrar el periodo: '+(e2.message||e2));
    }
  }

  window.loadMeritPeriods=refreshMeritPeriodsHotfix;
  window.saveMeritPeriod=saveMeritPeriodHotfix;

  const wire=()=>{
    const form=document.getElementById('meritPeriodForm');
    if(form)form.onsubmit=saveMeritPeriodHotfix;
    document.querySelectorAll('.meritNav[data-merit-pane="config"]').forEach(b=>{
      b.addEventListener('click',()=>setTimeout(refreshMeritPeriodsHotfix,0));
    });
    setTimeout(refreshMeritPeriodsHotfix,700);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);
  else wire();
})();