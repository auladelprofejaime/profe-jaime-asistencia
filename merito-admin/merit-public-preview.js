(function(){
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const time=v=>v?new Date(v).toLocaleString('es-MX',{timeZone:'America/Mexico_City',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'Sin movimientos';
 async function preview(){
  const box=document.querySelector('#meritPublicPreview'),btn=document.querySelector('#meritPublicPreviewBtn');
  if(!box)return;
  if(!box.hidden){box.hidden=true;box.style.cssText='';btn.textContent='👁 Ver ranking público (sin horario)';return}
  box.hidden=false;box.style.cssText='position:fixed;z-index:99999;inset:4vh 3vw;background:#fff;color:#10213d;border:3px solid #c4a252;border-radius:16px;padding:18px;overflow:auto;box-shadow:0 0 0 100vmax rgba(0,0,0,.65);';box.innerHTML='<button id="closePublicPreview" type="button" style="position:sticky;top:0;float:right;z-index:2;background:#092344;color:white;padding:12px;border-radius:10px;cursor:pointer">✕ Cerrar vista</button><p>Consultando ranking…</p>';box.querySelector('#closePublicPreview').onclick=()=>{box.hidden=true;box.style.cssText='';btn.textContent='👁 Ver ranking público (sin horario)'};btn.textContent='Ocultar vista pública';
  try{
   const period=document.querySelector('#meritRankingPeriod')?.value;
   if(!period)throw new Error('Selecciona un periodo.');
   // Verifica permiso administrativo antes de mostrar la vista sin restricción horaria.
   await window.ProfeSupabase.rpc('teacher_merit_ranking',{p_period_id:period});
   const d=await window.ProfeSupabase.rpc('merit_live_ranking',{});
   const rows=Array.isArray(d?.ranking)?d.ranking:[];
   if(d?.state==='results_in_process'){box.textContent='El ranking público está temporalmente en revisión.';return}
   if(d?.state==='official'){box.innerHTML='<h3>Resultado oficial</h3><p>Grupo '+esc(d.official_result?.overall_winner)+' · '+esc(d.official_result?.overall_score)+' puntos</p>';return}
   box.innerHTML='<button id="closePublicPreview" type="button" style="position:sticky;top:0;float:right;z-index:2;background:#092344;color:white;padding:12px;border-radius:10px;cursor:pointer">✕ Cerrar vista</button><h3>Vista pública · '+esc(d?.period?.label||'Periodo actual')+'</h3><p class="hint">Acceso exclusivo de administración; el bloqueo escolar del portal público permanece activo.</p>'+
    (rows.length?'<table><thead><tr><th>Lugar</th><th>Grupo</th><th>Puntos</th><th>Último positivo</th><th>Último negativo</th></tr></thead><tbody>'+rows.map(x=>'<tr><td>'+esc(x.rank)+'.º</td><td>'+esc(x.group_code)+'</td><td>'+esc(x.score)+'</td><td>'+esc(time(x.last_positive_at))+'</td><td>'+esc(time(x.last_negative_at))+'</td></tr>').join('')+'</tbody></table>':'<p>Sin grupos disponibles.</p>');
   box.querySelector('#closePublicPreview')?.addEventListener('click',()=>{box.hidden=true;box.style.cssText='';btn.textContent='👁 Ver ranking público (sin horario)'})
  }catch(e){box.textContent='No se pudo consultar: '+(e.message||e)}
 }
 document.addEventListener('DOMContentLoaded',()=>document.querySelector('#meritPublicPreviewBtn')?.addEventListener('click',preview));
})();