
/* App Docente v8.23.25 · Votación de desempate de Mérito Gabino A. Palma */
(function(){
  const $m=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const labels={
    cleanliness:'Limpieza',uniform:'Uniforme',punctuality:'Puntualidad',
    coexistence:'Convivencia',responsibility:'Responsabilidad',attitude:'Actitud',
    institutional_participation:'Participación institucional'
  };
  async function rpc(name,args={}){
    if(!window.ProfeSupabase)throw new Error('Supabase no está disponible.');
    return await window.ProfeSupabase.rpc(name,args);
  }
  function periodId(){return $m('#meritMonthlyPeriod')?.value||''}
  function issueLabel(i){return i.issue_type==='overall'?'Mérito del Mes':(labels[i.criterion_code]||'Reconocimiento')}

  function ensurePanel(){
    let p=$m('#meritTieVotePanel');if(p)return p;
    const host=$m('#merit-monthly');if(!host)return null;
    p=document.createElement('div');p.id='meritTieVotePanel';p.className='card';p.style.cssText='margin-top:14px;background:#fffaf0;border:2px solid rgba(215,177,30,.55)';
    p.innerHTML='<div class="section"><div><h3 style="margin:0">🗳️ Votación de desempate</h3><p class="hint" style="margin:4px 0 0">Cuando exista empate, la votación se abre para el personal autorizado.</p></div><button id="meritTieVoteRefresh" class="secondary" type="button">Actualizar votación</button></div><div id="meritTieVoteAdminContent"></div><p id="meritTieVoteAdminStatus" class="message"></p>';
    const result=$m('#meritMonthlyResult');host.insertBefore(p,result||null);
    $m('#meritTieVoteRefresh').onclick=refreshTieVoteStatus;
    return p;
  }

  function renderCommitteeControls(issues){
    return issues.map(i=>{
      const max=Math.max(...(i.candidates||[]).map(c=>Number(c.votes||0)),0);
      const tied=(i.candidates||[]).filter(c=>Number(c.votes||0)===max);
      return '<div class="merit-tie-card" data-key="'+esc(i.issue_key)+'"><b>'+esc(issueLabel(i))+'</b><p class="hint">La votación permaneció empatada con '+max+' voto(s). El Comité debe elegir entre los grupos que continúan empatados.</p><label>Grupo<select class="committeeGroup"><option value="">Selecciona…</option>'+tied.map(c=>'<option value="'+esc(c.group_code)+'">Grupo '+esc(c.group_code)+'</option>').join('')+'</select></label><label>Nota de resolución<textarea class="committeeNote" rows="2" placeholder="Motivo de la resolución del Comité"></textarea></label></div>';
    }).join('')+'<button id="meritCommitteeResolveBtn" type="button" class="primary">Resolver como Comité y cerrar mes</button>';
  }

  async function refreshTieVoteStatus(){
    const id=periodId(),panel=ensurePanel(),box=$m('#meritTieVoteAdminContent'),st=$m('#meritTieVoteAdminStatus');
    if(!id||!panel||!box)return;
    try{
      const d=await rpc('teacher_merit_tie_vote_status',{p_period_id:id});
      if(!d?.ok||!d.exists){panel.classList.add('hidden');return}
      panel.classList.remove('hidden');
      const issues=Array.isArray(d.issues)?d.issues:[];
      box.innerHTML='<p><b>Estado:</b> '+(d.status==='open'?'Votación abierta':d.status==='committee_required'?'Requiere resolución del Comité':'Aplicada al cierre')+' · <b>Personal habilitado:</b> '+Number(d.eligible_voters||0)+'</p>'+
        issues.map(i=>'<div class="merit-tie-card"><b>'+esc(issueLabel(i))+'</b><p class="hint">'+Number(i.votes_cast||0)+' de '+Number(i.eligible_voters||0)+' personas han votado.</p><div class="merit-category-grid">'+(i.candidates||[]).map(c=>'<div class="merit-category-card"><b>Grupo '+esc(c.group_code)+'</b><div>'+Number(c.votes||0)+' voto(s)</div></div>').join('')+'</div></div>').join('')+
        (d.status==='open'?'<div class="actions"><button id="meritTieVoteCloseBtn" class="primary" type="button">Cerrar votación y resolver desempate</button></div>':'')+
        (d.status==='committee_required'?renderCommitteeControls(issues.filter(i=>i.status==='committee_required')):'');
      $m('#meritTieVoteCloseBtn')?.addEventListener('click',closeTieVote);
      $m('#meritCommitteeResolveBtn')?.addEventListener('click',resolveCommittee);
      if(st)st.textContent='';
    }catch(e){if(st)st.textContent='No se pudo consultar la votación: '+(e.message||e)}
  }

  async function closeTieVote(){
    const id=periodId(),st=$m('#meritTieVoteAdminStatus'),btn=$m('#meritTieVoteCloseBtn');
    if(!id)return;
    if(!confirm('¿Cerrar la votación con los votos registrados hasta este momento?\n\nSi aún existe empate, el Comité deberá resolverlo.'))return;
    if(btn)btn.disabled=true;if(st)st.textContent='Cerrando votación…';
    try{
      const d=await rpc('teacher_merit_close_tie_vote',{p_period_id:id,p_committee_resolutions:{}});
      if(d?.ok&&d.applied){
        if(st)st.textContent='✓ Votación cerrada y desempate aplicado. El mes quedó cerrado.';
        await refreshTieVoteStatus();
        try{if(typeof window.loadMeritMonthlyPreview==='function')await window.loadMeritMonthlyPreview()}catch(_){}
        return;
      }
      if(d?.reason==='committee_required'){
        if(st)st.textContent='La votación terminó empatada. Se requiere resolución del Comité.';
        await refreshTieVoteStatus();return;
      }
      throw new Error(d?.reason||'No se pudo cerrar la votación.');
    }catch(e){if(st)st.textContent='No se pudo cerrar la votación: '+(e.message||e)}
    finally{if(btn)btn.disabled=false}
  }

  async function resolveCommittee(){
    const id=periodId(),st=$m('#meritTieVoteAdminStatus'),btn=$m('#meritCommitteeResolveBtn');
    const resolutions={};let invalid=false;
    $m('#meritTieVotePanel')?.querySelectorAll('.merit-tie-card[data-key]').forEach(card=>{
      const key=card.dataset.key,group=card.querySelector('.committeeGroup')?.value||'',note=card.querySelector('.committeeNote')?.value.trim()||'';
      if(!group||!note)invalid=true;
      resolutions[key]={group,note};
    });
    if(invalid){if(st)st.textContent='Selecciona un grupo y escribe la nota de resolución en cada empate.';return}
    if(!confirm('¿Confirmar la resolución del Comité y cerrar definitivamente el mes?'))return;
    if(btn)btn.disabled=true;if(st)st.textContent='Aplicando resolución…';
    try{
      const d=await rpc('teacher_merit_close_tie_vote',{p_period_id:id,p_committee_resolutions:resolutions});
      if(!d?.ok)throw new Error(d?.reason||'No se pudo aplicar la resolución.');
      if(st)st.textContent='✓ Resolución registrada. El mes quedó cerrado.';
      await refreshTieVoteStatus();
      try{if(typeof window.loadMeritMonthlyPreview==='function')await window.loadMeritMonthlyPreview()}catch(_){}
    }catch(e){if(st)st.textContent='No se pudo resolver: '+(e.message||e)}
    finally{if(btn)btn.disabled=false}
  }

  window.closeMeritMonth=async function(){
    const id=periodId(),st=$m('#meritMonthlyStatus'),btn=$m('#meritMonthlyCloseBtn');
    if(!id){if(st)st.textContent='Selecciona un periodo.';return}
    if(btn)btn.disabled=true;if(st)st.textContent='Revisando cierre…';
    try{
      const preview=await rpc('teacher_merit_close_preview',{p_period_id:id});
      if(!preview?.ok)throw new Error(preview?.reason||'No se pudo revisar el cierre.');
      if(preview.has_ties){
        const opened=await rpc('teacher_merit_open_tie_vote',{p_period_id:id});
        if(!opened?.ok)throw new Error(opened?.reason||'No se pudo abrir la votación.');
        if(st)st.textContent='Empate detectado. ✓ La votación se abrió automáticamente para el personal autorizado.';
        if(opened?.opened){
          try{await window.ProfeSupabase.edge('merit-push',{event:'merit_vote_open',period_id:id})}
          catch(e){console.warn('No se pudo enviar la notificación de votación',e)}
        }
        ensurePanel()?.classList.remove('hidden');
        await refreshTieVoteStatus();
        return;
      }
      if(!confirm('No hay empates. ¿Cerrar definitivamente este periodo?'))return;
      const d=await rpc('teacher_merit_close_month',{p_period_id:id,p_resolutions:{}});
      if(!d?.ok)throw new Error(d?.reason||'No se pudo cerrar el mes.');
      if(st)st.textContent='✓ Mes cerrado correctamente. No fue necesaria una votación.';
      try{if(typeof window.loadMeritMonthlyPreview==='function')await window.loadMeritMonthlyPreview()}catch(_){}
    }catch(e){if(st)st.textContent='No se pudo cerrar: '+(e.message||e)}
    finally{if(btn)btn.disabled=false}
  };


  window.publishMeritMonth=async function(){
    const id=periodId(),st=$m('#meritMonthlyStatus'),btn=$m('#meritMonthlyPublishBtn');
    if(!id){if(st)st.textContent='Selecciona un periodo.';return}
    if(!confirm('¿Publicar el resultado oficial de este mes en el portal público?'))return;
    if(btn)btn.disabled=true;if(st)st.textContent='Publicando resultado oficial…';
    try{
      const d=await rpc('teacher_merit_publish_monthly_official',{p_period_id:id});
      if(!d?.ok)throw new Error(d?.reason||'No se pudo publicar.');
      let sent=true;
      try{await window.ProfeSupabase.edge('merit-push',{event:'merit_results_published',period_id:id})}
      catch(e){sent=false;console.warn('No se pudo enviar la notificación de resultados',e)}
      alert(sent?'✓ Resultado oficial publicado y notificación enviada.':'✓ Resultado oficial publicado. La notificación push no pudo enviarse en este momento.');
      if(st)st.textContent=sent?'✓ Resultado oficial publicado. Se notificó al personal autorizado.':'✓ Resultado oficial publicado. No se pudo confirmar el envío de la notificación.';
      try{if(typeof window.loadMeritPeriods==='function')await window.loadMeritPeriods()}catch(_){}
      try{if(typeof window.loadMeritMonthlyResult==='function')await window.loadMeritMonthlyResult()}catch(_){}
    }catch(e){if(st)st.textContent='No se pudo publicar: '+(e.message||e)}
    finally{if(btn)btn.disabled=false}
  };

  function wire(){
    const hint=$m('#merit-monthly .section .hint');
    if(hint)hint.textContent='Revisa el resultado antes de cerrar. Si existe un empate, la app abrirá automáticamente una votación para el personal autorizado. Si la votación vuelve a empatar, resolverá el Comité Organizador.';
    ensurePanel()?.classList.add('hidden');
    $m('#meritMonthlyPeriod')?.addEventListener('change',()=>setTimeout(refreshTieVoteStatus,60));
    document.querySelectorAll('.meritNav[data-merit-pane="monthly"]').forEach(b=>b.addEventListener('click',()=>setTimeout(refreshTieVoteStatus,120)));
    setTimeout(refreshTieVoteStatus,1500);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
})();
