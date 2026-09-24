// App Docente v8.23.59 · Material integrado al escáner de actividades
(function(){
  const MATERIAL_KEY='profeJaimeMaterialChecksV1';
  const MATERIAL_SELECTION_KEY='profeJaimeActivityMaterialSelectionV1';

  function mStore(){try{return JSON.parse(localStorage.getItem(MATERIAL_KEY)||'{}')||{}}catch(_){return {}}}
  function mSave(v){localStorage.setItem(MATERIAL_KEY,JSON.stringify(v))}
  function mDate(){return document.querySelector('#actMaterialDate')?.value||today()}
  function mGroup(){return document.querySelector('#actGroup')?.value||''}
  function mKey(date,group,mat){return date+'|'+group+'|'+String(mat||'').toLowerCase()}
  function mRecord(date,group,mat){return mStore()[mKey(date,group,mat)]||{statuses:{}}}
  async function absentStudentIds(date=mDate(),group=mGroup()){
    try{
      const rows=(await all('attendance')).filter(a=>a.date===date&&sameGroup(a.group,group)&&a.status==='Falta');
      return new Set(rows.map(a=>String(a.studentId)));
    }catch(_){return new Set()}
  }
  function effectiveMaterialStatus(raw,studentId,absentSet){
    if(absentSet?.has(String(studentId)))return 'absent';
    return raw||'pending';
  }
  function selectedMaterials(){
    const vals=[...document.querySelectorAll('#actMaterialChoices input[type="checkbox"]:checked')]
      .map(x=>x.value)
      .filter(v=>v!=='__CUSTOM__');
    const custom=(document.querySelector('#actMaterialCustom')?.value||'').trim();
    if(document.querySelector('#actMaterialCustomCheck')?.checked&&custom)vals.push(custom);
    return [...new Set(vals.map(x=>x.trim()).filter(Boolean))];
  }
  function saveMaterialSelection(){
    try{
      localStorage.setItem(MATERIAL_SELECTION_KEY,JSON.stringify({
        checked:[...document.querySelectorAll('#actMaterialChoices input[type="checkbox"]:checked')].map(x=>x.value),
        customChecked:!!document.querySelector('#actMaterialCustomCheck')?.checked,
        custom:(document.querySelector('#actMaterialCustom')?.value||'').trim()
      }));
    }catch(_){}
    updateMaterialRoundSummary();
  }
  function restoreMaterialSelection(){
    try{
      const s=JSON.parse(localStorage.getItem(MATERIAL_SELECTION_KEY)||'{}');
      document.querySelectorAll('#actMaterialChoices input[type="checkbox"]').forEach(x=>x.checked=(s.checked||[]).includes(x.value));
      if(document.querySelector('#actMaterialCustomCheck'))document.querySelector('#actMaterialCustomCheck').checked=!!s.customChecked;
      if(document.querySelector('#actMaterialCustom'))document.querySelector('#actMaterialCustom').value=s.custom||'';
    }catch(_){}
    updateMaterialRoundSummary();
  }
  function updateMaterialRoundSummary(){
    const el=document.querySelector('#actMaterialRoundSummary');
    if(!el)return;
    const mats=selectedMaterials();
    el.textContent=mats.length
      ?mats.length+' material'+(mats.length===1?'':'es')+' seleccionado'+(mats.length===1?'':'s')+': '+mats.join(' · ')
      :'Sin control de material en esta ronda.';
  }

  function localMark(studentId,mats,brought){
    const all=mStore(),date=mDate(),group=mGroup(),now=new Date().toISOString();
    for(const mat of mats){
      const key=mKey(date,group,mat),rec=all[key]||{statuses:{}};
      rec.date=date;rec.group=group;rec.material=mat;rec.statuses=rec.statuses||{};
      rec.statuses[String(studentId)]=brought?'yes':'no';rec.updated_at=now;
      all[key]=rec;
    }
    mSave(all);
  }

  async function cloudMark(studentId,mats,brought){
    if(!mats.length)return;
    try{
      await window.ProfeSupabase.rpc('teacher_activity_material_mark',{
        p_date:mDate(),
        p_group_name:mGroup(),
        p_material_names:mats,
        p_student_id:String(studentId),
        p_brought:!!brought
      });
    }catch(e){console.warn('Material pendiente de nube',e)}
  }

  async function markMaterialsForStudent(studentId,mats,brought=true){
    if(!mats.length||!studentId)return;
    localMark(studentId,mats,brought);
    cloudMark(studentId,mats,brought).catch(()=>{});
  }

  async function studentActuallyDeliveredSingle(studentId){
    const aid=document.querySelector('#actSelect')?.value;
    if(!aid)return false;
    try{
      const rec=await req(store('activityRecords').get(aid+'|'+studentId));
      return rec?.status==='yes';
    }catch(_){return false}
  }

  async function installWrappers(){
    if(typeof registerActivity==='function'&&!registerActivity.__materialWrapped){
      const base=registerActivity;
      const wrapped=async function(){
        const sid=norm(document.querySelector('#actScan')?.value||'');
        const mats=selectedMaterials();
        const out=await base();
        if(sid&&mats.length&&await studentActuallyDeliveredSingle(sid)){
          await markMaterialsForStudent(sid,mats,true);
          status('act','success','ENTREGA Y MATERIAL REGISTRADOS',mats.join(' · '));
        }
        return out;
      };
      wrapped.__materialWrapped=true;
      registerActivity=wrapped;
    }

    if(typeof saveMultiActivityScan==='function'&&!saveMultiActivityScan.__materialWrapped){
      const baseMulti=saveMultiActivityScan;
      const wrappedMulti=async function(){
        const st=actMultiPendingStudent?{...actMultiPendingStudent}:null;
        const mats=selectedMaterials();
        const out=await baseMulti();
        if(st?.id&&mats.length){
          await markMaterialsForStudent(st.id,mats,true);
        }
        return out;
      };
      wrappedMulti.__materialWrapped=true;
      saveMultiActivityScan=wrappedMulti;
      const b=document.querySelector('#actMultiSave');if(b)b.onclick=saveMultiActivityScan;
    }
  }

  async function materialRoster(){
    return (await students())
      .filter(s=>s.active!==false&&String(s.id)!=='00001'&&sameGroup(s.group,mGroup()))
      .sort(compareStudentsForList);
  }

  async function openMaterialReview(){
    const mats=selectedMaterials();
    if(!mats.length)return alert('Selecciona al menos un material para esta ronda.');
    const roster=await materialRoster();
    const absentSet=await absentStudentIds();

    showDialog('Control de material',
      '<div class="card grid4">'+
        '<label>Fecha de cumplimiento<input id="materialReviewDate" type="date" value="'+safe(mDate())+'" disabled></label>'+
        '<label>Grupo<input value="'+safe(mGroup())+'" disabled></label>'+
      '</div>'+
      '<div class="card">'+
        '<div class="section"><div><h3>Materiales del reporte</h3><p class="hint">Cada material se registra por separado para cada alumno.</p></div>'+
        '<div class="actions"><button id="materialReportAll" class="secondary" type="button">Seleccionar todos</button><button id="materialReportNone" class="secondary" type="button">Quitar todos</button></div></div>'+
        '<div id="materialReportChoices" class="activity-multi-choices">'+
          mats.map(m=>'<label class="activity-multi-choice"><input type="checkbox" data-material-report value="'+safe(m)+'" checked><span><b>'+safe(m)+'</b></span></label>').join('')+
        '</div>'+
      '</div>'+
      '<div class="actions">'+
        '<button id="materialFinalizeNo" class="danger-outline" type="button">Finalizar · faltantes = No trajo</button>'+
        '<button id="materialFinalizeYes" class="secondary" type="button">Finalizar · faltantes = Sí trajo</button>'+
        '<button id="materialMissingPdf2" class="primary" type="button">PDF de faltantes</button>'+
      '</div>'+
      '<div id="materialReviewSummary" class="stats" style="margin:12px 0"></div>'+
      '<div id="materialReviewMatrix" class="tablewrap"></div>'
    );

    const selectedReportMaterials=()=>[...document.querySelectorAll('[data-material-report]:checked')].map(x=>x.value);

    const render=()=>{
      let yes=0,no=0,absent=0,pending=0;
      const head=mats.map(m=>'<th>'+safe(m)+'</th>').join('');
      const body=roster.map(s=>{
        const sid=String(s.id);
        const isAbsent=absentSet.has(sid);
        const cells=mats.map(mat=>{
          const rec=mRecord(mDate(),mGroup(),mat),raw=rec.statuses?.[sid]||'pending';
          const v=effectiveMaterialStatus(raw,sid,absentSet);
          if(v==='yes')yes++;
          else if(v==='no')no++;
          else if(v==='absent')absent++;
          else pending++;

          if(isAbsent){
            return '<td class="mark"><span class="hint">No asistió</span></td>';
          }
          return '<td class="mark">'+
            '<div class="rowactions" style="justify-content:center;gap:6px;flex-wrap:wrap">'+
              '<button type="button" class="'+(v==='yes'?'primary':'secondary')+'" data-mm-yes="'+safe(sid)+'" data-mm-mat="'+safe(mat)+'">✓ Trajo</button>'+
              '<button type="button" class="'+(v==='no'?'danger':'secondary')+'" data-mm-no="'+safe(sid)+'" data-mm-mat="'+safe(mat)+'">✕ No trajo</button>'+
            '</div>'+
          '</td>';
        }).join('');
        return '<tr><td class="num">'+safe(s.number||'—')+'</td><td class="name">'+safe(studentListDisplayName(s))+(isAbsent?'<br><small><b>No asistió</b></small>':'')+'</td>'+cells+'</tr>';
      }).join('');

      document.querySelector('#materialReviewSummary').innerHTML=
        '<div class="stat"><b>'+yes+'</b><span>Trajo</span></div>'+
        '<div class="stat"><b>'+no+'</b><span>No trajo</span></div>'+
        '<div class="stat"><b>'+absent+'</b><span>No asistió</span></div>'+
        '<div class="stat"><b>'+pending+'</b><span>Sin marcar</span></div>';

      document.querySelector('#materialReviewMatrix').innerHTML=
        '<table class="matrix"><thead><tr><th class="num">#</th><th class="name">Alumno</th>'+head+'</tr></thead><tbody>'+body+'</tbody></table>';

      document.querySelectorAll('[data-mm-yes]').forEach(b=>b.onclick=async()=>{
        await markMaterialsForStudent(b.dataset.mmYes,[b.dataset.mmMat],true);
        render();
      });
      document.querySelectorAll('[data-mm-no]').forEach(b=>b.onclick=async()=>{
        await markMaterialsForStudent(b.dataset.mmNo,[b.dataset.mmMat],false);
        render();
      });
    };

    const finalizeAs=async(brought)=>{
      const chosen=selectedReportMaterials();
      if(!chosen.length)return alert('Selecciona al menos un material.');
      const label=brought?'Sí trajo':'No trajo';
      if(!confirm('Los alumnos que sigan sin marca quedarán como “'+label+'” únicamente en los materiales seleccionados. Quienes tengan Falta quedarán como “No asistió”. Las marcas existentes no se cambiarán. ¿Continuar?'))return;

      const all=mStore();
      for(const mat of chosen){
        const key=mKey(mDate(),mGroup(),mat),rec=all[key]||{statuses:{}};
        rec.date=mDate();rec.group=mGroup();rec.material=mat;rec.statuses=rec.statuses||{};
        roster.forEach(s=>{
          const sid=String(s.id);
          if(absentSet.has(sid))rec.statuses[sid]='absent';
          else if(!rec.statuses[sid])rec.statuses[sid]=brought?'yes':'no';
        });
        rec.updated_at=new Date().toISOString();
        all[key]=rec;
      }
      mSave(all);

      try{
        await window.ProfeSupabase.rpc('teacher_activity_material_finalize_as',{
          p_date:mDate(),
          p_group_name:mGroup(),
          p_material_names:chosen,
          p_brought:!!brought
        });
      }catch(e){console.warn('Finalización de material pendiente de nube',e)}
      render();
    };

    document.querySelector('#materialReportAll').onclick=()=>document.querySelectorAll('[data-material-report]').forEach(x=>x.checked=true);
    document.querySelector('#materialReportNone').onclick=()=>document.querySelectorAll('[data-material-report]').forEach(x=>x.checked=false);
    document.querySelector('#materialFinalizeNo').onclick=()=>finalizeAs(false);
    document.querySelector('#materialFinalizeYes').onclick=()=>finalizeAs(true);
    document.querySelector('#materialMissingPdf2').onclick=()=>{
      const chosen=selectedReportMaterials();
      if(!chosen.length)return alert('Selecciona al menos un material para el reporte.');
      generateCombinedMaterialPdf(chosen,roster).catch(e=>alert('No se pudo generar el PDF: '+(e?.message||e)));
    };
    render();
  }

  async function generateCombinedMaterialPdf(mats,roster){
    const jsPDF=window.jspdf?.jsPDF;if(!jsPDF)return alert('No se pudo cargar el generador PDF.');
    const rows=[];
    const complianceDate=mDate();
    const absentSet=await absentStudentIds(complianceDate,mGroup());
    const [cy,cm,cd]=complianceDate.split('-');
    const complianceLabel=cd&&cm&&cy?cd+'/'+cm+'/'+cy:complianceDate;
    for(const mat of mats){
      const rec=mRecord(complianceDate,mGroup(),mat),st=rec.statuses||{};
      roster.forEach(s=>{
        const v=effectiveMaterialStatus(st[String(s.id)],s.id,absentSet);
        if(v==='no')rows.push([complianceLabel,mat,String(s.number||'—'),s.name||'','No trajo']);
        else if(v==='absent')rows.push([complianceLabel,mat,String(s.number||'—'),s.name||'','No asistió']);
      });
    }
    if(!rows.length)return alert('No hay alumnos con faltante de material ni ausencias en los materiales seleccionados.');
    const doc=new jsPDF({unit:'mm',format:'letter'});
    pdfHeader(doc,'Alumnos sin material','ESPAÑOL');
    doc.setFontSize(10);doc.setTextColor(40,40,40);
    const [y,m,d]=mDate().split('-');
    doc.text('Grupo: '+mGroup(),14,36);
    doc.text('Fecha de cumplimiento: '+(d&&m&&y?d+'/'+m+'/'+y:mDate()),14,42);
    doc.text('Materiales revisados: '+mats.join(', '),14,48);
    doc.autoTable({
      startY:55,
      head:[['Cumplimiento','Material','No.','Alumno(a)','Estado']],
      body:rows,
      styles:{fontSize:9,cellPadding:2.4,lineColor:[220,220,220],lineWidth:.15},
      headStyles:{fillColor:[245,196,0],textColor:[33,27,18]},
      columnStyles:{0:{cellWidth:30},1:{cellWidth:44},2:{cellWidth:14},3:{cellWidth:72},4:{cellWidth:28}}
    });
    pdfFooter(doc);
    const file='Sin_material_'+mGroup()+'_'+mDate()+'.pdf';
    printContent('Alumnos sin material','',pdfBlob(doc),file);
  }

  function materialMode(){return document.querySelector('#actMaterialMode')?.value||'with_activity'}

  async function registerOnlyMaterial(){
    const mats=selectedMaterials();
    if(!mats.length)return status('act','warning','Selecciona material','Marca al menos un material para esta ronda.');
    const input=document.querySelector('#actScan');
    const sid=norm(input?.value||'');
    if(input){input.value='';input.focus()}
    if(!sid)return;
    const st=await studentForSelectedGroup(sid,document.querySelector('#actShift')?.value,document.querySelector('#actGroup')?.value);
    if(!st){
      const raw=await req(store('students').get(sid));
      return raw?status('act','warning','Otro grupo',`${raw.name||sid}: ${raw.shift}, ${raw.group}`):status('act','warning','ID no encontrado',sid);
    }
    await markMaterialsForStudent(st.id,mats,true);
    status('act','success','MATERIAL REGISTRADO',`${st.name||sid} · ${mats.join(' · ')}`);
  }

  function syncMaterialOnlyUi(){
    const only=materialMode()==='only_material';
    const btn=document.querySelector('#actRegister');
    if(btn)btn.textContent=only?'Registrar material':(activityScanMode()==='multi'?'Escanear alumno':'Registrar entrega');
    const single=document.querySelector('#actSinglePicker'),multi=document.querySelector('#actMultiPicker'),stats=document.querySelector('#actSingleStats');
    if(only){
      single?.classList.add('hidden');
      multi?.classList.add('hidden');
      stats?.classList.add('hidden');
      document.querySelector('#actMultiConfirm')?.classList.add('hidden');
      status('act','neutral','Escanea para registrar material','No se modificará ninguna actividad.');
    }else{
      setActivityScanMode().catch(()=>{});
    }
  }

  const priorRegisterByMode=registerActivityByMode;
  registerActivityByMode=async function(){
    if(materialMode()==='only_material')return registerOnlyMaterial();
    return priorRegisterByMode();
  };

  function installActivityMaterialUI(){
    document.querySelector('#materialControlCard')?.remove();

    const anchor=document.querySelector('#actMultiPicker')||document.querySelector('#actSinglePicker');
    if(!anchor||document.querySelector('#actMaterialPanel'))return;
    const panel=document.createElement('div');
    panel.id='actMaterialPanel';panel.className='card';
    panel.innerHTML=
      '<div class="section"><div><h2>📎 Material para esta ronda</h2>'+
      '<p class="hint">Puedes registrarlo junto con actividades o usar el escáner únicamente para material.</p></div>'+
      '<button id="actMaterialReviewBtn" class="secondary" type="button">Revisar / PDF</button></div>'+
      '<div class="grid4">'+
        '<label>Fecha de cumplimiento<input id="actMaterialDate" type="date"></label>'+
        '<label>Modo de registro<select id="actMaterialMode"><option value="with_activity">Junto con actividades</option><option value="only_material">Solo material</option></select></label>'+
      '</div>'+
      '<div id="actMaterialChoices" class="activity-multi-choices">'+
        '<label class="activity-multi-choice"><input type="checkbox" value="Gafete"><span><b>Gafete</b></span></label>'+
        '<label class="activity-multi-choice"><input type="checkbox" value="Cuaderno de dictados"><span><b>Cuaderno de dictados</b></span></label>'+
        '<label class="activity-multi-choice"><input type="checkbox" value="Cuaderno de apuntes"><span><b>Cuaderno de apuntes</b></span></label>'+
        '<label class="activity-multi-choice"><input type="checkbox" value="Libro de Español"><span><b>Libro de Español</b></span></label>'+
        '<label class="activity-multi-choice material-custom-choice"><input id="actMaterialCustomCheck" type="checkbox" value="__CUSTOM__"><span style="display:block;min-width:0;flex:1"><b>Otro material</b><input id="actMaterialCustom" type="text" maxlength="80" placeholder="Ej. mapa, investigación, hojas de color" style="display:block;width:100%;min-width:260px;box-sizing:border-box;margin-top:8px;padding:11px 12px;border:1px solid #c9c9c9;border-radius:10px;font-size:16px;background:#fff;color:#211b12"></span></label>'+
      '</div>'+
      '<p id="actMaterialRoundSummary" class="hint">Sin control de material en esta ronda.</p>';
    anchor.insertAdjacentElement('afterend',panel);
    document.querySelector('#actMaterialDate').value=today();
    try{
      const savedMode=localStorage.getItem('profeJaimeActivityMaterialModeV1')||'with_activity';
      document.querySelector('#actMaterialMode').value=savedMode;
    }catch(_){}
    restoreMaterialSelection();
    document.querySelectorAll('#actMaterialChoices input[type="checkbox"]').forEach(x=>x.addEventListener('change',saveMaterialSelection));
    document.querySelector('#actMaterialCustom').addEventListener('change',saveMaterialSelection);
    document.querySelector('#actMaterialCustom').addEventListener('input',e=>{
      const cb=document.querySelector('#actMaterialCustomCheck');
      if(cb&&String(e.target.value||'').trim())cb.checked=true;
      saveMaterialSelection();
    });
    document.querySelector('#actMaterialMode').addEventListener('change',e=>{
      try{localStorage.setItem('profeJaimeActivityMaterialModeV1',e.target.value)}catch(_){}
      syncMaterialOnlyUi();
    });
    document.querySelector('#actMaterialReviewBtn').onclick=()=>openMaterialReview().catch(e=>alert('No se pudo abrir el control: '+(e?.message||e)));
    syncMaterialOnlyUi();
  }

  window.addEventListener('load',()=>setTimeout(async()=>{
    installActivityMaterialUI();
    await installWrappers();
  },700));
})();