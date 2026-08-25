const SUPABASE_URL="https://xqeyyjakmeiaahecfdmc.supabase.co", SUPABASE_KEY="sb_publishable_GY2NGAigumnZw3rIJKU7LA_a2qigAEA";
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let data=null,grade='all';
async function rpc(name,args={}){const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`,{method:'POST',cache:'no-store',headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(args)});const t=await r.text();let d;try{d=t?JSON.parse(t):null}catch{d=t}if(!r.ok)throw new Error(t||r.status);return d}
function render(){
 const ranking=$('#ranking'),state=$('#stateBox');ranking.innerHTML='';state.classList.add('hidden');
 $('#periodName').textContent=data?.period||'Sin periodo publicado';
 const published=data?.published_at||data?.official_result?.published_at;
 $('#updated').textContent=published?`Última actualización: ${new Date(published).toLocaleString('es-MX',{dateStyle:'medium',timeStyle:'short'})}`:'';
 if(!data?.ok){state.classList.remove('hidden');state.innerHTML='<div class="empty">No se pudo consultar el avance.</div>';return}
 if(data.state==='frozen'||data.state==='results_in_process'){state.classList.remove('hidden');state.innerHTML='<div class="empty"><h2>Resultados en proceso</h2><p>La clasificación se encuentra en revisión. El resultado oficial se publicará cuando la administración lo determine.</p></div>';return}
 if(data.state==='official'&&data.official_result){
   const o=data.official_result;
   const labels={cleanliness:'Limpieza',uniform:'Uniforme',punctuality:'Puntualidad',coexistence:'Convivencia',responsibility:'Responsabilidad',attitude:'Actitud',institutional_participation:'Participación institucional'};
   state.classList.remove('hidden');
   state.innerHTML=`<div class="empty"><div style="font-size:.85rem;font-weight:800">RESULTADO OFICIAL</div><h2>🏆 Grupo ${escapeHtml(o.overall_winner||'—')}</h2><p><b>${Number(o.overall_score||0)} puntos</b></p><h3>Reconocimientos del mes</h3><div class="officialCats">${(o.categories||[]).map(c=>`<div class="officialCat"><b>${escapeHtml(labels[c.criterion]||c.criterion)}</b><div>Grupo ${escapeHtml(c.group)}</div></div>`).join('')}</div></div>`;
   return;
 }
 const rows=(data.ranking||[]).filter(x=>grade==='all'||String(x.grade)===grade);
 if(!rows.length){state.classList.remove('hidden');state.innerHTML='<div class="empty"><h2>Aún no hay un corte publicado</h2><p>Vuelve a consultar cuando se publique el siguiente avance semanal.</p></div>';return}
 ranking.innerHTML=rows.map(x=>`<div class="rankrow ${Number(x.position)===1?'top1':''}"><div class="rank">${x.position}.º</div><div class="grp">Grupo ${x.group}</div><div class="score">${x.points} pts</div></div>`).join('');
 if(data.message){state.classList.remove('hidden');state.innerHTML=`<b>Aviso:</b> ${escapeHtml(data.message)}`}
}
$$('#filters button').forEach(b=>b.onclick=()=>{grade=b.dataset.grade;$$('#filters button').forEach(x=>x.classList.toggle('active',x===b));render()});
function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c])}

function formatMeritTime(v){
  if(!v)return '—';
  const [hh,mm]=String(v).slice(0,5).split(':').map(Number);
  const d=new Date();
  d.setHours(hh,mm,0,0);
  return d.toLocaleTimeString('es-MX',{hour:'numeric',minute:'2-digit'});
}
async function checkMeritPublicAccess(){
  try{
    const a=await rpc('merit_public_access_status');
    const block=$('#schoolHoursBlock');
    const main=$('#publicMain');

    if(a?.blocked){
      $('#schoolHoursTitle').textContent=a.message_title||'¡Ahora no, joven!';
      $('#schoolHoursMessage').textContent=
        'Este portal está diseñado para consultarse fuera del horario de clases. Durante la jornada escolar, tu atención debe estar en tus clases, actividades y profesores, no en el celular.';
      $('#schoolHoursOpenTime').textContent=formatMeritTime(a.next_open);
      block.classList.remove('hidden');
      main.classList.add('hidden');
      return false;
    }

    block.classList.add('hidden');
    main.classList.remove('hidden');
    return true;
  }catch(e){
    // Si falla solo la consulta del horario, no mostramos datos hasta reintentar.
    const block=$('#schoolHoursBlock');
    const main=$('#publicMain');
    block.classList.remove('hidden');
    main.classList.add('hidden');
    $('#schoolHoursTitle').textContent='Portal temporalmente no disponible';
    $('#schoolHoursMessage').textContent='No se pudo comprobar el horario de acceso. Intenta nuevamente en unos momentos.';
    $('#schoolHoursOpenTime').textContent='—';
    return false;
  }
}
async function loadMeritPublicPortal(){
  const allowed=await checkMeritPublicAccess();
  if(!allowed)return;
  try{
    data=await rpc('merit_public_latest');
    render();
  }catch(e){
    data={ok:false};
    render();
  }
}

loadMeritPublicPortal();
if('serviceWorker'in navigator)navigator.serviceWorker.register('service-worker-v13.js?v=13').catch(()=>{});

setInterval(loadMeritPublicPortal,60000);
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible')loadMeritPublicPortal();
});
