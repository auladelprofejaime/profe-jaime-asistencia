(function(){
 const $=s=>document.querySelector(s);
 const LINK='https://auladelprofejaime.github.io/profe-jaime-asistencia/merito-votacion/';
 async function rpc(name,args={}){window.ProfeSupabase?.restore?.();if(!window.ProfeSupabase)throw new Error('No hay sesión administrativa');return window.ProfeSupabase.rpc(name,args)}
 function localParts(iso){
  if(!iso)return {date:'',time:'21:00'};
  const d=new Date(iso);
  const fmt=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Mexico_City',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(d);
  const [date,time]=fmt.split(' ');
  return {date,time};
 }
 function deadlineIso(){
  const date=$('#meritVotingCloseDate')?.value,time=$('#meritVotingCloseTime')?.value;
  if(!date||!time)throw new Error('Selecciona fecha y hora de cierre.');
  return date+'T'+time+':00-06:00';
 }
 function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
 async function loadPeriods(){
  const sel=$('#meritVotingPeriod');if(!sel)return;
  const periods=await rpc('teacher_merit_periods',{});
  if(!Array.isArray(periods))return;
  const old=sel.value;
  sel.innerHTML=periods.filter(p=>!String(p.label||'').toLowerCase().startsWith('prueba')).map(p=>'<option value="'+esc(p.id)+'">'+esc(p.label)+' · '+esc(p.status)+'</option>').join('');
  if([...sel.options].some(o=>o.value===old))sel.value=old;
  else{
   const oct=periods.find(p=>p.label==='Octubre 2026');
   if(oct)sel.value=oct.id;
  }
 }
 async function refresh(){
  const sel=$('#meritVotingPeriod'),box=$('#meritVotingSummary'),st=$('#meritVotingStatus');
  if(!sel?.value||!box)return;
  try{
   const d=await rpc('teacher_merit_category_vote_status',{p_period_id:sel.value});
   if(!d?.exists){
    box.innerHTML='<h3 style="margin-top:0">Sin votación abierta</h3><p class="hint">Configura una fecha y hora y presiona <b>Abrir votación de categorías</b>.</p><p><b>Enlace permanente:</b><br><a href="'+LINK+'" target="_blank" rel="noopener">'+LINK+'</a></p>';
    if(st)st.textContent='';
    return;
   }
   const parts=localParts(d.closes_at);
   if(parts.date)$('#meritVotingCloseDate').value=parts.date;
   if(parts.time)$('#meritVotingCloseTime').value=parts.time;
   const state=d.status==='open'?'ABIERTA':'CERRADA';
   const res=Array.isArray(d.results)?d.results:[];
   box.innerHTML='<h3 style="margin-top:0">Votación '+state+'</h3>'+
    '<p><b>Cierre programado:</b> '+esc(parts.date)+' · '+esc(parts.time)+' h</p>'+
    '<p><b>Docentes que han participado:</b> '+Number(d.teachers_participating||0)+' · <b>Votos registrados:</b> '+Number(d.votes_cast||0)+'</p>'+
    '<p><b>Enlace permanente:</b><br><a href="'+LINK+'" target="_blank" rel="noopener">'+LINK+'</a></p>'+
    (res.length?'<div class="tablewrap"><table><thead><tr><th>Categoría</th><th>Ganador</th><th>Votos</th><th>Resolución</th></tr></thead><tbody>'+res.map(r=>'<tr><td>'+esc(r.criterion_code)+'</td><td>Grupo '+esc(r.winner_group)+'</td><td>'+Number(r.votes||0)+'</td><td>'+esc(r.resolution_note||'')+'</td></tr>').join('')+'</tbody></table></div>':'');
   if(st)st.textContent='';
  }catch(e){if(st)st.textContent='No se pudo consultar la votación: '+(e.message||e)}
 }
 async function openVote(){
  const sel=$('#meritVotingPeriod'),st=$('#meritVotingStatus');
  if(!sel?.value)return;
  if(!confirm('¿Abrir la votación de categorías para este periodo con la fecha y hora indicadas?'))return;
  try{
   st.textContent='Abriendo votación…';
   const d=await rpc('teacher_merit_open_category_vote',{p_period_id:sel.value,p_closes_at:deadlineIso()});
   if(!d?.ok)throw new Error(d?.reason||'No se pudo abrir');
   st.innerHTML='<span class="success">✓ Votación activa.</span>';
   await refresh();
  }catch(e){st.textContent='Error: '+(e.message||e)}
 }
 async function updateDeadline(){
  const sel=$('#meritVotingPeriod'),st=$('#meritVotingStatus');
  if(!sel?.value)return;
  try{
   st.textContent='Actualizando cierre…';
   const d=await rpc('teacher_merit_update_category_vote_deadline',{p_period_id:sel.value,p_closes_at:deadlineIso()});
   if(!d?.ok)throw new Error(d?.reason||'No se pudo actualizar');
   st.innerHTML='<span class="success">✓ Nueva fecha y hora de cierre guardadas.</span>';
   await refresh();
  }catch(e){st.textContent='Error: '+(e.message||e)}
 }
 async function closeVote(){
  const sel=$('#meritVotingPeriod'),st=$('#meritVotingStatus');
  if(!sel?.value)return;
  if(!confirm('¿Cerrar ahora la votación de categorías? Se contarán los votos registrados y se aplicarán los criterios de desempate.'))return;
  try{
   st.textContent='Cerrando votación…';
   const d=await rpc('teacher_merit_close_category_vote_manual',{p_period_id:sel.value});
   if(!d?.ok)throw new Error(d?.reason||'No se pudo cerrar');
   st.innerHTML='<span class="success">✓ Votación cerrada y resultados calculados.</span>';
   await refresh();
  }catch(e){st.textContent='Error: '+(e.message||e)}
 }
 async function copyLink(){
  const st=$('#meritVotingStatus');
  try{await navigator.clipboard.writeText(LINK);st.innerHTML='<span class="success">✓ Enlace copiado.</span>'}
  catch(_){st.textContent=LINK}
 }
 async function init(){
  try{await loadPeriods();await refresh()}catch(_){}
  $('#meritVotingPeriod')?.addEventListener('change',refresh);
  $('#meritVotingRefresh')?.addEventListener('click',refresh);
  $('#meritVotingOpen')?.addEventListener('click',openVote);
  $('#meritVotingUpdateDeadline')?.addEventListener('click',updateDeadline);
  $('#meritVotingClose')?.addEventListener('click',closeVote);
  $('#meritVotingCopyLink')?.addEventListener('click',copyLink);
  document.querySelector('.meritNav[data-merit-pane="voting"]')?.addEventListener('click',()=>setTimeout(async()=>{await loadPeriods();await refresh()},80));
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();