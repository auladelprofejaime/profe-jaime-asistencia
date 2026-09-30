// App Docente v8.23.38 · Actividades · consulta de pendientes por alumno
(function(){
  const byId=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtDate=value=>{
    if(!value)return 'Sin fecha';
    const d=new Date(String(value)+'T12:00:00');
    if(Number.isNaN(d.getTime()))return String(value);
    return d.toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'});
  };
  const todayIso=()=>new Date().toISOString().slice(0,10);
  const studentName=s=>{
    try{return typeof studentListDisplayName==='function'?studentListDisplayName(s):(s?.name||s?.id||'Alumno');}
    catch(_){return s?.name||s?.id||'Alumno'}
  };
  const groupMatches=(a,b)=>{
    try{return typeof sameGroup==='function'?sameGroup(a,b):String(a??'').replace(/[^0-9a-z]/gi,'').toLowerCase()===String(b??'').replace(/[^0-9a-z]/gi,'').toLowerCase();}
    catch(_){return String(a??'')===String(b??'')}
  };
  const shiftMatches=(a,b)=>{
    try{return typeof sameShift==='function'?sameShift(a,b):String(a??'').trim().toLowerCase()===String(b??'').trim().toLowerCase();}
    catch(_){return String(a??'')===String(b??'')}
  };

  function pendingDeliveryState(activity,record){
    if(record?.status==='no') return {label:'No entregó',tone:'overdue',icon:'✕'};
    const due=String(activity?.dueDate||'');
    const now=todayIso();
    if(!due)return {label:'Pendiente de entrega',tone:'pending',icon:'○'};
    if(due<now)return {label:'Pendiente · fecha vencida',tone:'overdue',icon:'!'};
    if(due===now)return {label:'Entrega hoy',tone:'today',icon:'◷'};
    return {label:'Por entregar',tone:'future',icon:'○'};
  }

  function renderEmpty(message){
    const box=byId('activityPendingResult');
    if(box)box.innerHTML='<div class="card activity-pending-empty">'+esc(message)+'</div>';
  }

  async function lookupPendingActivities(){
    const input=byId('activityPendingScan');
    const status=byId('activityPendingStatus');
    const box=byId('activityPendingResult');
    const id=String(input?.value||'').trim().replace(/\s+/g,'');
    if(!id){
      if(status){status.className='message bad';status.textContent='Escanea o escribe el ID del alumno.'}
      input?.focus();
      return;
    }
    if(status){status.className='message';status.textContent='Consultando actividades…'}
    if(box)box.innerHTML='<div class="card activity-pending-empty">Buscando información del alumno…</div>';

    try{
      if(typeof ensureDB==='function')await ensureDB();
      const roster=typeof students==='function'?await students():await all('students');
      const student=(roster||[]).find(s=>String(s.id)===id);
      if(!student){
        if(status){status.className='message bad';status.textContent='ID no encontrado.'}
        renderEmpty('No encontré un alumno con ese ID.');
        return;
      }

      const result=await Promise.all([all('activities'),all('activityRecords')]);
      const activities=result[0]||[],records=result[1]||[];
      const assigned=activities
        .filter(a=>shiftMatches(a.shift,student.shift)&&groupMatches(a.group,student.group))
        .sort((a,b)=>String(a.dueDate||a.date||'').localeCompare(String(b.dueDate||b.date||''))||String(a.name||'').localeCompare(String(b.name||''),'es',{sensitivity:'base'}));
      const recordMap=new Map(records.map(r=>[String(r.activityId)+'|'+String(r.studentId),r]));

      window.__pendingStudent={id,student};
      const deliveryPending=[];
      const numericUngraded=[];
      let completed=0;

      for(const activity of assigned){
        const record=recordMap.get(String(activity.id)+'|'+id);
        const mode=activity.evaluationMode||'delivery';
        if(mode==='numeric'){
          const hasScore=record&&typeof record.score==='number'&&Number.isFinite(record.score);
          if(hasScore){completed++;continue}
          numericUngraded.push({activity,record});
          continue;
        }
        if(record?.status==='yes'){completed++;continue}
        deliveryPending.push({activity,record,state:pendingDeliveryState(activity,record)});
      }

      const pendingCount=deliveryPending.length;
      const ungradedCount=numericUngraded.length;
      const total=assigned.length;
      const noIssues=pendingCount===0&&ungradedCount===0;
      const meta=[
        student.shift||'',
        student.group?('Grupo '+student.group):'',
        student.number!=null&&student.number!==''?('Lista '+student.number):'',
        'ID '+id
      ].filter(Boolean).join(' · ');

      let summary='<div class="activity-pending-summary">';
      summary+='<div><b>'+total+'</b><span>Actividades registradas</span></div>';
      summary+='<div><b>'+completed+'</b><span>Completadas / calificadas</span></div>';
      summary+='<div class="'+(pendingCount?'warn':'')+'"><b>'+pendingCount+'</b><span>Pendientes de entrega</span></div>';
      summary+='<div class="'+(ungradedCount?'info':'')+'"><b>'+ungradedCount+'</b><span>Sin calificación</span></div>';
      summary+='</div>';

      let deliveryHtml='';
      if(pendingCount){
        deliveryHtml='<div class="activity-pending-block"><h3>Pendientes de entrega</h3><div class="activity-pending-list">';
        deliveryHtml+=deliveryPending.map(item=>{
          const activity=item.activity,state=item.state;
          return '<label class="activity-pending-row '+state.tone+'" style="cursor:pointer;user-select:none">'+
            '<input class="activity-pending-check" type="checkbox" data-activity-id="'+esc(activity.id)+'" style="width:24px;height:24px;min-width:24px;accent-color:currentColor">'+
            '<div class="activity-pending-state"><span>'+state.icon+'</span><b>'+esc(state.label)+'</b></div>'+
            '<div class="activity-pending-copy"><strong>'+esc(activity.name||'Actividad')+'</strong>'+
            '<small>'+esc(activity.type||'Actividad')+' · Asignada '+esc(fmtDate(activity.date))+' · Entrega '+esc(fmtDate(activity.dueDate))+'</small></div></label>';
        }).join('');
        deliveryHtml+='</div><div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px"><button id="activityPendingSelectAll" class="secondary" type="button">Seleccionar todas</button><button id="activityPendingDeliverSelected" type="button">Registrar seleccionadas como entregadas</button></div><p class="hint">Marca únicamente las actividades que el alumno está entregando en este momento y confirma una sola vez.</p></div>';
      }

      let numericHtml='';
      if(ungradedCount){
        numericHtml='<div class="activity-pending-block"><h3>Actividades numéricas sin calificación registrada</h3>'+
          '<p class="hint">Esto no significa automáticamente que el alumno no entregó; indica que todavía no existe una calificación numérica guardada.</p>'+
          '<div class="activity-pending-list">';
        numericHtml+=numericUngraded.map(item=>{
          const activity=item.activity;
          return '<div class="activity-pending-row numeric"><div class="activity-pending-state"><span>—</span><b>Sin calificar</b></div>'+
            '<div class="activity-pending-copy"><strong>'+esc(activity.name||'Actividad')+'</strong>'+
            '<small>'+esc(activity.type||'Actividad')+' · Asignada '+esc(fmtDate(activity.date))+' · Entrega '+esc(fmtDate(activity.dueDate))+'</small></div></div>';
        }).join('');
        numericHtml+='</div></div>';
      }

      const currentHtml=noIssues?
        '<div class="activity-pending-current"><span>✓</span><div><strong>Al corriente</strong><p>No tiene entregas pendientes ni actividades numéricas sin calificación entre las actividades registradas para su grupo.</p></div></div>':'';

      if(box){
        box.innerHTML='<div class="card activity-pending-student">'+
          '<div class="activity-pending-head"><div><span class="monitor-badge">ALUMNO CONSULTADO</span><h2>'+esc(studentName(student))+'</h2><p class="hint">'+esc(meta)+'</p></div>'+
          '<button id="activityPendingClear" class="secondary" type="button">Nueva consulta</button></div>'+
          summary+currentHtml+deliveryHtml+numericHtml+
          (total===0?'<div class="activity-pending-empty">Todavía no hay actividades registradas para este grupo.</div>':'')+
          '</div>';
      }

      if(status){
        status.className=noIssues?'message good':'message';
        status.textContent=noIssues?'✓ Alumno al corriente.':'Consulta lista: '+pendingCount+' pendiente'+(pendingCount===1?'':'s')+' de entrega y '+ungradedCount+' sin calificación.';
      }
      byId('activityPendingSelectAll')?.addEventListener('click',()=>{document.querySelectorAll('.activity-pending-check').forEach(x=>x.checked=true)});
      byId('activityPendingDeliverSelected')?.addEventListener('click',async()=>{
        const selected=[...document.querySelectorAll('.activity-pending-check:checked')].map(x=>x.dataset.activityId).filter(Boolean);
        if(!selected.length){if(status){status.className='message bad';status.textContent='Selecciona al menos una actividad.'}return;}
        const btn=byId('activityPendingDeliverSelected'); if(btn)btn.disabled=true;
        try{
          const stamp=new Date().toISOString();
          for(const activityId of selected){await put('activityRecords',{key:activityId+'|'+id,activityId,studentId:id,status:'yes',timestamp:stamp,deliveryDate:stamp});}
          if(status){status.className='message good';status.textContent='✓ '+selected.length+' actividad'+(selected.length===1?'':'es')+' registrada'+(selected.length===1?'':'s')+' como entregada'+(selected.length===1?'':'s')+'.';}
          if(input){input.value=id;await lookupPendingActivities();}
        }catch(e){console.error('Entrega múltiple desde pendientes:',e);if(status){status.className='message bad';status.textContent='No se completó el registro: '+(e?.message||e)}}finally{if(btn)btn.disabled=false;}
      });
      byId('activityPendingClear')?.addEventListener('click',()=>{
        if(box)box.innerHTML='';
        if(status){status.className='message';status.textContent=''}
        if(input){input.value='';input.focus()}
      });
    }catch(e){
      console.error('Pendientes por alumno:',e);
      if(status){status.className='message bad';status.textContent='No se pudo consultar: '+(e?.message||e)}
      renderEmpty('No fue posible cargar los pendientes. Intenta nuevamente.');
    }finally{
      if(input){input.value='';input.focus()}
    }
  }

  function bindPendingActivities(){
    const input=byId('activityPendingScan');
    const button=byId('activityPendingSearch');
    if(!input||!button)return;
    button.type='button';
    button.addEventListener('click',e=>{e.preventDefault();lookupPendingActivities()});
    input.addEventListener('keydown',e=>{
      if(e.key==='Enter'||e.key==='NumpadEnter'){
        e.preventDefault();
        lookupPendingActivities();
      }
    });
    document.querySelector('[data-acttab="pending"]')?.addEventListener('click',()=>setTimeout(()=>input.focus(),80));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bindPendingActivities);
  else bindPendingActivities();
})();