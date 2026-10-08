/* September-only server-owned exception. New months do not inherit the rule. */
(()=>{
'use strict';
const q=id=>document.getElementById(id);
function schoolRound(value){const n=Math.min(10,Math.max(0,Number(value)||0)),b=Math.floor(n+1e-9);return Math.min(10,n-b>=.6-1e-9?b+1:b)}
function normalBase(g){return Math.min(10,Math.max(5,schoolRound(Number(g.base||0)+Number(g.manualExtra||0))))}
function pointBase(g){return g.pointsApplicationRule==='final_grade'?normalBase(g):Number(g.base||0)+Number(g.manualExtra||0)}
window.FinalGradePoints={normalBase,pointBase,schoolRound};
const oldRender=renderMethodologyResults;
renderMethodologyResults=function(data){
 const m=data?.methodology,exception=m?.pointsApplicationRule==='final_grade';
 if(exception)for(const row of data.rows||[]){
  const normal=normalBase(row),final=Math.min(10,normal+Number(row.pointsUsed||0)),rounded=Math.max(5,schoolRound(final));
  Object.assign(row,{final,finalDecimal:final,obtainedAverage:final,rounded,monthlyGrade:rounded});
 }
 const result=oldRender.apply(this,arguments);
 if(exception&&m.id===q('calcMethodology')?.value){
  const box=q('methodologyResults'),note=document.createElement('p');note.className='methodology-summary';note.textContent='Excepción solo de esta evaluación: calificación normal (redondeada, mínimo 5) + puntos aplicados, máximo 10. Las siguientes evaluaciones conservan su regla normal.';box.prepend(note);
  box.querySelectorAll('.methodology-results-table tbody tr').forEach((tr,i)=>{const row=data.rows[i];if(!row)return;const label=document.createElement('small');label.style.display='block';label.textContent='Calificación antes de puntos: '+normalBase(row);tr.children[1]?.append(label)});
 }
 return result;
};
const oldCalculate=calculateMethodology;
calculateMethodology=async function(){
 const id=q('calcMethodology')?.value;
 if(id){const rows=await ProfeSupabase.select('methodologies','select=*&id=eq.'+encodeURIComponent(id));if(!rows?.length)throw Error('No se pudo consultar la metodología.');const r=rows[0];await req(store('methodologies','readwrite').put({...r.data,id:r.id,group:r.group_name,shift:r.shift,month:r.month,cycle:r.cycle,quarter:r.quarter,closed:r.closed}));}
 return oldCalculate.apply(this,arguments);
};
window.addEventListener('load',()=>{if(q('calculateMethodologyBtn'))q('calculateMethodologyBtn').onclick=()=>calculateMethodology().catch(e=>{if(q('savedGradeStatus'))q('savedGradeStatus').textContent=e.message||e;alert(e.message||e)})});
})();
