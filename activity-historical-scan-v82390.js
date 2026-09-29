// App Docente v8.23.90 · cierre global de faltantes + escaneo histórico desde 31/08/2026
(function(){
  const START_DATE='2026-08-31';
  const $q=s=>document.querySelector(s);

  function todayLocal(){
    const d=new Date(),off=d.getTimezoneOffset();
    return new Date(d.getTime()-off*60000).toISOString().slice(0,10);
  }
  function inRange(a){
    const d=String(a?.date||a?.activity_date||'');
    return d>=START_DATE && d<=todayLocal();
  }
  function isDelivery(a){return String(a?.evaluationMode||a?.evaluation_type||'delivery')==='delivery'}
  function key(aid,sid){return String(aid)+'|'+String(sid)}
  function esc2(v){return typeof safe==='function'?safe(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}

  async function cloudAudit(){
    const out=await window.ProfeSupabase.rpc('teacher_activity_records_audit',{p_group_name:null});
    if(Array.isArray(out))return out;
    if(out?.error)throw new Error(out.error);
    return out||[];
  }

  async function batchMerge(rows){
    let merged=0;
    for(let i=0;i<rows.length;i+=80){
      const block=rows.slice(i,i+80);
      const out=await window.ProfeSupabase.rpc('teacher_activity_records_merge_safe',{p_rows:block});
      if(!out?.ok)throw new Error(out?.reason||out?.error||'No se pudo confirmar un bloque de registros.');
      merged+=Number(out.merged||0);
    }
    return merged;
  }

  async function localWrite(records){
    for(const rec of records){
      await req(store('activityRecords','readwrite').put(rec));
    }
  }

  function localRecToRemote(rec){
    return {
      activity_id:String(rec.activityId),
      student_id:String(rec.studentId),
      delivered:rec.status==='yes'?true:rec.status==='no'?false:null,
      score:typeof rec.score==='number'?rec.score:null,
      delivery_date:rec.timestamp||new Date().toISOString(),
      observations:rec.observations||null,
      data:rec
    };
  }

  async function buildGlobalMissing(){
    if(!window.ProfeSupabase)throw new Error('No hay conexión con Supabase.');
    const [acts,sts,local,cloud]=await Promise.all([all('activities'),students(),all('activityRecords'),cloudAudit()]);
    const activityList=(acts||[]).filter(a=>inRange(a)&&isDelivery(a));
    const localKeys=new Set((local||[]).map(r=>key(r.activityId||r.activity_id,r.studentId||r.student_id)));
    const cloudKeys=new Set((cloud||[]).map(r=>key(r.activity_id,r.student_id)));
    const missing=[];
    for(const a of activityList){
      const roster=(sts||[]).filter(s=>sameShift(s.shift,a.shift)&&sameGroup(s.group,a.group));
      for(const st of roster){
        const k=key(a.id,st.id);
        if(localKeys.has(k)||cloudKeys.has(k))continue;
        missing.push({activity:a,student:st});
      }
    }
    return {missing,activityCount:activityList.length,studentCount:new Set(missing.map(x=>String(x.student.id))).size};
  }

  async function openGlobalMissingDialog(){
    showDialog('Marcar faltantes como No entregado',
      '<div class="card"><p class="eyebrow">31 DE AGOSTO A HOY</p><h3>Buscando registros faltantes…</h3><p class="hint">Solo se revisan actividades de entrega. No se modifica ningún registro que ya exista.</p></div>');
    try{
      const data=await buildGlobalMissing();
      const body=$q('#dialogBody');
      if(!body)return;
      if(!data.missing.length){
        body.innerHTML='<div class="card"><div class="empty">✓ No hay alumnos sin registro en actividades de entrega desde el 31 de agosto.</div></div><div class="actions"><button id="globalNoClose" class="secondary">Cerrar</button></div>';
        $q('#globalNoClose').onclick=()=>$q('#dialog')?.close();
        return;
      }
      const byGroup={};
      for(const x of data.missing){
        const g=String(x.activity.group||'Sin grupo');
        byGroup[g]=(byGroup[g]||0)+1;
      }
      body.innerHTML=
        '<div class="card">'+
          '<p class="eyebrow">CIERRE GLOBAL</p>'+
          '<h3>'+data.missing.length+' registros faltantes</h3>'+
          '<p>Se marcarán como <b>No entregado</b> únicamente los espacios que no tienen ningún registro, desde el <b>31 de agosto de 2026</b> hasta hoy.</p>'+
          '<p class="hint"><b>No se sobrescribe</b> ningún verde, rojo, calificación ni registro existente. Actividades numéricas quedan fuera.</p>'+
          '<p class="hint">'+Object.entries(byGroup).map(([g,n])=>'Grupo '+esc2(g)+': <b>'+n+'</b>').join(' · ')+'</p>'+
        '</div>'+
        '<div class="actions"><button id="globalNoApply" class="danger-outline" type="button">Marcar todos como No entregado</button><button id="globalNoCancel" class="secondary" type="button">Cancelar</button></div>';
      $q('#globalNoCancel').onclick=()=>$q('#dialog')?.close();
      $q('#globalNoApply').onclick=async()=>{
        const btn=$q('#globalNoApply'),old=btn.textContent;
        if(!confirm('Se crearán '+data.missing.length+' registros como “No entregado”. Solo en espacios actualmente sin registro. ¿Continuar?'))return;
        try{
          btn.disabled=true;btn.textContent='Guardando…';
          const now=new Date().toISOString();
          const localRows=data.missing.map(x=>({
            key:key(x.activity.id,x.student.id),
            activityId:String(x.activity.id),
            studentId:String(x.student.id),
            status:'no',
            timestamp:now
          }));
          await batchMerge(localRows.map(localRecToRemote));
          await localWrite(localRows);
          if(typeof renderActivityGrid==='function')await renderActivityGrid();
          if(typeof refreshActivityStats==='function')await refreshActivityStats();
          btn.textContent='✓ Listo';
          alert('Listo. Se marcaron '+localRows.length+' registros faltantes como “No entregado”. Los cambios quedaron confirmados en Supabase.');
          $q('#dialog')?.close();
        }catch(e){
          alert('No se completó el cierre: '+(e?.message||e));
          btn.disabled=false;btn.textContent=old;
        }
      };
    }catch(e){
      const body=$q('#dialogBody');if(body)body.innerHTML='<div class="card"><div class="empty">No se pudo revisar: '+esc2(e?.message||e)+'</div></div>';
    }
  }

  let historicalStudent=null;
  let historicalActivities=[];
  let historicalCloudMap=new Map();

  function historicalHeader(){
    return '<div class="card">'+
      '<p class="eyebrow">REGISTRO HISTÓRICO DE ENTREGAS</p>'+
      '<h3>Escanea un alumno</h3>'+
      '<p class="hint">Muestra todas sus actividades de entrega desde el 31 de agosto de 2026 hasta hoy, sin dividir por semana.</p>'+
      '<div class="scan"><input id="historicalScanId" inputmode="numeric" autocomplete="off" placeholder="ID del alumno"><button id="historicalScanGo" class="primary" type="button">Buscar</button></div>'+
      '<p id="historicalScanStatus" class="message"></p>'+
    '</div><div id="historicalScanResult"></div>'+
    '<div class="actions"><button id="historicalScanClose" class="secondary" type="button">Cerrar</button></div>';
  }

  async function lookupHistoricalStudent(){
    const input=$q('#historicalScanId'),status=$q('#historicalScanStatus'),box=$q('#historicalScanResult');
    const sid=String(input?.value||'').trim();
    if(!sid)return;
    if(status)status.textContent='Buscando actividades…';
    try{
      const st=await req(store('students').get(sid));
      if(!st||st.active===false||String(st.id)==='00001')throw new Error('No encontré un alumno activo con ese ID.');
      const [acts,local,cloud]=await Promise.all([all('activities'),all('activityRecords'),cloudAudit()]);
      historicalStudent=st;
      historicalActivities=(acts||[])
        .filter(a=>inRange(a)&&isDelivery(a)&&sameShift(a.shift,st.shift)&&sameGroup(a.group,st.group))
        .sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))||String(a.name||'').localeCompare(String(b.name||''),'es'));
      const lmap=new Map((local||[]).filter(r=>String(r.studentId)===sid).map(r=>[String(r.activityId),r]));
      historicalCloudMap=new Map((cloud||[]).filter(r=>String(r.student_id)===sid).map(r=>[String(r.activity_id),r]));

      if(status)status.textContent='';
      if(!historicalActivities.length){
        box.innerHTML='<div class="card"><div class="empty">No hay actividades de entrega para este alumno desde el 31 de agosto.</div></div>';
        return;
      }
      box.innerHTML=
        '<div class="card">'+
          '<div class="section"><div><h3>'+esc2(st.name||sid)+'</h3><p class="hint">Grupo '+esc2(st.group)+' · Lista '+esc2(st.number||'—')+' · '+historicalActivities.length+' actividades</p></div>'+
          '<div class="actions"><button id="historicalSelectPending" class="secondary" type="button">Seleccionar todas pendientes/no entregadas</button><button id="historicalClearSelection" class="secondary" type="button">Quitar selección</button></div></div>'+
          '<div class="activity-multi-student-choices">'+
          historicalActivities.map(a=>{
            const lr=lmap.get(String(a.id));
            const cr=historicalCloudMap.get(String(a.id));
            const delivered=lr?.status==='yes'||cr?.delivered===true;
            const noDelivered=lr?.status==='no'||cr?.delivered===false;
            const state=delivered?'Ya entregada':noDelivered?'No entregada':'Sin registro';
            return '<label class="activity-multi-student-choice '+(delivered?'already':'')+'">'+
              '<input type="checkbox" data-historical-aid="'+esc2(a.id)+'" '+(delivered?'checked disabled':'')+'>'+
              '<span><b>'+esc2(a.name||'Actividad')+'</b><small>'+esc2(a.date||'')+' · '+state+'</small></span>'+
            '</label>';
          }).join('')+
          '</div>'+
          '<div class="actions"><button id="historicalSave" class="primary" type="button">Registrar seleccionadas como entregadas</button></div>'+
        '</div>';

      $q('#historicalSelectPending').onclick=()=>{
        document.querySelectorAll('[data-historical-aid]:not(:disabled)').forEach(x=>x.checked=true);
      };
      $q('#historicalClearSelection').onclick=()=>{
        document.querySelectorAll('[data-historical-aid]:not(:disabled)').forEach(x=>x.checked=false);
      };
      $q('#historicalSave').onclick=saveHistoricalSelected;
    }catch(e){
      if(status)status.textContent=e?.message||String(e);
      if(box)box.innerHTML='';
    }finally{
      if(input){input.value='';input.focus()}
    }
  }

  async function pushDelivered(activity,studentId){
    if(!sameShift(activity.shift,'Matutino')||!window.ProfeSupabase)return;
    try{
      await window.ProfeSupabase.edge('send-push',{
        event:'activity_update',
        student_id:String(studentId),
        title:activity.name||'Actividad',
        message:(activity.name||'Actividad')+' · Estado: Entregada',
        status:'yes'
      });
    }catch(e){console.warn('Push actividad entregada',e)}
  }

  async function saveHistoricalSelected(){
    if(!historicalStudent)return;
    const selected=[...document.querySelectorAll('[data-historical-aid]:checked:not(:disabled)')].map(x=>x.dataset.historicalAid);
    if(!selected.length)return alert('Selecciona al menos una actividad que quieras registrar como entregada.');
    const btn=$q('#historicalSave'),old=btn.textContent;
    try{
      btn.disabled=true;btn.textContent='Guardando…';
      const now=new Date().toISOString();
      const rows=selected.map(aid=>({
        key:key(aid,historicalStudent.id),
        activityId:String(aid),
        studentId:String(historicalStudent.id),
        status:'yes',
        timestamp:now
      }));
      await batchMerge(rows.map(localRecToRemote));
      await localWrite(rows);
      const selectedActs=historicalActivities.filter(a=>selected.includes(String(a.id)));
      for(const a of selectedActs)await pushDelivered(a,historicalStudent.id);
      alert('Listo. Se registraron '+rows.length+' actividad'+(rows.length===1?'':'es')+' como entregada'+(rows.length===1?'':'s')+'.');
      await lookupHistoricalStudentAfterSave();
    }catch(e){
      alert('No se pudieron registrar las actividades: '+(e?.message||e));
    }finally{
      btn.disabled=false;btn.textContent=old;
    }
  }

  async function lookupHistoricalStudentAfterSave(){
    const box=$q('#historicalScanResult');
    if(!historicalStudent||!box)return;
    const fake=$q('#historicalScanId');
    if(fake)fake.value=historicalStudent.id;
    await lookupHistoricalStudent();
  }

  function openHistoricalScan(){
    showDialog('Escaneo · Todas las actividades',historicalHeader());
    $q('#historicalScanClose').onclick=()=>$q('#dialog')?.close();
    $q('#historicalScanGo').onclick=lookupHistoricalStudent;
    const input=$q('#historicalScanId');
    input?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();lookupHistoricalStudent()}});
    setTimeout(()=>input?.focus(),100);
  }

  function install(){
    if($q('#historicalActivitiesBtn'))return;
    const pane=$q('#act-scan');
    if(!pane)return;
    const firstCard=pane.querySelector('.card');
    const tools=document.createElement('div');
    tools.className='card';
    tools.id='historicalActivityTools';
    tools.innerHTML=
      '<div class="section"><div><h2>Registro sin semanas</h2><p class="hint">Trabaja con todas las actividades de entrega desde el 31 de agosto hasta hoy.</p></div></div>'+
      '<div class="actions">'+
        '<button id="historicalActivitiesBtn" class="primary" type="button">📚 Escanear todas desde 31 ago</button>'+
        '<button id="markAllMissingNoBtn" class="danger-outline" type="button">✕ Marcar todos los faltantes como No entregado</button>'+
      '</div>';
    if(firstCard)firstCard.insertAdjacentElement('afterend',tools);else pane.prepend(tools);
    $q('#historicalActivitiesBtn').onclick=openHistoricalScan;
    $q('#markAllMissingNoBtn').onclick=openGlobalMissingDialog;
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,500),{once:true});
  else setTimeout(install,500);
})();