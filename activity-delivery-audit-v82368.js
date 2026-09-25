// App Docente v8.23.68 · Auditoría de entregas Docente vs Supabase/Alumno
(function(){
  let lastAudit=null;

  function auditKey(activityId,studentId){return String(activityId)+'|'+String(studentId)}

  async function loadCloudAudit(){
    const fn=window.ProfeSupabase?.rpc?.bind(window.ProfeSupabase);
    if(!fn)throw new Error('No hay conexión disponible con Supabase.');
    const out=await fn('teacher_activity_records_audit',{p_group_name:null});
    if(Array.isArray(out))return out;
    if(out?.error)throw new Error(out.error);
    return out||[];
  }

  async function buildDeliveryAudit(){
    const [localRecords,localStudents,localActivities,cloudRows]=await Promise.all([
      all('activityRecords'),
      students(),
      all('activities'),
      loadCloudAudit()
    ]);

    const studentMap=new Map((localStudents||[]).map(s=>[String(s.id),s]));
    const activityMap=new Map((localActivities||[]).map(a=>[String(a.id),a]));
    const cloudMap=new Map((cloudRows||[]).map(r=>[auditKey(r.activity_id,r.student_id),r]));

    const localMap=new Map();
    for(const r of localRecords||[]){
      const aid=String(r.activityId||r.activity_id||'');
      const sid=String(r.studentId||r.student_id||'');
      if(!aid||!sid)continue;
      localMap.set(auditKey(aid,sid),r);
    }

    const keys=new Set([...cloudMap.keys(),...localMap.keys()]);
    const rows=[];

    for(const key of keys){
      const local=localMap.get(key)||null;
      const cloud=cloudMap.get(key)||null;
      const [activityId,studentId]=key.split('|');
      const st=studentMap.get(studentId)||{};
      const act=activityMap.get(activityId)||{};
      const localStatus=String(local?.status||'').toLowerCase();
      const localDelivered=localStatus==='yes';
      const cloudDelivered=!!cloud?.delivered;

      let state='match';
      if(local&&localDelivered&&!cloudDelivered)state='local_yes_cloud_no';
      else if(local&&localStatus==='no'&&cloudDelivered)state='local_no_cloud_yes';
      else if(local&&!cloud)state=localDelivered?'local_yes_cloud_missing':'local_only';
      else if(!local&&cloud)state='cloud_only';

      rows.push({
        key,activityId,studentId,
        studentName:st.name||studentId,
        group:String(st.group||st.group_name||act.group||act.group_name||''),
        listNumber:st.number||st.list_number||'—',
        activityTitle:act.title||activityId,
        activityDate:act.date||act.activity_date||'',
        localStatus:localStatus||'sin registro',
        localTimestamp:local?.timestamp||local?.deliveryDate||null,
        cloudDelivered,
        cloudDeliveryDate:cloud?.delivery_date||null,
        state
      });
    }

    rows.sort((a,b)=>
      String(a.group).localeCompare(String(b.group),'es',{numeric:true})||
      Number(a.listNumber||999)-Number(b.listNumber||999)||
      String(a.activityDate).localeCompare(String(b.activityDate))
    );

    const repairable=rows.filter(r=>r.state==='local_yes_cloud_no'||r.state==='local_yes_cloud_missing');
    const reverse=rows.filter(r=>r.state==='local_no_cloud_yes');
    const matches=rows.filter(r=>r.state==='match');

    return {rows,repairable,reverse,matches,cloudCount:(cloudRows||[]).length,localCount:(localRecords||[]).length};
  }

  function stateLabel(r){
    if(r.state==='local_yes_cloud_no')return 'Docente: Entregada · Alumno: No entregada';
    if(r.state==='local_yes_cloud_missing')return 'Docente: Entregada · Alumno: Sin registro';
    if(r.state==='local_no_cloud_yes')return 'Docente: No entregada · Alumno: Entregada';
    if(r.state==='local_only')return 'Solo existe en este iPad';
    if(r.state==='cloud_only')return 'Solo existe en Supabase';
    return 'Coincide';
  }

  function renderAuditDialog(audit){
    lastAudit=audit;
    const mismatch=audit.rows.filter(r=>r.state!=='match');
    const repairable=audit.repairable;

    const grouped={};
    for(const r of mismatch){
      const g=r.group||'Sin grupo';
      (grouped[g]||(grouped[g]=[])).push(r);
    }

    const body=Object.entries(grouped).map(([group,rows])=>
      '<div class="card"><h3>Grupo '+safe(group)+'</h3>'+
      '<div class="list">'+rows.map(r=>
        '<div class="list-row">'+
          '<b>'+safe(String(r.listNumber))+' · '+safe(r.studentName)+'</b>'+
          '<small>'+safe(r.activityTitle)+(r.activityDate?' · '+safe(String(r.activityDate)):'')+'</small>'+
          '<small><b>'+safe(stateLabel(r))+'</b></small>'+
        '</div>'
      ).join('')+'</div></div>'
    ).join('');

    showDialog('Auditoría de entregas',
      '<div class="card">'+
        '<p class="eyebrow">COMPARACIÓN COMPLETA</p>'+
        '<div class="stats">'+
          '<div><b>'+audit.localCount+'</b><span>Registros en este iPad</span></div>'+
          '<div><b>'+audit.cloudCount+'</b><span>Registros en Supabase</span></div>'+
          '<div><b>'+repairable.length+'</b><span>Entregas por corregir en Alumno</span></div>'+
          '<div><b>'+audit.reverse.length+'</b><span>Diferencias inversas</span></div>'+
        '</div>'+
        '<p class="hint">Esta auditoría es solo de lectura. La App Docente se toma como referencia y no se modificará ningún registro.</p>'+
      '</div>'+
      '<div class="actions">'+
        '<button id="deliveryAuditRefresh" class="secondary" type="button">Volver a revisar</button>'+
        '<button id="deliveryAuditClose" class="secondary" type="button">Cerrar</button>'+
      '</div>'+
      (mismatch.length?body:'<div class="card"><div class="empty">✓ Todo coincide entre este iPad y Supabase.</div></div>')
    );

    document.querySelector('#deliveryAuditClose')?.addEventListener('click',()=>document.querySelector('#dialog')?.close());
    document.querySelector('#deliveryAuditRefresh')?.addEventListener('click',()=>runDeliveryAudit());

  }

  async function runDeliveryAudit(){
    const btn=document.querySelector('#deliveryAuditBtn');
    const old=btn?.textContent;
    try{
      if(btn){btn.disabled=true;btn.textContent='Auditando…'}
      const audit=await buildDeliveryAudit();
      renderAuditDialog(audit);
    }catch(e){
      alert('No se pudo completar la auditoría: '+(e?.message||e));
    }finally{
      if(btn){btn.disabled=false;btn.textContent=old||'🔎 Auditar entregas'}
    }
  }

  async function __repairDeliveryAuditDisabled(){
    const audit=lastAudit;
    if(!audit?.repairable?.length)return alert('No hay entregas por corregir.');

    if(!confirm(
      'Se corregirán '+audit.repairable.length+' registro(s) donde este iPad tiene “Entregada” y la App de Alumnos no.\n\n'+
      'No se cambiará ninguna entrega correcta de Supabase a “No entregada”. ¿Continuar?'
    ))return;

    const btn=document.querySelector('#deliveryAuditRepair');
    const old=btn?.textContent;
    try{
      if(btn){btn.disabled=true;btn.textContent='Corrigiendo…'}
      const rows=audit.repairable.map(r=>({
        activity_id:r.activityId,
        student_id:r.studentId,
        delivery_date:r.localTimestamp||new Date().toISOString()
      }));

      let updated=0;
      for(let i=0;i<rows.length;i+=60){
        const out=await window.ProfeSupabase.rpc('teacher_activity_promote_delivered',{p_rows:rows.slice(i,i+60)});
        if(!out?.ok)throw new Error(out?.reason||'No se pudo corregir un bloque.');
        updated+=Number(out.updated||0);
      }

      alert('Listo. Se corrigieron '+updated+' entrega(s) en Supabase. La App de Alumnos debe reflejarlas al actualizar.');
      const refreshed=await buildDeliveryAudit();
      renderAuditDialog(refreshed);
    }catch(e){
      alert('No se pudo completar la corrección: '+(e?.message||e));
    }finally{
      if(btn){btn.disabled=false;btn.textContent=old||'Corregir entregas en Alumno'}
    }
  }

  function installAuditButton(){
    if(document.querySelector('#deliveryAuditBtn'))return;
    const section=document.querySelector('#activities .section');
    const target=section?.querySelector('.actions')||section;
    if(!target)return;
    const btn=document.createElement('button');
    btn.id='deliveryAuditBtn';
    btn.type='button';
    btn.className='secondary';
    btn.textContent='🔎 Auditar entregas';
    target.appendChild(btn);
    btn.addEventListener('click',runDeliveryAudit);
  }

  window.addEventListener('load',()=>setTimeout(installAuditButton,700));
})();