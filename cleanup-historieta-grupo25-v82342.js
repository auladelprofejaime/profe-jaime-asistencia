// App Docente v8.23.42 · limpieza única de actividad duplicada del grupo 25
(function(){
  const KEEP_ID='53e74641-5616-41d7-a84e-fdbe2af2bea1';
  const DUP_ID='d6bb19bf-bf1e-4473-a257-1adc9514939e';
  const CLEAN_KEY='cleanup_hist_25_v82342';

  async function runCleanup(){
    try{
      if(localStorage.getItem(CLEAN_KEY)==='1')return;
      if(typeof db==='undefined'||!db||typeof all!=='function'||typeof put!=='function'||typeof del!=='function'){
        setTimeout(runCleanup,700);return;
      }

      const acts=await all('activities');
      const keep=acts.find(a=>String(a.id)===KEEP_ID);
      const dup=acts.find(a=>String(a.id)===DUP_ID);
      const records=await all('activityRecords');
      const related=records.filter(r=>String(r.activityId)===KEEP_ID||String(r.activityId)===DUP_ID);

      const delivered=new Map();
      for(const r of related){
        if(r?.status==='yes'){
          const sid=String(r.studentId||'');
          if(!sid)continue;
          const old=delivered.get(sid);
          const ts=String(r.timestamp||'');
          if(!old||(!old.timestamp&&ts)||(old.timestamp&&ts&&ts<old.timestamp)) delivered.set(sid,r);
        }
      }

      // Elimina todos los registros de ambas copias para reconstruir solo entregas válidas.
      for(const r of related){
        if(r?.key) await del('activityRecords',r.key);
      }

      // Reconstruye solo los "sí entregó" sobre la actividad que se conserva.
      for(const [sid,r] of delivered){
        const key=`${KEEP_ID}|${sid}`;
        await put('activityRecords',{
          key,
          activityId:KEEP_ID,
          studentId:sid,
          status:'yes',
          timestamp:r.timestamp||new Date().toISOString()
        });
      }

      // Asegura que quede una sola actividad y con el nombre correcto.
      if(dup) await del('activities',DUP_ID);
      if(keep){
        keep.name='Historieta variantes lingüísticas';
        keep.group='25';
        keep.shift='Matutino';
        keep.updated=new Date().toISOString();
        await put('activities',keep);
      }

      localStorage.setItem(CLEAN_KEY,'1');
      try{
        if($('#gridGroup')?.value==='25'){
          await refreshGridWeeks();
          await renderActivityGrid();
        }
      }catch(_){}
    }catch(e){
      console.warn('Limpieza Historieta grupo 25',e);
      setTimeout(runCleanup,1500);
    }
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(runCleanup,1200));
  else setTimeout(runCleanup,1200);
})();