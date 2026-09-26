/* App Docente v8.23.35 · Acumulado anual y cierre final */
(function(){
  const $=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function restore(){try{window.ProfeSupabase?.restore?.()}catch(_){}}
  async function rpc(name,args={}){
    restore();
    if(!window.ProfeSupabase)throw new Error('Supabase no está disponible.');
    return await window.ProfeSupabase.rpc(name,args);
  }
  function cycle(){return $('#meritAnnualCycle')?.value?.trim()||'2026-2027'}
  function ensureUI(){
    const pane=$('#merit-annual'); if(!pane)return;
    const hint=pane.querySelector('.section .hint');
    if(hint)hint.textContent='Suma los periodos mensuales cerrados y el tramo final del ciclo. En la clausura solo se reconoce al grupo campeón anual y a su asesor.';
    let box=$('#meritAnnualFinal35');
    if(!box){
      box=document.createElement('div');box.id='meritAnnualFinal35';box.className='card';
      box.style.cssText='margin:12px 0;background:#fffaf0;border:2px solid rgba(215,177,30,.5)';
      box.innerHTML=`
        <h3 style="margin-top:0">🏁 Cierre anual 2026-2027</h3>
        <p class="hint">Tramo final: del 24 de mayo al 20 de junio. Si existe empate anual, la votación se realiza del 21 al 24 de junio; el cierre queda disponible el 25 de junio. La publicación oficial es el 9 de julio.</p>
        <div id="meritAnnualFinalStatus35" class="message"></div>
        <div id="meritAnnualVote35"></div>
        <div id="meritAnnualAdvisorBox35" class="hidden" style="margin-top:12px">
          <label>Asesor del grupo campeón<input id="meritAnnualAdvisor35" placeholder="Nombre del asesor"></label>
          <button id="meritAnnualAdvisorSave35" class="secondary" type="button">Guardar asesor del campeón</button>
          <p id="meritAnnualAdvisorStatus35" class="hint"></p>
        </div>
        <div class="actions" style="margin-top:10px">
          <button id="meritAnnualPrepare35" class="primary" type="button">Revisar / preparar cierre anual</button>
          <button id="meritAnnualVoteRefresh35" class="secondary" type="button">Actualizar votación</button>
          <button id="meritAnnualPublish35" class="secondary" type="button">Publicar campeón anual</button>
        </div>`;
      const table=$('#meritAnnualTable'); pane.insertBefore(box,table||null);
      $('#meritAnnualPrepare35').onclick=prepareAnnual;
      $('#meritAnnualVoteRefresh35').onclick=loadAnnual;
      $('#meritAnnualPublish35').onclick=publishAnnual;
      $('#meritAnnualAdvisorSave35').onclick=saveAdvisor;
    }
  }
  function renderRanking(rows,status){
    const box=$('#meritAnnualTable'); if(!box)return;
    if(!Array.isArray(rows)||!rows.length){box.innerHTML='<p class="hint">Aún no hay datos acumulados.</p>';return;}
    const winner=status?.winner_group||'';
    box.innerHTML='<table><thead><tr><th>Lugar</th><th>Grupo</th><th>Periodos mensuales</th><th>Puntaje mensual</th><th>Tramo final</th><th>Total anual</th></tr></thead><tbody>'+
      rows.map(r=>'<tr'+(String(r.group_code)===String(winner)?' style="font-weight:800;background:#fff8d6"':'')+'>'+
        '<td><b>'+esc(r.rank)+'º</b></td><td><b>'+esc(r.group_code)+'</b></td>'+
        '<td>'+esc(r.periods_closed??r.months_closed??0)+'</td><td>'+esc(r.monthly_score??0)+'</td>'+
        '<td>'+esc(r.final_stage_score??0)+'</td><td><b>'+esc(r.annual_score??0)+'</b></td></tr>').join('')+
      '</tbody></table>';
  }
  function tieLabel(issue){return issue?.issue_key==='annual'?'Campeón anual':'Desempate'}
  function renderVote(d){
    const box=$('#meritAnnualVote35'); if(!box)return;
    if(!d?.exists){box.innerHTML='';return}
    const issues=Array.isArray(d.issues)?d.issues:[];
    box.innerHTML='<div style="margin-top:10px"><b>Votación:</b> '+esc(d.status||'')+' · <b>Habilitados:</b> '+esc(d.eligible_voters||0)+'</div>'+
      issues.map(i=>'<div class="merit-tie-card" data-issue="'+esc(i.issue_id)+'"><b>'+esc(tieLabel(i))+'</b>'+
        '<p class="hint">'+esc(i.votes_cast||0)+' de '+esc(i.eligible_voters||0)+' han votado.</p>'+
        '<div class="merit-category-grid">'+(i.candidates||[]).map(c=>'<div class="merit-category-card"><b>Grupo '+esc(c.group_code)+'</b><div>'+esc(c.votes||0)+' voto(s)</div></div>').join('')+'</div></div>').join('')+
      (d.status==='open'?'<button id="meritAnnualCloseVote35" class="primary" type="button">Cerrar votación anual</button>':'')+
      (d.status==='committee_required'?'<div id="meritAnnualCommittee35"><p><b>La votación sigue empatada.</b> El Comité debe resolver entre los grupos que permanecen empatados.</p><label>Grupo<select id="meritAnnualCommitteeGroup35"><option value="">Selecciona…</option>'+
        ((issues[0]?.candidates||[]).filter(c=>Number(c.votes)===Math.max(...(issues[0]?.candidates||[]).map(x=>Number(x.votes||0)),0)).map(c=>'<option value="'+esc(c.group_code)+'">Grupo '+esc(c.group_code)+'</option>').join(''))+
        '</select></label><label>Nota<textarea id="meritAnnualCommitteeNote35" rows="2"></textarea></label><button id="meritAnnualCommitteeSave35" class="primary" type="button">Resolver y cerrar anual</button></div>':'');
    $('#meritAnnualCloseVote35')?.addEventListener('click',()=>closeAnnualVote(false));
    $('#meritAnnualCommitteeSave35')?.addEventListener('click',()=>closeAnnualVote(true));
  }
  async function loadAnnual(){
    ensureUI();
    const st=$('#meritAnnualFinalStatus35');
    try{
      const d=await rpc('teacher_merit_annual_status',{p_cycle:cycle()});
      if(!d?.ok)throw new Error(d?.reason||'No se pudo consultar el acumulado.');
      window.meritAnnualCache=Array.isArray(d.ranking)?d.ranking:[];
      renderRanking(window.meritAnnualCache,d);
      const state=d.published?'Publicado':d.closed?'Cerrado':d.final_status==='frozen'?'En votación / cierre':'En acumulación';
      if(st)st.innerHTML='<b>Estado:</b> '+esc(state)+' · <b>Tramo final:</b> '+esc(d.final_starts_at||'')+' a '+esc(d.final_ends_at||'')+
        (d.winner_group?'<br><span class="success">Campeón definido: Grupo '+esc(d.winner_group)+' · '+esc(d.annual_score)+' puntos.</span>'+
          '<br><b>Grado:</b> '+esc(d.winner_grade||'—')+'º · <b>Beneficio al siguiente ciclo:</b> '+(d.benefit_transferable?'Sí, transferible.':'No; reconocimiento de clausura.')+
          (d.advisor_name?'<br><b>Asesor reconocido:</b> '+esc(d.advisor_name):''):'');
      const advisorBox=$('#meritAnnualAdvisorBox35');
      if(advisorBox)advisorBox.classList.toggle('hidden',!d.closed);
      const advisorInput=$('#meritAnnualAdvisor35');
      if(advisorInput && d.advisor_name && document.activeElement!==advisorInput)advisorInput.value=d.advisor_name;
      if(d.final_period_id){
        try{renderVote(await rpc('teacher_merit_tie_vote_status',{p_period_id:d.final_period_id}))}
        catch(_){renderVote(null)}
      }
      return d;
    }catch(e){if(st)st.textContent='No se pudo cargar el cierre anual: '+(e.message||e)}
  }
  async function prepareAnnual(){
    const st=$('#meritAnnualFinalStatus35'),btn=$('#meritAnnualPrepare35'); if(btn)btn.disabled=true;
    try{
      const d=await rpc('teacher_merit_annual_status',{p_cycle:cycle()});
      if(!d?.ok)throw new Error(d?.reason||'No se pudo revisar.');
      if(d.closed){if(st)st.textContent='El acumulado anual ya está cerrado.';await loadAnnual();return}
      const rows=Array.isArray(d.ranking)?d.ranking:[],top=rows[0]?.annual_score;
      const tied=rows.filter(r=>Number(r.annual_score)===Number(top));
      if(tied.length>1){
        const opened=await rpc('teacher_merit_open_annual_tie_vote',{p_cycle:cycle()});
        if(!opened?.ok){
          const msg={final_capture_still_open:'La captura final todavía está abierta.',no_tie:'Ya no existe empate anual.'}[opened?.reason]||opened?.reason;
          throw new Error(msg||'No se pudo abrir la votación anual.');
        }
        if(st)st.textContent='✓ Empate anual detectado. La votación quedó abierta para el personal autorizado.';
      }else{
        if(!confirm('No hay empate anual. ¿Preparar el cierre definitivo? El cierre solo podrá completarse a partir del 25 de junio.'))return;
        const closed=await rpc('teacher_merit_close_annual',{p_cycle:cycle(),p_resolution_group:null,p_resolution_note:null});
        if(!closed?.ok){
          const msg=closed?.reason==='annual_close_too_early'?'El cierre definitivo estará disponible el '+closed.available_from+'.':closed?.reason;
          throw new Error(msg||'No se pudo cerrar el acumulado anual.');
        }
        if(st)st.textContent='✓ Acumulado anual cerrado.';
      }
      await loadAnnual();
    }catch(e){if(st)st.textContent='No se pudo preparar el cierre anual: '+(e.message||e)}
    finally{if(btn)btn.disabled=false}
  }
  async function closeAnnualVote(committee){
    const st=$('#meritAnnualFinalStatus35');
    let group=null,note=null;
    if(committee){
      group=$('#meritAnnualCommitteeGroup35')?.value||'';
      note=$('#meritAnnualCommitteeNote35')?.value.trim()||'';
      if(!group||!note){if(st)st.textContent='Selecciona el grupo y escribe la nota del Comité.';return}
    }
    if(!confirm('¿Cerrar la votación anual con los votos registrados?'))return;
    try{
      const d=await rpc('teacher_merit_close_annual_tie_vote',{
        p_cycle:cycle(),p_committee_group:group,p_committee_note:note
      });
      if(!d?.ok){
        if(d?.reason==='committee_required'){if(st)st.textContent='La votación sigue empatada. Se requiere resolución del Comité.';await loadAnnual();return}
        if(d?.reason==='annual_close_too_early'){throw new Error('El cierre definitivo estará disponible el 25 de junio.')}
        throw new Error(d?.reason||'No se pudo cerrar la votación anual.');
      }
      if(st)st.textContent='✓ Campeón anual definido y cierre aplicado.';
      await loadAnnual();
    }catch(e){if(st)st.textContent='No se pudo cerrar la votación anual: '+(e.message||e)}
  }
  async function saveAdvisor(){
    const st=$('#meritAnnualAdvisorStatus35'),input=$('#meritAnnualAdvisor35');
    const name=input?.value.trim()||'';
    if(!name){if(st)st.textContent='Escribe el nombre del asesor del grupo campeón.';return}
    try{
      const d=await rpc('teacher_merit_set_annual_award_details',{p_cycle:cycle(),p_advisor_name:name});
      if(!d?.ok)throw new Error(d?.reason||'No se pudo guardar.');
      if(st)st.innerHTML='<span class="success">✓ Asesor guardado. '+(d.benefit_transferable?'El grupo conserva beneficio transferible al siguiente ciclo.':'El grupo recibe reconocimiento de clausura.')+'</span>';
      await loadAnnual();
    }catch(e){if(st)st.textContent='No se pudo guardar el asesor: '+(e.message||e)}
  }
  async function publishAnnual(){
    const st=$('#meritAnnualFinalStatus35');
    if(!confirm('¿Publicar oficialmente al campeón anual? Para el ciclo 2026-2027 la publicación está reservada para la clausura del 9 de julio.'))return;
    try{
      const d=await rpc('teacher_merit_publish_annual_official',{p_cycle:cycle()});
      if(!d?.ok){
        if(d?.reason==='annual_publish_too_early')throw new Error('La publicación oficial se habilita el 9 de julio de 2027.');
        throw new Error(d?.reason||'No se pudo publicar.');
      }
      if(st)st.innerHTML='<span class="success">✓ Campeón anual publicado: Grupo '+esc(d.winner_group)+'.</span>';
      await loadAnnual();
    }catch(e){if(st)st.textContent='No se pudo publicar el campeón anual: '+(e.message||e)}
  }
  window.loadMeritAnnualRanking=loadAnnual;
  function wire(){
    ensureUI();
    $('#meritAnnualRefresh')?.addEventListener('click',e=>{e.preventDefault();loadAnnual()},true);
    document.querySelectorAll('.meritNav[data-merit-pane="annual"]').forEach(b=>b.addEventListener('click',()=>setTimeout(loadAnnual,100)));
    setTimeout(()=>{if($('#merit-annual')?.classList.contains('active'))loadAnnual()},1800);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
})();