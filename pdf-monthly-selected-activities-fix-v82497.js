// Ensure the report renderer receives the exact selected activities from the monthly grid.
// Loaded after all other activity modules so later overrides cannot replace this reconciliation.
(function(){
 if(typeof weeklyReportData!=='function'||typeof currentWeekActivities!=='function')return;
 const original=weeklyReportData;
 weeklyReportData=async function(selectedIds=null,fromDate=null,toDate=null){
   const result=await original.apply(this,arguments);
   if(!Array.isArray(selectedIds)||!selectedIds.length)return result;
   const wanted=new Set(selectedIds.map(String));
   const month=document.querySelector('#gridWeek')?.value||'';
   const monthInRange=month&&(!fromDate||month>=String(fromDate).slice(0,7))&&(!toDate||month<=String(toDate).slice(0,7));
   const visible=monthInRange?await currentWeekActivities():[];
   const local=await all('activities');
   const found=new Map();
   for(const a of [...(result.acts||[]),...visible,...local]){
     if(wanted.has(String(a.id)))found.set(String(a.id),a);
   }
   result.acts=selectedIds.map(id=>found.get(String(id))).filter(Boolean);
   const records=await all('activityRecords');
   result.map=new Map(records.map(r=>[String(r.key||r.activityId+'|'+r.studentId),r]));
   console.info('PDF actividades seleccionadas:',selectedIds.length,'incluidas:',result.acts.length);
   if(result.acts.length!==selectedIds.length){
     alert('El PDF no puede incluir '+(selectedIds.length-result.acts.length)+' actividades seleccionadas. No se generará un reporte incompleto.');
     throw new Error('Faltan actividades seleccionadas en la fuente del PDF');
   }
   return result;
 };
})();
