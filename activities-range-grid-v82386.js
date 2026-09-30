// App Docente v8.23.86 · Actividades · cuadrícula editable por rango
(function(){
  const $r=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>String(v??'').trim().toLowerCase().replace(/[^0-9a-záéíóúüñ]/gi,'');
  const same=(a,b)=>{try{return typeof sameGroup==='function'?sameGroup(a,b):norm(a)===norm(b)}catch(_){return norm(a)===norm(b)}};
  const sameS=(a,b)=>{try{return typeof sameShift==='function'?sameShift(a,b):norm(a)===norm(b)}catch(_){return norm(a)===norm(b)}};
  const key=(a,s)=>String(a)+'|'+String(s);
  let current={activities:[],students:[],records:new Map()};

  function monthBounds(date=new Date()){
    const y=date.getFullYear(),m=date.getMonth();
    const z=n=>String(n).padStart(2,'0');
    return {
      from:y+'-'+z(m+1)+'-01',
      to:y+'-'+z(m+1)+'-'+z(new Date(y,m+1,0).getDate())
    };
  }

  function ensureStyle(){
    if(document.getElementById('activity-range-style-v82386'))return;
    const st=document.createElement('style');
    st.id='activity-range-style-v82386';
    st.textContent=`
      #act-range .range-controls{display:grid;grid-template-columns:repeat(5,minmax(130px,1fr));gap:12px;align-items:end}
      #act-range .range-controls label{font-weight:800}
      #act-range .range-controls select,#act-range .range-controls input,#act-range .range-controls button{width:100%;box-sizing:border-box}
      #activityRangeGrid table{border-collapse:separate;border-spacing:0;min-width:max-content;width:100%}
      #activityRangeGrid th,#activityRangeGrid td{border-right:1px solid #ead9a8;border-bottom:1px solid #ead9a8;padding:8px 9px;text-align:center;vertical-align:middle;background:#fff}
      #activityRangeGrid thead th{position:sticky;top:0;z-index:3;background:#f5c400;color:#211b12;font-size:.82rem}
      #activityRangeGrid th.range-num,#activityRangeGrid td.range-num{position:sticky;left:0;z-index:4;min-width:44px}
      #activityRangeGrid th.range-student,#activityRangeGrid td.range-student{position:sticky;left:44px;z-index:4;min-width:220px;text-align:left}
      #activityRangeGrid tbody td.range-num,#activityRangeGrid tbody td.range-student{background:#fff}
      #activityRangeGrid .range-delivery{cursor:pointer;min-width:112px;font-size:1.18rem;font-weight:900;user-select:none}
      #activityRangeGrid .range-delivery.yes{background:#dff5e6;color:#176b35}
      #activityRangeGrid .range-delivery.no{background:#fbe1e4;color:#a91d2a}
      #activityRangeGrid .range-delivery.pending{background:#fff;color:#8b7f67}
      #activityRangeGrid .range-score{width:76px;min-width:76px;text-align:center;font-weight:800;padding:8px}
      #activityRangeGrid .range-act-head{min-width:130px;max-width:170px;white-space:normal}
      #activityRangeGrid .range-act-head small{display:block;font-weight:600;opacity:.72;margin-top:3px}
      #activityRangeStatus{margin-top:10px}
      @media(max-width:850px){#act-range .range-controls{grid-template-columns:1fr 1fr}#act-range .range-controls .range-action{grid-column:1/-1}}
      @media(max-width:520px){#act-range .range-controls{grid-template-columns:1fr}#act-range .range-controls .range-action{grid-column:auto}#activityRangeGrid th.range-student,#activityRangeGrid td.range-student{min-width:180px}}
    `;
    document.head.appendChild(st);
  }

  async function fillSelectors(){
    if(typeof ensureDB==='function')await ensureDB();
    const sts=typeof students==='function'?await students():await all('students');
    const shiftSel=$r('#rangeShift'),groupSel=$r('#rangeGroup');
    if(!shiftSel||!groupSel)return;

    const shifts=[...new Set((sts||[]).map(s=>String(s.shift||'').trim()).filter(Boolean))]
      .sort((a,b)=>a.localeCompare(b,'es',{numeric:true}));
    const preferredShift=shiftSel.value||$r('#gridShift')?.value||shifts[0]||'';
    shiftSel.innerHTML=shifts.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('');
    if(shifts.includes(preferredShift))shiftSel.value=preferredShift;

    const groups=[...new Set((sts||[]).filter(s=>sameS(s.shift,shiftSel.value)).map(s=>String(s.group||s.group_name||'').trim()).filter(Boolean))]
      .sort((a,b)=>a.localeCompare(b,'es',{numeric:true}));
    const preferredGroup=groupSel.value||$r('#gridGroup')?.value||groups[0]||'';
    groupSel.innerHTML=groups.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('');
    if(groups.includes(preferredGroup))groupSel.value=preferredGroup;
  }

  async function refreshGroups(){
    const sts=typeof students==='function'?await students():await all('students');
    const shift=$r('#rangeShift')?.value||'';
    const g=$r('#rangeGroup');if(!g)return;
    const old=g.value;
    const groups=[...new Set((sts||[]).filter(s=>sameS(s.shift,shift)).map(s=>String(s.group||s.group_name||'').trim()).filter(Boolean))]
      .sort((a,b)=>a.localeCompare(b,'es',{numeric:true}));
    g.innerHTML=groups.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('');
    if(groups.includes(old))g.value=old;
  }

  function studentLabel(s){
    try{return typeof studentListDisplayName==='function'?studentListDisplayName(s):(s.name||s.id)}catch(_){return s.name||s.id}
  }

  async function loadRange(){
    const box=$r('#activityRangeGrid'),status=$r('#activityRangeStatus');
    if(!box)return;
    const shift=$r('#rangeShift')?.value||'',group=$r('#rangeGroup')?.value||'';
    const from=$r('#rangeFrom')?.value||'',to=$r('#rangeTo')?.value||'';
    if(!from||!to||from>to){
      if(status){status.className='message bad';status.textContent='Revisa el rango de fechas.'}
      return;
    }
    if(status){status.className='message';status.textContent='Actualizando cuadrícula…'}
    box.innerHTML='<div class="empty">Cargando actividades…</div>';

    try{
      if(typeof ensureDB==='function')await ensureDB();
      const [acts,sts,recs]=await Promise.all([
        all('activities'),
        typeof students==='function'?students():all('students'),
        all('activityRecords')
      ]);
      const filteredActs=(acts||[]).filter(a=>{
        const d=String(a.date||a.assignedDate||a.dueDate||'');
        return sameS(a.shift,shift)&&same(a.group,group)&&d>=from&&d<=to;
      }).sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))||String(a.name||'').localeCompare(String(b.name||''),'es',{sensitivity:'base'}));

      const filteredStudents=(sts||[]).filter(s=>sameS(s.shift,shift)&&same(s.group||s.group_name,group))
        .sort((a,b)=>{
          try{return typeof compareStudentsForList==='function'?compareStudentsForList(a,b):(Number(a.number||a.list_number||999)-Number(b.number||b.list_number||999)||String(a.name||'').localeCompare(String(b.name||''),'es'))}
          catch(_){return Number(a.number||a.list_number||999)-Number(b.number||b.list_number||999)}
        });

      const map=new Map();
      for(const r of recs||[])map.set(key(r.activityId||r.activity_id,r.studentId||r.student_id),r);
      current={activities:filteredActs,students:filteredStudents,records:map};

      if(!filteredActs.length){
        box.innerHTML='<div class="empty">No hay actividades registradas para este grupo dentro del rango seleccionado.</div>';
        if(status){status.className='message';status.textContent='0 actividades en el rango.'}
        return;
      }

      let html='<table><thead><tr><th class="range-num">#</th><th class="range-student">Alumno</th>';
      html+=filteredActs.map(a=>'<th class="range-act-head">'+esc(a.name||'Actividad')+'<small>'+esc(a.date||'')+' · '+esc(a.evaluationMode==='numeric'?'Numérica':'Entrega')+'</small></th>').join('');
      html+='</tr></thead><tbody>';

      for(const st of filteredStudents){
        const sid=String(st.id);
        html+='<tr><td class="range-num">'+esc(st.number??st.list_number??'—')+'</td><td class="range-student">'+esc(studentLabel(st))+'</td>';
        for(const a of filteredActs){
          const aid=String(a.id),r=map.get(key(aid,sid));
          if((a.evaluationMode||'delivery')==='numeric'){
            const val=(r&&typeof r.score==='number'&&Number.isFinite(r.score))?String(r.score):'';
            html+='<td><input class="range-score" inputmode="decimal" type="number" min="0" max="10" step="0.1" value="'+esc(val)+'" data-range-score data-aid="'+esc(aid)+'" data-sid="'+esc(sid)+'" aria-label="'+esc((a.name||'Actividad')+' '+studentLabel(st))+'"></td>';
          }else{
            const state=r?.status==='yes'?'yes':r?.status==='no'?'no':'pending';
            const icon=state==='yes'?'●':state==='no'?'●':'○';
            const title=state==='yes'?'Entregó':state==='no'?'No entregó':'Pendiente';
            html+='<td class="range-delivery '+state+'" data-range-delivery data-aid="'+esc(aid)+'" data-sid="'+esc(sid)+'" title="'+title+'">'+icon+'</td>';
          }
        }
        html+='</tr>';
      }
      html+='</tbody></table>';
      box.innerHTML=html;
      bindCells();
      if(status){
        status.className='message good';
        status.textContent=filteredActs.length+' actividad'+(filteredActs.length===1?'':'es')+' · '+filteredStudents.length+' alumno'+(filteredStudents.length===1?'':'s')+' · '+from+' a '+to;
      }
    }catch(e){
      console.error('Cuadrícula por rango',e);
      box.innerHTML='<div class="empty">No se pudo cargar la cuadrícula.</div>';
      if(status){status.className='message bad';status.textContent='No se pudo actualizar: '+(e?.message||e)}
    }
  }

  async function serverMerge(aid,sid,{status,score}={}){
    if(!window.ProfeSupabase)throw new Error('Sin conexión con Supabase.');
    const now=new Date().toISOString();
    const row={activity_id:String(aid),student_id:String(sid),
      delivered:status==='yes'?true:status==='no'?false:null,
      score:typeof score==='number'?score:null,delivery_date:now,
      data:{key:key(aid,sid),activityId:String(aid),studentId:String(sid),
        ...(status?{status}:{}),...(typeof score==='number'?{score}:{}),timestamp:now}};
    const out=await window.ProfeSupabase.rpc('teacher_activity_records_merge_safe',{p_rows:[row]});
    if(out?.ok===false||Number(out?.merged||0)!==1)throw new Error(out?.error||'Supabase no confirmó el cambio.');
    return now;
  }
  async function serverClear(aid,sid){
    if(!window.ProfeSupabase)throw new Error('Sin conexión con Supabase.');
    const out=await window.ProfeSupabase.rpc('teacher_activity_record_clear',{p_activity_id:String(aid),p_student_id:String(sid)});
    if(out?.ok===false)throw new Error(out?.error||'Supabase no confirmó el cambio.');
  }

  async function saveDelivery(cell){
    if(cell.dataset.saving==='1')return;
    const aid=cell.dataset.aid,sid=cell.dataset.sid,k=key(aid,sid);
    const old=current.records.get(k)||null;
    const oldState=old?.status==='yes'?'yes':old?.status==='no'?'no':'pending';
    const next=oldState==='pending'?'yes':oldState==='yes'?'no':'pending';
    cell.dataset.saving='1';
    try{
      // SERVIDOR PRIMERO. El iPad solo refleja lo que Supabase confirmó.
      if(next==='pending') await serverClear(aid,sid);
      else {
        const stamp=await serverMerge(aid,sid,{status:next});
        const rec={...(old||{}),key:k,activityId:aid,studentId:sid,status:next,timestamp:stamp};
        delete rec.score;
        if(typeof put!=='function')throw new Error('No está disponible la caché local.');
        await put('activityRecords',rec);
        current.records.set(k,rec);
      }
      if(next==='pending'){
        if(old&&typeof del==='function')await del('activityRecords',old.key||k);
        current.records.delete(k);
      }
      cell.classList.remove('yes','no','pending');cell.classList.add(next);
      cell.textContent=next==='pending'?'○':'●';
      cell.title=next==='yes'?'Entregó':next==='no'?'No entregó':'Pendiente';
      if(next==='yes'){
        try{const act=current.activities.find(x=>String(x.id)===String(aid));
          if(act&&typeof sameShift==='function'&&sameShift(act.shift,'Matutino')&&window.ProfeSupabase)
            await window.ProfeSupabase.edge('send-push',{event:'activity_update',student_id:String(sid),title:act.name||'Actividad',message:`${act.name||'Actividad'} · Estado: Entregada`,status:'yes'});
        }catch(e){console.warn('Notificación de actividad entregada',e)}
      }
    }catch(e){
      alert('NO GUARDADO. No se cambió el registro porque Supabase no lo confirmó: '+(e?.message||e));
    }finally{delete cell.dataset.saving}
  }

  async function saveScore(input){
    if(input.dataset.saving==='1')return;
    const aid=input.dataset.aid,sid=input.dataset.sid,k=key(aid,sid);
    const old=current.records.get(k)||null,raw=String(input.value||'').trim();
    if(raw!==''){const n=Number(raw);if(!Number.isFinite(n)||n<0||n>10){alert('La calificación debe estar entre 0 y 10.');input.value=(old&&typeof old.score==='number')?old.score:'';return}}
    input.dataset.saving='1';
    try{
      if(raw===''){
        await serverClear(aid,sid);
        if(old&&typeof del==='function')await del('activityRecords',old.key||k);
        current.records.delete(k);
      }else{
        const n=Number(raw),stamp=await serverMerge(aid,sid,{score:n});
        const rec={...(old||{}),key:k,activityId:aid,studentId:sid,score:n,timestamp:stamp};
        delete rec.status;
        if(typeof put!=='function')throw new Error('No está disponible la caché local.');
        await put('activityRecords',rec);current.records.set(k,rec);
      }
      input.style.outline='2px solid #52a66a';setTimeout(()=>{input.style.outline=''},700);
    }catch(e){
      input.value=(old&&typeof old.score==='number')?old.score:'';
      alert('NO GUARDADA. No se cambió la calificación porque Supabase no la confirmó: '+(e?.message||e));
    }finally{delete input.dataset.saving}
  }

  function bindCells(){
    document.querySelectorAll('#activityRangeGrid [data-range-delivery]').forEach(el=>el.addEventListener('click',()=>saveDelivery(el)));
    document.querySelectorAll('#activityRangeGrid [data-range-score]').forEach(el=>{
      el.addEventListener('change',()=>saveScore(el));
      el.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();el.blur()}});
    });
  }

  function install(){
    ensureStyle();
    const subtabs=document.querySelector('#activities .subtabs');
    const manageBtn=subtabs?.querySelector('[data-acttab="manage"]');
    if(!subtabs||!manageBtn)return;

    if(!subtabs.querySelector('[data-acttab="range"]')){
      const btn=document.createElement('button');
      btn.type='button';btn.className='sub';btn.dataset.acttab='range';btn.textContent='Cuadrícula por rango';
      subtabs.insertBefore(btn,manageBtn);

      const pane=document.createElement('div');
      pane.id='act-range';pane.className='actpane';
      const b=monthBounds();
      pane.innerHTML='<div class="card range-controls">'+
        '<label>Turno<select id="rangeShift"></select></label>'+
        '<label>Grupo<select id="rangeGroup"></select></label>'+
        '<label>Desde<input id="rangeFrom" type="date" value="'+b.from+'"></label>'+
        '<label>Hasta<input id="rangeTo" type="date" value="'+b.to+'"></label>'+
        '<label class="range-action">Acción<button id="rangeRefresh" class="primary" type="button">Actualizar</button></label>'+
      '</div>'+
      '<div class="card" style="padding:12px 14px"><div class="section"><div><h2 style="margin:0">Actividades del rango</h2><p class="hint" style="margin:4px 0 0">Aquí puedes actualizar manualmente entregas y calificaciones igual que en la cuadrícula semanal.</p></div><button id="rangeCurrentMonth" class="secondary" type="button">Mes actual</button></div><p id="activityRangeStatus" class="message"></p></div>'+
      '<div id="activityRangeGrid" class="tablewrap"><div class="empty">Pulsa Actualizar para cargar las actividades.</div></div>';

      const gridPane=document.querySelector('#act-grid');
      gridPane?.parentNode?.insertBefore(pane,gridPane.nextSibling);

      btn.addEventListener('click',async e=>{
        e.preventDefault();
        subtabs.querySelectorAll('[data-acttab]').forEach(x=>x.classList.remove('active'));
        document.querySelectorAll('#activities .actpane').forEach(x=>x.classList.remove('active'));
        btn.classList.add('active');pane.classList.add('active');
        await fillSelectors();
        if(!$r('#activityRangeGrid table'))loadRange();
      });
    }

    const btn=subtabs.querySelector('[data-acttab="range"]');
    // Asegura compatibilidad si el manejador general de pestañas se ejecuta antes/después.
    btn?.addEventListener('click',()=>setTimeout(()=>{
      document.querySelectorAll('#activities .actpane').forEach(x=>x.classList.remove('active'));
      document.querySelectorAll('#activities .subtabs [data-acttab]').forEach(x=>x.classList.remove('active'));
      btn.classList.add('active');$r('#act-range')?.classList.add('active');
    },0));

    fillSelectors().catch(()=>{});
    $r('#rangeShift')?.addEventListener('change',async()=>{await refreshGroups()});
    $r('#rangeRefresh')?.addEventListener('click',loadRange);
    $r('#rangeCurrentMonth')?.addEventListener('click',()=>{
      const b=monthBounds();$r('#rangeFrom').value=b.from;$r('#rangeTo').value=b.to;loadRange();
    });
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,500));
  else setTimeout(install,500);
})();