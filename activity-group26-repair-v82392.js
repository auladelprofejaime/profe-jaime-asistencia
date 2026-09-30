// App Docente v8.23.92 · reparación puntual de las 4 actividades faltantes de Grupo 26
(function(){
  const TARGETS=new Set([
    'repeticiones 280926',
    'actividad patrimonio cultural',
    'dictado 280926',
    'investigación de lengua originaria'
  ]);

  function normTitle(v){
    return String(v||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  }

  function isTarget(a){
    return String(a?.group||'')==='26'
      && String(a?.shift||'').toLowerCase().includes('matut')
      && [...TARGETS].some(t=>normTitle(a?.name)===normTitle(t));
  }

  function remoteActivityRow(a){
    return {
      id:String(a.id),
      group_name:a.group||'',
      shift:a.shift||'',
      title:a.name||'Actividad',
      activity_date:a.date||null,
      due_date:a.dueDate||null,
      evaluation_type:a.evaluationMode||'delivery',
      max_score:10,
      visible_to_students:true,
      closed:!!a.closed,
      data:a
    };
  }

  function remoteRecordRow(r){
    return {
      activity_id:String(r.activityId||String(r.key||'').split('|')[0]),
      student_id:String(r.studentId||String(r.key||'').split('|')[1]),
      delivered:r.status==='yes'?true:r.status==='no'?false:null,
      score:typeof r.score==='number'?r.score:null,
      delivery_date:r.timestamp||r.deliveryDate||null,
      observations:r.observations||null,
      data:r
    };
  }

  async function repairGroup26MissingActivities(){
    try{
      if(!window.ProfeSupabase||!window.indexedDB)return;
      if(typeof all!=='function'||typeof sameShift!=='function')return;

      const localActs=(await all('activities')).filter(isTarget);
      if(!localActs.length)return;

      const remote=await window.ProfeSupabase.select(
        'activities',
        'select=id,title,group_name,shift&group_name=eq.26&shift=eq.Matutino'
      );
      const remoteIds=new Set((remote||[]).map(x=>String(x.id)));
      const missing=localActs.filter(a=>!remoteIds.has(String(a.id)));
      if(!missing.length)return;

      // Primero restaura las actividades con SUS IDs originales.
      await window.ProfeSupabase.upsert('activities',missing.map(remoteActivityRow),'id');

      // Después restaura sus registros; nunca antes, para respetar la llave foránea.
      const ids=new Set(missing.map(a=>String(a.id)));
      const localRecords=(await all('activityRecords')).filter(r=>ids.has(String(r.activityId||'')));
      if(localRecords.length){
        for(let i=0;i<localRecords.length;i+=60){
          const out=await window.ProfeSupabase.rpc('teacher_activity_records_merge_safe',{
            p_rows:localRecords.slice(i,i+60).map(remoteRecordRow)
          });
          if(out?.ok===false)throw new Error(out?.error||out?.reason||'No se pudieron restaurar los registros.');
        }
      }

      try{
        const names=missing.map(a=>a.name).join(', ');
        supaState('✓ Se reparó Grupo 26 en el servidor: '+missing.length+' actividad'+(missing.length===1?'':'es')+' recuperada'+(missing.length===1?'':'s')+'.',true);
        console.info('Grupo 26 reparado',names);
      }catch(_){}
    }catch(e){
      console.error('Reparación Grupo 26',e);
      try{supaState('⚠️ No se pudo completar la reparación de las actividades faltantes de Grupo 26: '+(e?.message||e),false)}catch(_){}
    }
  }

  window.addEventListener('load',()=>setTimeout(repairGroup26MissingActivities,2500),{once:true});
})();