// Importa únicamente los registros centralizados de octubre al IndexedDB docente.
(function(){
const IDS=['76612d86-3b73-422d-9e5d-0ab6561c0bd3','3d1ec97e-85e2-4fd8-8d21-12b49a5f0071'];
let running=false;
async function sync(){
 if(running||!window.ProfeSupabase||typeof db==='undefined'||!db)return;
 running=true;
 try{
  for(const id of IDS){
   const rows=await window.ProfeSupabase.select('activity_records','select=activity_id,student_id,delivered,score,delivery_date&activity_id=eq.'+id+'&limit=1000');
   if(!Array.isArray(rows)||rows.length<180)throw Error('No se recibieron todos los registros del servidor.');
   for(const row of rows){
    const rec={key:id+'|'+row.student_id,activityId:id,studentId:String(row.student_id),timestamp:row.delivery_date||new Date().toISOString()};
    if(row.score!==null&&row.score!==undefined)rec.score=Number(row.score);
    if(row.delivered===true)rec.status='yes';
    else if(row.delivered===false)rec.status='no';
    await new Promise((resolve,reject)=>{const tx=db.transaction('activityRecords','readwrite');tx.objectStore('activityRecords').put(rec);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});
   }
  }
  if(typeof renderActivityGrid==='function')await renderActivityGrid();
  if(typeof refreshActivityStats==='function')refreshActivityStats().catch(()=>{});
 }catch(e){console.warn('Sincronización central de octubre pendiente:',e)}
 finally{running=false}
}
window.addEventListener('focus',()=>setTimeout(sync,1200));
window.addEventListener('online',()=>setTimeout(sync,1200));
setTimeout(sync,3500);
})();