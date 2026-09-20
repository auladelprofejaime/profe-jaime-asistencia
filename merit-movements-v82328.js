/* App Docente v8.23.28 · Movimientos y anulaciones de Mérito */
(function(){
  const $=s=>document.querySelector(s);
  const $$=s=>[...document.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const labels={
    cleanliness:'Limpieza',uniform:'Uniforme',punctuality:'Puntualidad',
    coexistence:'Convivencia',responsibility:'Responsabilidad',attitude:'Actitud',
    institutional_participation:'Participación institucional'
  };
  let selectedMovement=null;

  function restoreSession(){try{window.ProfeSupabase?.restore?.()}catch(_){}}
  async function rpc(name,args={}){
    restoreSession();
    if(!window.ProfeSupabase)throw new Error('Supabase no está disponible.');
    return await window.ProfeSupabase.rpc(name,args);
  }
  function fmtDate(v){
    if(!v)return '—';
    try{return new Date(v).toLocaleString('es-MX',{dateStyle:'short',timeStyle:'short'})}catch(_){return String(v)}
  }
  function statusText(v){
    return v==='valid'?'Válido':v==='voided'?'Anulado':v==='corrected'?'Corregido':String(v||'');
  }
  function pointsText(v){
    if(v===null||v===undefined)return 'Sin puntos';
    const n=Number(v); return n>0?'+'+n:String(n);
  }

  function ensureDialog(){
    let d=$('#meritVoidMovementDialog28'); if(d)return d;
    d=document.createElement('dialog');
    d.id='meritVoidMovementDialog28';
    d.innerHTML=`<div class="dialogbody">
      <h2>Anular movimiento</h2>
      <p class="hint">El registro no se borrará. Quedará marcado como anulado y conservará quién hizo la corrección, cuándo y por qué.</p>
      <div id="meritVoidMovementSummary28" style="padding:10px 12px;background:#f7f7f7;border-radius:12px;margin-bottom:10px"></div>
      <label>Motivo de la anulación<textarea id="meritVoidMovementNote28" rows="3" maxlength="300" placeholder="Ej. Se seleccionó el grupo equivocado"></textarea></label>
      <div class="actions">
        <button id="meritVoidCancel28" class="secondary" type="button">Cancelar</button>
        <button id="meritVoidConfirm28" class="primary" type="button">Confirmar anulación</button>
      </div>
      <p id="meritVoidStatus28" class="message"></p>
    </div>`;
    document.body.appendChild(d);
    $('#meritVoidCancel28').onclick=()=>d.close();
    $('#meritVoidConfirm28').onclick=confirmVoid;
    return d;
  }

  async function loadMovements(){
    const period=$('#meritMovementPeriod')?.value||'';
    const box=$('#meritMovementsTable');
    if(!box)return;
    box.innerHTML='<p class="hint">Cargando movimientos…</p>';
    try{
      const rows=await rpc('teacher_merit_movements',{p_period_id:period||null,p_limit:500});
      const data=Array.isArray(rows)?rows:[];
      if(!data.length){box.innerHTML='<p class="hint">No hay movimientos en este periodo.</p>';return;}
      box.innerHTML='<table><thead><tr><th>Fecha</th><th>Grupo</th><th>Personal</th><th>Movimiento</th><th>Estado</th><th>Acción</th></tr></thead><tbody>'+
        data.map(m=>{
          const cs=(Array.isArray(m.criteria)?m.criteria:[]).map(c=>labels[c]||c);
          const detail='<b>'+esc(pointsText(m.points))+'</b>'+
            (m.reason?'<br><small>'+esc(m.reason)+'</small>':'')+
            (cs.length?'<br><small>Reconocimientos: '+esc(cs.join(', '))+'</small>':'');
          const voided=m.status==='voided'
            ?'<div><b>Anulado</b>'+(m.admin_note?'<br><small>Motivo: '+esc(m.admin_note)+'</small>':'')+(m.corrected_at?'<br><small>'+esc(fmtDate(m.corrected_at))+'</small>':'')+'</div>'
            :'<b>'+esc(statusText(m.status))+'</b>';
          const action=(m.status==='valid'&&m.period_status==='open')
            ?'<button class="secondary meritVoidBtn28" type="button" data-id="'+esc(m.id)+'">Anular</button>'
            :(m.status==='valid'?'<span class="hint">Periodo '+esc(m.period_status||'cerrado')+'</span>':'—');
          return '<tr data-id="'+esc(m.id)+'"><td>'+esc(fmtDate(m.captured_at||m.created_at))+'</td><td><b>'+esc(m.group_code)+'</b></td>'+
            '<td>'+esc(m.display_name||'')+'</td><td>'+detail+'</td><td>'+voided+'</td><td>'+action+'</td></tr>';
        }).join('')+'</tbody></table>';
      $$('.meritVoidBtn28').forEach(b=>b.onclick=()=>{
        selectedMovement=data.find(x=>String(x.id)===String(b.dataset.id))||null;
        if(!selectedMovement)return;
        const d=ensureDialog();
        $('#meritVoidMovementSummary28').innerHTML='<b>Grupo '+esc(selectedMovement.group_code)+'</b> · '+esc(pointsText(selectedMovement.points))+
          (selectedMovement.reason?'<br>'+esc(selectedMovement.reason):'');
        $('#meritVoidMovementNote28').value='';
        $('#meritVoidStatus28').textContent='';
        d.showModal();
      });
    }catch(e){
      box.innerHTML='<p class="message">No se pudieron cargar los movimientos: '+esc(e.message||e)+'</p>';
    }
  }

  async function confirmVoid(){
    const d=$('#meritVoidMovementDialog28'),note=$('#meritVoidMovementNote28').value.trim();
    const st=$('#meritVoidStatus28'),btn=$('#meritVoidConfirm28');
    if(!selectedMovement)return;
    if(note.length<3){st.textContent='Escribe el motivo de la anulación.';return;}
    if(!confirm('¿Anular este movimiento?\n\nNo se borrará: quedará registrado como anulado con su motivo y trazabilidad.'))return;
    btn.disabled=true;st.textContent='Anulando movimiento…';
    try{
      const r=await rpc('teacher_merit_void_movement',{p_movement_id:selectedMovement.id,p_admin_note:note});
      if(!r?.ok){
        const msgs={
          note_required:'Debes escribir un motivo.',
          period_not_open:'El periodo ya no está abierto y no admite cambios.',
          movement_not_valid:'Este movimiento ya fue modificado.',
          movement_not_found:'No se encontró el movimiento.'
        };
        throw new Error(msgs[r?.reason]||r?.reason||'No se pudo anular.');
      }
      st.innerHTML='<span class="success">✓ Movimiento anulado. La clasificación ya no lo contabilizará.</span>';
      setTimeout(()=>d.close(),550);
      await loadMovements();
      try{if(typeof window.loadMeritRanking==='function')await window.loadMeritRanking()}catch(_){}
      try{if(typeof window.loadMeritMonthlyPreview==='function')await window.loadMeritMonthlyPreview()}catch(_){}
    }catch(e){st.textContent='No se pudo anular: '+(e.message||e)}
    finally{btn.disabled=false}
  }

  function wire(){
    ensureDialog();
    $('#meritRefreshMovements')?.addEventListener('click',loadMovements);
    $('#meritMovementPeriod')?.addEventListener('change',loadMovements);
    $$('.meritNav[data-merit-pane="movements"]').forEach(b=>b.addEventListener('click',()=>setTimeout(loadMovements,100)));
    setTimeout(()=>{if($('#merit-movements')?.classList.contains('active'))loadMovements()},1800);
  }
  window.loadMeritMovements=loadMovements;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
})();