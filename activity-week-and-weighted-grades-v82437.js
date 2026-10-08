/* Resolve UI events against the current functions, not startup-era references. */
(function(){
 function bindCurrent(){
  for(const id of ['actGroup','actWeek']){
   const el=document.getElementById(id);if(el)el.onchange=()=>Promise.resolve(refreshActivitySelectors()).catch(console.error);
  }
  const group=document.getElementById('gridGroup');if(group)group.onchange=()=>Promise.resolve(refreshGridWeeks()).catch(console.error);
  const week=document.getElementById('gridWeek');if(week)week.onchange=()=>Promise.resolve(renderActivityGrid()).catch(console.error);
  const select=document.getElementById('actSelect');if(select)select.onchange=()=>Promise.resolve(refreshActivityStats()).catch(console.error);
 }
 bindCurrent();window.addEventListener('load',bindCurrent);
 /* Keep grades on the 0–10 scale internally. Display their weighted contribution. */
 const originalResults=renderMethodologyResults;
 renderMethodologyResults=function(data){
  if(data?.methodology?.id!==document.getElementById('calcMethodology')?.value)return;
  const result=originalResults.apply(this,arguments);
  const table=document.querySelector('#methodologyResults .methodology-results-table');
  if(!table||!data?.methodology)return result;
  const criteria=data.methodology.criteria||[],rows=data.rows||[];
  const heads=table.querySelectorAll('thead th');
  criteria.forEach((c,i)=>{if(heads[i+2])heads[i+2].innerHTML=safe(c.name)+'<br>'+Number(c.percent)+'%<br><small>Aporte al promedio</small>'});
  table.querySelectorAll('tbody tr').forEach((tr,index)=>{
   const row=rows[index];if(!row)return;
   criteria.forEach((c,i)=>{
    const cell=tr.children[i+2],raw=row.criterionGrades?.[c.id];
    if(!cell)return;
    if(raw==null){cell.textContent='—';return;}
    const contribution=Number(raw)*Number(c.percent)/(window.StudentEvaluationRange?StudentEvaluationRange.weights(data.methodology,row.student.id,data.activities||[]).active:100);
    cell.textContent=contribution.toFixed(2);
    cell.title='Calificación '+Number(raw).toFixed(2)+' × '+Number(c.percent)+'% = '+contribution.toFixed(2);
   });
  });
  if(rows.some(r=>Math.abs(criteria.reduce((sum,c)=>sum+Number(r.criterionGrades?.[c.id]||0)*Number(c.percent)/(window.StudentEvaluationRange?StudentEvaluationRange.weights(data.methodology,r.student.id,data.activities||[]).active:100),0)-Number(r.base))>0.005)){
   const note=document.createElement('p');note.className='methodology-summary';note.textContent='Hay entregas o calificaciones distintas del promedio guardado. Pulsa Calcular para actualizar y guardar el promedio mensual; los puntos ya aplicados se conservan.';table.before(note);
  }
  return result;
 };
})();
