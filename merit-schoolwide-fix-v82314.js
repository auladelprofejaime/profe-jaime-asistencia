// Hotfix v8.23.14 · Mérito Gabino A. Palma · clasificación única de toda la escuela
(function(){
  function renderSchoolwideRanking(){
    const box=document.getElementById('meritRankingTable');
    if(!box)return;
    const rows=Array.isArray(window.meritRankingCache)?window.meritRankingCache:
      (typeof meritRankingCache!=='undefined'&&Array.isArray(meritRankingCache)?meritRankingCache:[]);
    if(!rows.length){
      box.innerHTML='<p class="hint">Aún no hay grupos para mostrar en este periodo.</p>';
      return;
    }
    box.innerHTML='<table><thead><tr><th>Pos.</th><th>Grupo</th><th>Puntos</th><th>Reconocimientos del mes</th></tr></thead><tbody>'+
      rows.map(r=>'<tr><td><b>'+Number(r.rank||0)+'</b></td><td><b>'+safe(r.group_code)+'</b></td><td class="merit-stat">'+Number(r.score||0)+'</td><td>'+safe(meritCriteriaText(r.criteria))+'</td></tr>').join('')+
      '</tbody></table>';
  }

  function renderSchoolwideAnnual(){
    const box=document.getElementById('meritAnnualTable');
    if(!box)return;
    const rows=Array.isArray(window.meritAnnualCache)?window.meritAnnualCache:
      (typeof meritAnnualCache!=='undefined'&&Array.isArray(meritAnnualCache)?meritAnnualCache:[]);
    box.innerHTML=rows.length?
      '<table><thead><tr><th>Lugar</th><th>Grupo</th><th>Puntos acumulados</th><th>Meses cerrados</th></tr></thead><tbody>'+
      rows.map(x=>'<tr><td><b>'+Number(x.rank)+'.º</b></td><td><b>'+safe(x.group_code)+'</b></td><td>'+Number(x.annual_score||0)+'</td><td>'+Number(x.months_closed||0)+'</td></tr>').join('')+
      '</tbody></table>':
      '<p class="hint">Aún no hay meses cerrados en este ciclo escolar.</p>';
  }

  // Sustituye únicamente la presentación: el backend ya calcula un solo ranking escolar.
  window.renderMeritRanking=renderSchoolwideRanking;
  window.renderMeritAnnualRanking=renderSchoolwideAnnual;
  try{ renderMeritRanking=renderSchoolwideRanking; }catch(_){}
  try{ renderMeritAnnualRanking=renderSchoolwideAnnual; }catch(_){}
  try{ meritGradeFilter='all'; }catch(_){}
  try{ meritAnnualGrade='all'; }catch(_){}

  function cleanLegacyGradeFilters(){
    document.querySelectorAll('#merit-ranking .merit-filter, #merit-annual .merit-filter').forEach(el=>el.remove());
  }
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',cleanLegacyGradeFilters);
  }else cleanLegacyGradeFilters();
})();