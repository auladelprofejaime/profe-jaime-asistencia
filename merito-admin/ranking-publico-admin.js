(function(){
 const $=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const time=v=>v?new Date(v).toLocaleString('es-MX',{timeZone:'America/Mexico_City',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'Sin movimientos';
 async function load(){
  try{
   const periods=await window.ProfeSupabase.rpc('teacher_merit_periods',{});
   if(!Array.isArray(periods))throw new Error('No se autorizó la consulta administrativa.');
   const period=periods.find(p=>p.status==='open')||periods[0];
   if(!period)throw new Error('No hay periodos disponibles.');
   const ranking=await window.ProfeSupabase.rpc('teacher_merit_ranking',{p_period_id:period.id});
   const d={period,ranking:Array.isArray(ranking)?ranking:[],category_leaders:[],state:'live'};
   $('#periodName').textContent=d?.period?.label||'Sin periodo abierto';
   $('#updated').textContent='Actualizado '+new Date().toLocaleTimeString('es-MX',{timeZone:'America/Mexico_City'});
   if(d?.state==='results_in_process'){$('#leaderNow').textContent='Se están revisando los puntos';$('#ranking').innerHTML='';$('#remainingRanking').style.display='none';return}
   if(d?.state==='official'){$('#leaderNow').innerHTML='<div class="leaderCrown">🏆</div><div class="leaderLabel">GANADOR OFICIAL</div><div class="leaderGroup">Grupo '+esc(d.official_result?.overall_winner)+'</div><div class="leaderPoints">'+esc(d.official_result?.overall_score)+' puntos</div>';$('#remainingRanking').style.display='none';return}
   const rows=Array.isArray(d?.ranking)?d.ranking:[],cats=Array.isArray(d?.category_leaders)?d.category_leaders:[];
   const win=rows.find(x=>Number(x.rank)===1);
   $('#leaderNow').innerHTML=win?'<div class="leaderCrown">🏆</div><div class="leaderLabel">1.er lugar hasta el momento</div><div class="leaderGroup">Grupo '+esc(win.group_code)+'</div><div class="leaderPoints">'+esc(win.score)+' puntos</div>':'Sin puntuaciones registradas';
   $('#ranking').innerHTML=rows.filter(x=>Number(x.rank)<=3).map(x=>'<div class="rankrow top'+esc(x.rank)+'"><div class="rank">'+esc(x.rank)+'.º</div><div class="grp">Grupo '+esc(x.group_code)+'</div><div class="score">'+esc(x.score)+' pts</div></div>').join('');
   const rest=rows.filter(x=>Number(x.rank)>3);
   $('#remainingRanking').style.display=rest.length?'':'none';
   $('#remainingRows').innerHTML=rest.map(x=>'<div class="rankrow"><div class="rank">'+esc(x.rank)+'.º</div><div class="grp">Grupo '+esc(x.group_code)+'<div class="meritLastMoves">➕ '+esc(time(x.last_positive_at))+' · ➖ '+esc(time(x.last_negative_at))+'</div></div><div class="score">'+esc(x.score)+' pts</div></div>').join('');
   $('#categories').innerHTML=cats.map(x=>'<div class="categoryTile"><div class="categoryName">'+esc(x.category)+'</div><div class="categoryWinner">🥇 Grupo '+esc(x.group_code)+'</div><div class="categoryScore">'+esc(x.score)+' reconocimientos</div></div>').join('');
  }catch(e){$('#leaderNow').textContent='No se pudo abrir la página: '+(e.message||e)+'. Vuelve a administración e inicia sesión.'}
 }
 load();setInterval(load,15000);
})();