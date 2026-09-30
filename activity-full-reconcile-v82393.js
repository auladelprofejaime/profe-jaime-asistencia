// App Docente v8.23.93 · conciliación real de Actividades iPad ↔ Supabase
(function(){
  const GROUPS=new Set(['21','22','23','24','25','26']);
  const FROM='2026-08-31';
  let running=false;
  let lastResult=null;
  let retryTimer=null;

  function relevantActivity(a){
    const g=String(a?.group||a?.group_name||'').trim();
    const sh=String(a?.shift||'').trim().toLowerCase();
    const d=String(a?.date||a?.activity_date||'');
    return GROUPS.has(g)&&sh==='matutino'&&d>=FROM;
  }
  function recKey(aid,sid){return String(aid)+'|'+String(sid)}
  function deliveredOfLocal(r){
    if(r?.status==='yes')return true;
    if(r?.status==='no')return false;
    return null;
  }
  function numOrNull(v){return typeof v==='number'&&Number.isFinite(v)?v:null}
  function remoteActivityRow(a){
    return {
      id:String(a.id),
      group_name:String(a.group||''),
      shift:String(a.shift||''),
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
      delivered:deliveredOfLocal(r),
      score:numOrNull(r.score),
      delivery_date:r.timestamp||r.deliveryDate||new Date().toISOString(),
      observations:r.observations||null,
      data:r
    };
  }
  function comparableLocal(r){
    const status=String(r?.status||'').toLowerCase();
    return status==='yes'||status==='no'||numOrNull(r?.score)!==null;
  }
  function setState(msg,ok=false){
    try{supaState(msg,ok)}catch(_){}
  }
  async function waitReady(maxMs=25000){
    const start=Date.now();
    while(Date.now()-start<maxMs){
      try{
        if(window.ProfeSupabase && typeof all==='function' && typeof supabaseReady!=='undefined' && supabaseReady)return true;
      }catch(_){}
      await new Promise(r=>setTimeout(r,750));
    }
    return false;
  }
  async function fetchRemoteActivities(){
    const rows=[];
    for(const g of GROUPS){
      const part=await window.ProfeSupabase.select(
        'activities',
        'select=id,title,group_name,shift,activity_date,due_date,evaluation_type,visible_to_students,closed&group_name=eq.'+encodeURIComponent(g)+'&shift=eq.Matutino'
      );
      if(Array.isArray(part))rows.push(...part);
    }
    return rows;
  }
  async function fetchRemoteRecords(){
    const out=await window.ProfeSupabase.rpc('teacher_activity_records_audit',{p_group_name:null});
    if(Array.isArray(out))return out;
    if(out?.error)throw new Error(out.error);
    return out||[];
  }
  async function upsertActivities(rows){
    for(let i=0;i<rows.length;i+=30){
      await window.ProfeSupabase.upsert('activities',rows.slice(i,i+30).map(remoteActivityRow),'id');
    }
  }
  async function insertOnlyMissingRecords(rows,remoteRows){
    const remoteKeys=new Set((remoteRows||[]).map(r=>recKey(r.activity_id,r.student_id)));
    const missing=(rows||[]).filter(r=>!remoteKeys.has(recKey(r.activityId,r.studentId)));
    for(let i=0;i<missing.length;i+=50){
      const block=missing.slice(i,i+50).map(remoteRecordRow);
      const out=await window.ProfeSupabase.rpc('teacher_activity_records_merge_safe',{p_rows:block});
      if(out?.ok===false)throw new Error(out?.error||out?.reason||'No se pudo confirmar un bloque de registros faltantes.');
    }
    return missing.length;
  }

  async function reconcileActivities({manual=false}={}){
    if(running)return lastResult;
    running=true;
    try{
      const ready=await waitReady();
      if(!ready)throw new Error('Supabase todavía no está listo.');

      if(manual)setState('🔄 Verificando Actividades con Supabase…');

      const [localActsAll,localRecsAll]=await Promise.all([all('activities'),all('activityRecords')]);
      const localActs=(localActsAll||[]).filter(relevantActivity);
      const localIds=new Set(localActs.map(a=>String(a.id)));
      // Acepta tanto el formato IndexedDB (activityId/studentId) como el formato
      // normalizado (activity_id/student_id). Así no se pierden registros históricos.
      const normalizedLocalRecs=(localRecsAll||[]).map(r=>({
        ...r,
        activityId:String(r.activityId||r.activity_id||String(r.key||'').split('|')[0]||''),
        studentId:String(r.studentId||r.student_id||String(r.key||'').split('|')[1]||'')
      }));
      const localRecs=normalizedLocalRecs.filter(r=>localIds.has(String(r.activityId||''))&&comparableLocal(r));
      // Compatibilidad histórica: versiones antiguas podían conservar estados dentro
      // de la propia actividad sin crear activityRecords. Recuperar SOLO estados
      // explícitos almacenados; nunca convertir ausencia en "No entregada".
      const existingLocalKeys=new Set(localRecs.map(r=>recKey(r.activityId,r.studentId)));
      for(const a of localActs){
        const d=a?.data||a||{};
        const bags=[d.records,d.activityRecords,d.deliveryRecords,d.deliveries,d.studentRecords,d.statusByStudent,d.deliveryByStudent];
        for(const bag of bags){
          if(!bag)continue;
          const entries=Array.isArray(bag)
            ? bag.map(v=>[String(v?.studentId||v?.student_id||v?.id||''),v])
            : Object.entries(bag);
          for(const [sid,v] of entries){
            if(!sid)continue;
            let status=null,score=null;
            if(v===true||String(v).toLowerCase()==='yes'||String(v?.status||'').toLowerCase()==='yes')status='yes';
            else if(v===false||String(v).toLowerCase()==='no'||String(v?.status||'').toLowerCase()==='no')status='no';
            if(typeof v?.score==='number'&&Number.isFinite(v.score))score=v.score;
            if(status===null&&score===null)continue;
            const k=recKey(a.id,sid); if(existingLocalKeys.has(k))continue;
            localRecs.push({key:k,activityId:String(a.id),studentId:String(sid),status,score,timestamp:v?.timestamp||v?.deliveryDate||v?.delivery_date||a?.updated||a?.created||new Date().toISOString()});
            existingLocalKeys.add(k);
          }
        }
      }

      // 1. El iPad docente es la fuente histórica para recuperar lo que nunca subió.
      // Primero actividades; después registros, respetando llaves foráneas.
      await upsertActivities(localActs);
      // Recuperación segura: leer primero Supabase y subir únicamente llaves que
      // NO existen allí. Nunca sobrescribir un registro académico ya guardado.
      const beforeRemoteRecs=await fetchRemoteRecords();
      const uploadedMissing=await insertOnlyMissingRecords(localRecs,beforeRemoteRecs);

      // 2. Verificación real posterior contra Supabase.
      const [remoteActs,remoteRecs]=await Promise.all([fetchRemoteActivities(),fetchRemoteRecords()]);
      const remoteActIds=new Set((remoteActs||[]).filter(r=>{
        const d=String(r.activity_date||'');
        return d>=FROM && GROUPS.has(String(r.group_name||''));
      }).map(r=>String(r.id)));

      const missingActivities=localActs.filter(a=>!remoteActIds.has(String(a.id)));

      const remoteMap=new Map((remoteRecs||[]).map(r=>[recKey(r.activity_id,r.student_id),r]));
      const recordMismatches=[];
      for(const lr of localRecs){
        const k=recKey(lr.activityId,lr.studentId);
        const rr=remoteMap.get(k);
        if(!rr){recordMismatches.push({key:k,reason:'missing'});continue}
        const ld=deliveredOfLocal(lr);
        const rd=rr.delivered===true?true:rr.delivered===false?false:null;
        const ls=numOrNull(lr.score);
        const rs=numOrNull(rr.score);
        if(ld!==rd || ls!==rs)recordMismatches.push({key:k,reason:'different'});
      }

      const remoteRelevantActivities=remoteActs.filter(r=>GROUPS.has(String(r.group_name||''))&&String(r.activity_date||'')>=FROM).length;
      lastResult={
        ok:missingActivities.length===0&&recordMismatches.length===0,
        localActivities:localActs.length,
        localRecords:localRecs.length,
        remoteActivities:remoteRelevantActivities,
        missingActivities:missingActivities.length,
        recordMismatches:recordMismatches.length,
        uploadedMissing:Number(uploadedMissing||0),
        verifiedAt:new Date().toISOString()
      };

      if(lastResult.ok){
        setState('✅ Actividades verificadas · '+Number(uploadedMissing||0)+' registros faltantes enviados · App Docente y Supabase coinciden',true);
      }else{
        setState('⚠️ Actividades NO coinciden · '+missingActivities.length+' actividades y '+recordMismatches.length+' registros pendientes',false);
      }
      window.__activityReconcileResult=lastResult;
      return lastResult;
    }catch(e){
      const msg=String(e?.message||e);
      const authExpired=/sesión de supabase venció|sesion de supabase vencio|sesión de sincronización venció|sesion de sincronizacion vencio|inicia sesión nuevamente|inicia sesion nuevamente/i.test(msg);
      lastResult={ok:false,error:msg,authRequired:authExpired,verifiedAt:new Date().toISOString()};
      if(authExpired){
        document.querySelector('#teacherLoginGate')?.classList.remove('hidden');
        setState('🔐 Supabase necesita volver a iniciar sesión. No se borró información; inicia sesión una vez para continuar la verificación.',false);
      }else{
        setState('⚠️ No se pudo verificar Actividades: '+msg,false);
      }
      window.__activityReconcileResult=lastResult;
      return lastResult;
    }finally{
      running=false;
    }
  }

  function installButton(){
    if(document.querySelector('#activityFullReconcileBtn'))return;
    const section=document.querySelector('#activities .section');
    const target=section?.querySelector('.actions')||section;
    if(!target)return;
    const btn=document.createElement('button');
    btn.id='activityFullReconcileBtn';
    btn.type='button';
    btn.className='primary';
    btn.textContent='🔄 Verificar y reparar apps';
    btn.addEventListener('click',async()=>{
      const old=btn.textContent;
      btn.disabled=true;btn.textContent='Verificando…';
      const r=await reconcileActivities({manual:true});
      btn.disabled=false;btn.textContent=old;
      if(r?.ok){
        alert('Verificación completa. Coinciden '+Number(r.localActivities||0)+' actividades y '+Number(r.localRecords||0)+' registros reales entre App Docente y Supabase. No quedan diferencias por reparar.');
      }else if(r?.authRequired){
        alert('Supabase necesita volver a iniciar sesión. No se borró información.');
      }else if(r?.error){
        alert('No se pudo completar la verificación: '+r.error);
      }else{
        alert('La verificación terminó, pero aún quedan '+Number(r?.missingActivities||0)+' actividad(es) y '+Number(r?.recordMismatches||0)+' registro(s) por conciliar.');
      }
    });
    target.appendChild(btn);
  }

  async function automatic(){
    const r=await reconcileActivities({manual:false});
    if(!r?.ok){
      clearTimeout(retryTimer);
      retryTimer=setTimeout(()=>reconcileActivities({manual:false}),5000);
    }
  }

  window.reconcileAllActivities=reconcileActivities;
  window.addEventListener('online',()=>setTimeout(automatic,1200));
  window.addEventListener('focus',()=>setTimeout(automatic,800));
  window.addEventListener('load',()=>{
    setTimeout(installButton,700);
    setTimeout(automatic,2500);
  },{once:true});
})();