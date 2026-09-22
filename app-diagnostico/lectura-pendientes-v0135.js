// App Diagnóstico v0.13.5 · Lectura Eficaz vespertino · respaldo + solo pendientes
(function(){
  let lecturaCloudTimes=[];
  let lecturaPendingOnly=true;
  let lecturaAllTimerStudents=[];

  function vespertinoLocalTimeMap(group){
    const map=new Map();
    try{
      const rows=typeof lecturaAllRecoveredRows==='function'?lecturaAllRecoveredRows(group):[];
      for(const r of rows){
        const sid=String(r.student_id||'');
        if(!sid||!Number(r.time))continue;
        const prev=map.get(sid);
        if(!prev||Number(r.completedAt||0)>Number(prev.completedAt||0)) map.set(sid,r);
      }
    }catch(_){}
    return map;
  }

  function vespertinoCloudTimeMap(group){
    const map=new Map();
    for(const r of lecturaCloudTimes||[]){
      if(String(r.group_name||'')!==String(group))continue;
      if(String(r.moment||'initial')!=='initial')continue;
      if(!Number(r.reading_seconds))continue;
      map.set(String(r.student_id),r);
    }
    return map;
  }

  function existingVespertinoTime(group,studentId){
    const sid=String(studentId);
    const local=vespertinoLocalTimeMap(group).get(sid);
    if(local)return {seconds:Number(local.time),source:'local',row:local};
    const cloud=vespertinoCloudTimeMap(group).get(sid);
    if(cloud)return {seconds:Number(cloud.reading_seconds),source:'cloud',row:cloud};
    return null;
  }

  async function loadLecturaCloudTimes(){
    if(!activePeriod?.id||!accessToken){lecturaCloudTimes=[];return []}
    try{
      const rows=await rpc('teacher_diagnostic_lectura_times',{p_period_id:activePeriod.id});
      lecturaCloudTimes=Array.isArray(rows)?rows:[];
    }catch(e){
      console.warn('No se pudieron consultar respaldos de tiempos',e);
      lecturaCloudTimes=[];
    }
    return lecturaCloudTimes;
  }

  async function backupLocalVespertinoTimes(){
    if(!activePeriod?.id||!accessToken)return;
    try{
      const audit=(typeof lecturaAuditAllLocalTimes==='function'?lecturaAuditAllLocalTimes():[])
        .filter(r=>String(r.periodId)===String(activePeriod.id) && String(r.studentId||'').startsWith('V') && Number(r.seconds)>0);
      if(!audit.length){await loadLecturaCloudTimes();return}
      const rows=audit.map(r=>({
        student_id:String(r.studentId),
        group_name:String(r.group||''),
        moment:String(r.moment||'initial'),
        test_code:r.testCode||null,
        reading_seconds:Number(r.seconds),
        captured_at:r.when?new Date(Number(r.when)).toISOString():new Date().toISOString()
      }));
      await rpc('teacher_diagnostic_lectura_times_backup',{p_period_id:activePeriod.id,p_rows:rows});
      await loadLecturaCloudTimes();
    }catch(e){
      console.warn('No se pudo respaldar tiempos locales de Lectura Eficaz',e);
      await loadLecturaCloudTimes();
    }
  }

  function ensurePendingControls(){
    const grid=document.querySelector('#lecturaTimerGrid');
    if(!grid||document.querySelector('#lecturaPendingControls'))return;
    const box=document.createElement('div');
    box.id='lecturaPendingControls';
    box.style.cssText='margin:12px 0;padding:12px;border-radius:14px;background:#fff8df;border:1px solid #ead9a8';
    box.innerHTML='<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button type="button" id="lecturaPendingToggle" class="primary">Solo pendientes</button><span id="lecturaPendingSummary" class="muted"></span></div><small style="display:block;margin-top:6px">Los alumnos que ya tienen tiempo están protegidos y no se incluirán en una nueva aplicación.</small>';
    grid.parentElement.insertBefore(box,grid);
    document.querySelector('#lecturaPendingToggle').onclick=async()=>{
      if(lecturaTimerSession()?.startedAt){alert('Finaliza la aplicación en curso antes de cambiar la vista.');return}
      lecturaPendingOnly=!lecturaPendingOnly;
      await loadLecturaTimerStudents();
    };
  }

  function updatePendingSummary(group){
    const total=lecturaAllTimerStudents.length;
    const pending=lecturaAllTimerStudents.filter(s=>!existingVespertinoTime(group,s.student_id)).length;
    const done=total-pending;
    const el=document.querySelector('#lecturaPendingSummary');
    if(el)el.textContent=`${pending} pendientes · ${done} con tiempo protegido · ${total} alumnos`;
    const btn=document.querySelector('#lecturaPendingToggle');
    if(btn){
      btn.textContent=lecturaPendingOnly?'Solo pendientes':'Ver todos';
      btn.className=lecturaPendingOnly?'primary':'secondary';
    }
  }

  const baseLoadStudents=loadLecturaTimerStudents;
  loadLecturaTimerStudents=async function(){
    const group=document.querySelector('#lecturaTimerGroup')?.value;
    if(!group)return baseLoadStudents();

    const localRows=LECTURA_VESPERTINO_ROSTER[group];
    if(!localRows)return baseLoadStudents();

    await loadLecturaCloudTimes();
    lecturaAllTimerStudents=(localRows||[])
      .filter(s=>String(s.student_id)!=='00001')
      .sort((a,b)=>(Number(a.list_number)||999)-(Number(b.list_number)||999));

    const pending=lecturaAllTimerStudents.filter(s=>!existingVespertinoTime(group,s.student_id));
    lecturaTimerStudents=lecturaPendingOnly?pending:lecturaAllTimerStudents;

    const t=lecturaVespertinoTest(group);
    const sel=document.querySelector('#lecturaTimerTest');
    if(sel){sel.innerHTML=`<option value="${t.code}">${esc(t.title)}</option>`;sel.value=t.code}
    document.querySelector('#lecturaTimerMoment').value='initial';

    ensurePendingControls();
    renderLecturaTimerGrid();
    syncLecturaTimerControls();
    updatePendingSummary(group);
  };

  const baseRenderGrid=renderLecturaTimerGrid;
  renderLecturaTimerGrid=function(){
    baseRenderGrid();
    const group=document.querySelector('#lecturaTimerGroup')?.value||'';
    if(!lecturaPendingOnly){
      document.querySelectorAll('[data-timer-student]').forEach(btn=>{
        const sid=btn.dataset.timerStudent;
        const old=existingVespertinoTime(group,sid);
        if(old){
          btn.classList.remove('pending');
          btn.classList.add('captured');
          btn.disabled=true;
          const b=btn.querySelector('b');
          if(b)b.textContent='✓ '+(btn.querySelector('small')?.textContent?'':'')+(LECTURA_VESPERTINO_ROSTER[group]?.find(x=>String(x.student_id)===String(sid))?.list_number??'—')+' · '+lecturaFormatSeconds(old.seconds);
          btn.title='Tiempo existente protegido';
        }
      });
    }
    updatePendingSummary(group);
  };

  const baseOpenTimer=openLecturaGroupTimer;
  openLecturaGroupTimer=async function(sessionToResume=null,preferredGroup=null){
    await backupLocalVespertinoTimes();
    await baseOpenTimer(sessionToResume,preferredGroup);
    ensurePendingControls();
    await loadLecturaTimerStudents();
  };

  const baseCapture=captureLecturaStudentTime;
  captureLecturaStudentTime=function(studentId){
    const group=document.querySelector('#lecturaTimerGroup')?.value||'';
    if(existingVespertinoTime(group,studentId)){
      alert('Este alumno ya tiene un tiempo registrado. Está protegido y no se modificó.');
      return;
    }
    baseCapture(studentId);
    const s=lecturaTimerSession();
    const cap=s?.captures?.[String(studentId)];
    if(cap&&activePeriod?.id){
      rpc('teacher_diagnostic_lectura_time_save',{
        p_period_id:activePeriod.id,
        p_student_id:String(studentId),
        p_group_name:group,
        p_moment:s.moment||'initial',
        p_test_code:s.testCode||lecturaVespertinoTest(group).code,
        p_reading_seconds:Number(cap.seconds),
        p_captured_at:new Date(Number(cap.capturedAt||Date.now())).toISOString(),
        p_replace:false
      }).then(()=>loadLecturaCloudTimes()).catch(e=>console.warn('Respaldo de tiempo pendiente',e));
    }
  };

  const baseFinish=finishLecturaGroupTimer;
  finishLecturaGroupTimer=function(){
    const before=lecturaTimerSession();
    baseFinish();
    if(before?.captures&&activePeriod?.id){
      const group=before.group||document.querySelector('#lecturaTimerGroup')?.value||'';
      const rows=Object.entries(before.captures).map(([sid,c])=>({
        student_id:String(sid),
        group_name:group,
        moment:before.moment||'initial',
        test_code:before.testCode||lecturaVespertinoTest(group).code,
        reading_seconds:Number(c.seconds),
        captured_at:new Date(Number(c.capturedAt||c.modifiedAt||Date.now())).toISOString()
      }));
      if(rows.length)rpc('teacher_diagnostic_lectura_times_backup',{p_period_id:activePeriod.id,p_rows:rows}).then(loadLecturaCloudTimes).catch(e=>console.warn('Respaldo final de tiempos',e));
    }
  };

  window.addEventListener('load',()=>setTimeout(()=>{if(activePeriod?.id)backupLocalVespertinoTimes().catch(()=>{})},1200));
})();