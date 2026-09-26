/* App Docente v8.23.29 · Aclaraciones de movimientos de Mérito */
(function(){
  const $=s=>document.querySelector(s);
  const $$=s=>[...document.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const labels={cleanliness:'Limpieza',uniform:'Uniforme',punctuality:'Puntualidad',coexistence:'Convivencia',responsibility:'Responsabilidad',attitude:'Actitud',institutional_participation:'Participación institucional'};
  function restoreSession(){try{window.ProfeSupabase?.restore?.()}catch(_){}}
  async function rpc(name,args={}){restoreSession();if(!window.ProfeSupabase)throw new Error('Supabase no está disponible.');return await window.ProfeSupabase.rpc(name,args)}
  function fmt(v){if(!v)return '—';try{return new Date(v).toLocaleString('es-MX',{dateStyle:'short',timeStyle:'short'})}catch(_){return String(v)}}
  function pts(v){if(v===null||v===undefined)return 'Sin puntos';const n=Number(v);return n>0?'+'+n:String(n)}

  function openMeritPane(name){
    const meritTab=document.querySelector('[data-view="merit"]');
    if(meritTab)meritTab.click();
    setTimeout(()=>{
      const nav=$('.meritNav[data-merit-pane="'+name+'"]');
      if(nav)nav.click();
    },80);
  }

  function ensurePane(){
    const navBox=$('#merit .merit-nav'); if(!navBox)return null;
    let nav=$('.meritNav[data-merit-pane="corrections"]');
    if(!nav){
      nav=document.createElement('button');
      nav.type='button';nav.className='secondary meritNav';nav.dataset.meritPane='corrections';
      nav.innerHTML='⚠️ Aclaraciones <span id="meritCorrectionBadge29" class="badge hidden" style="margin-left:5px">0</span>';
      const movements=$('.meritNav[data-merit-pane="movements"]');
      if(movements?.nextSibling)navBox.insertBefore(nav,movements.nextSibling); else navBox.appendChild(nav);
    }
    let pane=$('#merit-corrections');
    if(!pane){
      pane=document.createElement('div');pane.id='merit-corrections';pane.className='merit-pane card';
      pane.innerHTML='<div class="section"><div><h2>⚠️ Aclaraciones pendientes</h2><p class="hint">Solicitudes enviadas por el personal cuando detecta un error en un movimiento del mismo día. La solicitud no cambia puntos hasta que tú la revises.</p></div><button id="meritCorrectionRefresh29" class="secondary" type="button">Actualizar</button></div><p id="meritCorrectionStatus29" class="message"></p><div id="meritCorrectionList29"></div>';
      const mov=$('#merit-movements');if(mov?.parentNode)mov.parentNode.insertBefore(pane,mov.nextSibling);else $('#merit')?.appendChild(pane);
    }
    if(!nav.dataset.wired29){
      nav.dataset.wired29='1';
      nav.addEventListener('click',()=>{
        $$('#merit .meritNav').forEach(b=>b.classList.remove('active'));
        $$('#merit .merit-pane').forEach(p=>p.classList.remove('active'));
        nav.classList.add('active');pane.classList.add('active');loadRequests();
      });
    }
    $$('#merit .meritNav:not([data-merit-pane="corrections"])').forEach(b=>{
      if(b.dataset.correctionHide29)return;b.dataset.correctionHide29='1';
      b.addEventListener('click',()=>pane.classList.remove('active'));
    });
    $('#meritCorrectionRefresh29').onclick=loadRequests;
    return pane;
  }

  async function countPending(){
    try{
      const rows=await rpc('teacher_merit_review_requests',{p_status:'pending'});
      const n=Array.isArray(rows)?rows.length:0;
      const badge=$('#meritCorrectionBadge29');
      if(badge){badge.textContent=String(n);badge.classList.toggle('hidden',n===0)}
      return n;
    }catch(_){return 0}
  }

  async function loadRequests(){
    ensurePane();
    const box=$('#meritCorrectionList29'),st=$('#meritCorrectionStatus29');
    if(!box)return;
    if(st)st.textContent='Cargando aclaraciones…';
    try{
      const rows=await rpc('teacher_merit_review_requests',{p_status:'pending'});
      const data=Array.isArray(rows)?rows:[];
      const badge=$('#meritCorrectionBadge29');if(badge){badge.textContent=String(data.length);badge.classList.toggle('hidden',!data.length)}
      if(!data.length){box.innerHTML='<div class="empty">No hay aclaraciones pendientes.</div>';if(st)st.textContent='';return}
      box.innerHTML=data.map(r=>{
        const cs=(Array.isArray(r.criteria)?r.criteria:[]).map(x=>labels[x]||x).join(', ');
        return '<div class="card" style="margin:10px 0;border:1px solid rgba(0,0,0,.14)"><div class="section"><div><b>'+esc(r.staff_name)+'</b><div class="hint">'+esc(fmt(r.requested_at))+' · Grupo '+esc(r.group_code)+' · '+esc(r.period_label)+'</div></div><span class="badge">Pendiente</span></div>'+
          '<p><b>El docente reportó:</b> '+esc(r.request_note)+'</p>'+
          '<div style="padding:10px 12px;border-radius:12px;background:#f7f7f7"><b>Movimiento:</b> '+esc(pts(r.points))+
          (r.reason?'<br><b>Motivo original:</b> '+esc(r.reason):'')+
          (cs?'<br><b>Reconocimientos:</b> '+esc(cs):'')+
          '<br><b>Capturado:</b> '+esc(fmt(r.captured_at))+'</div>'+
          '<div class="actions" style="margin-top:10px"><button class="primary meritCorrectionVoid29" type="button" data-id="'+esc(r.request_id)+'">Anular movimiento</button><button class="secondary meritCorrectionDismiss29" type="button" data-id="'+esc(r.request_id)+'">No procede</button></div></div>';
      }).join('');
      $$('.meritCorrectionVoid29').forEach(b=>b.onclick=()=>resolveRequest(b.dataset.id,'void'));
      $$('.meritCorrectionDismiss29').forEach(b=>b.onclick=()=>resolveRequest(b.dataset.id,'dismiss'));
      if(st)st.textContent='';
    }catch(e){box.innerHTML='';if(st)st.textContent='No se pudieron cargar las aclaraciones: '+(e.message||e)}
  }

  async function resolveRequest(id,action){
    const isVoid=action==='void';
    const message=isVoid
      ?'¿Anular el movimiento solicitado?\n\nEl registro permanecerá en el historial como anulado y dejará de contar en la clasificación.'
      :'¿Marcar esta aclaración como “No procede”?\n\nEl movimiento conservará sus puntos.';
    if(!confirm(message))return;
    let note=null;
    if(!isVoid){
      note=prompt('Nota opcional para dejar constancia de por qué no procede:','Solicitud revisada; no procede anulación.')||'Solicitud revisada; no procede anulación.';
    }
    const st=$('#meritCorrectionStatus29');if(st)st.textContent=isVoid?'Anulando movimiento…':'Cerrando aclaración…';
    try{
      const d=await rpc('teacher_merit_resolve_review_request',{p_request_id:id,p_action:action,p_note:note});
      if(!d?.ok){
        const msgs={period_not_open:'El periodo ya no está abierto y no admite cambios.',movement_not_valid:'Ese movimiento ya fue modificado.',request_already_resolved:'La solicitud ya fue atendida.'};
        throw new Error(msgs[d?.reason]||d?.reason||'No se pudo resolver la solicitud.');
      }
      if(st)st.innerHTML='<span class="success">✓ '+(isVoid?'Movimiento anulado y solicitud resuelta.':'Solicitud cerrada sin modificar el movimiento.')+'</span>';
      await loadRequests();
      try{if(typeof window.loadMeritMovements==='function')await window.loadMeritMovements()}catch(_){}
    }catch(e){if(st)st.textContent='No se pudo resolver: '+(e.message||e)}
  }

  function handlePushTarget(target){
    if(target==='merit_corrections')openMeritPane('corrections');
  }
  function wire(){
    restoreSession();ensurePane();
    setTimeout(countPending,1200);setTimeout(countPending,3500);
    window.addEventListener('focus',countPending);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')countPending()});
    if('serviceWorker'in navigator)navigator.serviceWorker.addEventListener('message',e=>handlePushTarget(e.data?.target));
    const q=new URLSearchParams(location.search).get('push');if(q)handlePushTarget(q);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
})();