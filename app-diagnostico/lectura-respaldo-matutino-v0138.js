// Respaldo conservador de tiempos matutinos: nunca elimina ni sobrescribe datos locales o remotos.
(function(){
  let busy=false;
  async function backup(){
    if(busy||!accessToken||!activePeriod?.id||typeof lecturaAuditAllLocalTimes!=='function')return;
    busy=true;
    try{
      const audit=lecturaAuditAllLocalTimes().filter(r=>String(r.periodId)===String(activePeriod.id)&&!String(r.studentId||'').startsWith('V')&&Number.isInteger(Number(r.seconds))&&Number(r.seconds)>0);
      const byKey=new Map();
      for(const r of audit){
        const key=String(r.studentId)+'::'+String(r.moment||'initial');
        if(!byKey.has(key)||r.source==='registro')byKey.set(key,r);
      }
      if(!byKey.size)return;
      const rows=[...byKey.values()].map(r=>({student_id:String(r.studentId),group_name:String(r.group||''),moment:String(r.moment||'initial'),test_code:null,reading_seconds:Number(r.seconds),captured_at:r.when?new Date(Number(r.when)).toISOString():new Date().toISOString()}));
      const result=await rpc('teacher_diagnostic_lectura_times_backup',{p_period_id:activePeriod.id,p_rows:rows});
      const cloud=await rpc('teacher_diagnostic_lectura_times',{p_period_id:activePeriod.id});
      const verified=rows.filter(r=>(cloud||[]).some(c=>String(c.student_id)===r.student_id&&String(c.moment)===r.moment&&Number(c.reading_seconds)===r.reading_seconds));
      console.info('Lectura matutina: respaldo sin sobrescritura',{local:rows.length,verified:verified.length,inserted:result?.inserted||0});
      if(verified.length!==rows.length)console.warn('Lectura matutina: algunos registros no coinciden; originales locales intactos.');
    }catch(e){console.warn('Respaldo matutino no completado; originales locales intactos',e)}
    finally{busy=false}
  }
  const original=typeof openPeriod==='function'?openPeriod:null;
  if(original)openPeriod=async function(...args){const v=await original.apply(this,args);await backup();return v};
  window.addEventListener('load',()=>setTimeout(backup,1800));
})();