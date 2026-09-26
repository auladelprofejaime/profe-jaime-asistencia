/* App Docente v8.23.30 · Clasificación Mérito robusta y caché offline */
(function(){
  const $=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const CACHE_PREFIX='meritRankingCacheV82330:';
  const labels={
    cleanliness:'Limpieza',uniform:'Uniforme',punctuality:'Puntualidad',
    coexistence:'Convivencia',responsibility:'Responsabilidad',attitude:'Actitud',
    institutional_participation:'Participación institucional'
  };
  const nativeAlert=window.alert.bind(window);

  // Suprime únicamente el aviso viejo y engañoso de clasificación.
  window.alert=function(msg){
    const s=String(msg||'');
    if(s.startsWith('No se pudo cargar la clasificación:')) return;
    return nativeAlert(msg);
  };

  function cacheKey(id){return CACHE_PREFIX+String(id||'')}
  function saveCache(id,rows){
    try{localStorage.setItem(cacheKey(id),JSON.stringify({saved_at:new Date().toISOString(),rows}))}catch(_){}
  }
  function readCache(id){
    try{return JSON.parse(localStorage.getItem(cacheKey(id))||'null')}catch(_){return null}
  }
  function restoreSession(){try{window.ProfeSupabase?.restore?.()}catch(_){}}
  async function rpc(name,args={}){
    restoreSession();
    if(!window.ProfeSupabase)throw new Error('Supabase no está disponible.');
    // token() refresca la sesión si ya venció y existe refresh token
    try{await window.ProfeSupabase.token?.()}catch(_){}
    return await window.ProfeSupabase.rpc(name,args);
  }
  function criteriaSummary(obj){
    if(!obj||typeof obj!=='object')return '—';
    const parts=Object.entries(obj).filter(([,n])=>Number(n)>0).map(([k,n])=>(labels[k]||k)+': '+n);
    return parts.length?parts.join(' · '):'—';
  }
  function render(rows,offlineMeta=null){
    const box=$('#meritRankingTable'); if(!box)return;
    if(!Array.isArray(rows)||!rows.length){box.innerHTML='<p class="hint">No hay datos para mostrar.</p>';return;}
    box.innerHTML=(offlineMeta?'<p class="hint"><b>Vista sin conexión:</b> mostrando la última clasificación guardada'+(offlineMeta.saved_at?' ('+esc(new Date(offlineMeta.saved_at).toLocaleString('es-MX'))+')':'')+'.</p>':'')+
      '<table><thead><tr><th>Lugar</th><th>Grupo</th><th>Puntos</th><th>Reconocimientos</th></tr></thead><tbody>'+
      rows.map(r=>'<tr><td><b>'+esc(r.rank??'—')+'</b></td><td><b>'+esc(r.group_code??'')+'</b></td><td>'+esc(r.score??0)+'</td><td><small>'+esc(criteriaSummary(r.criteria))+'</small></td></tr>').join('')+
      '</tbody></table>';
  }
  function showError(message){
    const box=$('#meritRankingTable'); if(!box)return;
    box.innerHTML='<div class="message"><b>No se pudo actualizar la clasificación.</b><br>'+esc(message)+'</div>';
  }

  async function loadMeritRankingRobust(){
    const sel=$('#meritRankingPeriod'),id=sel?.value||'';
    if(!id){showError('Selecciona un periodo.');return}
    const cached=readCache(id);

    if(!navigator.onLine){
      if(cached?.rows?.length){render(cached.rows,cached);return}
      showError('Este dispositivo está sin internet y todavía no existe una clasificación guardada para este periodo. Conéctate una vez para descargarla.');
      return;
    }

    const box=$('#meritRankingTable');
    if(box)box.innerHTML='<p class="hint">Actualizando clasificación…</p>';
    try{
      const rows=await rpc('teacher_merit_ranking',{p_period_id:id});
      if(!Array.isArray(rows))throw new Error('La respuesta de clasificación no tiene el formato esperado.');
      saveCache(id,rows);
      render(rows);
    }catch(e){
      const msg=String(e?.message||e||'');
      if(cached?.rows?.length){
        render(cached.rows,cached);
        const note=document.createElement('p');
        note.className='message';
        note.textContent=/sesión|session|autoriz|auth/i.test(msg)
          ?'No se pudo renovar la sesión de Supabase. Se muestra la última copia guardada.'
          :'No se pudo actualizar desde Supabase. Se muestra la última copia guardada.';
        box?.prepend(note);
        return;
      }
      if(/sesión|session|autoriz|auth|inicia sesión/i.test(msg)){
        showError('La sesión de Supabase necesita reconectarse. Vuelve a Inicio e inicia sesión; tus datos no se han perdido.');
      }else{
        showError(msg||'No hubo respuesta de Supabase. Revisa la conexión e inténtalo otra vez.');
      }
    }
  }

  function wire(){
    window.loadMeritRanking=loadMeritRankingRobust;
    const btn=$('#meritRefreshRanking');
    if(btn){
      btn.onclick=null;
      btn.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();loadMeritRankingRobust()},true);
    }
    const sel=$('#meritRankingPeriod');
    if(sel)sel.addEventListener('change',()=>loadMeritRankingRobust(),true);

    document.querySelectorAll('.meritNav[data-merit-pane="ranking"]').forEach(b=>{
      b.addEventListener('click',()=>setTimeout(loadMeritRankingRobust,100),true);
    });
    document.querySelectorAll('[data-view="merit"]').forEach(b=>{
      b.addEventListener('click',()=>setTimeout(()=>{
        if($('#merit-ranking')?.classList.contains('active'))loadMeritRankingRobust();
      },220),true);
    });
    window.addEventListener('online',()=>setTimeout(loadMeritRankingRobust,120));
    setTimeout(()=>{if($('#merit-ranking')?.classList.contains('active'))loadMeritRankingRobust()},2000);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
})();