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
  function selectedMaterials(){
    const vals=[...document.querySelectorAll('#actMaterialChoices input[type="checkbox"]:checked')].map(x=>x.value);
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
    const opts=mats.map(m=>'<option value="'+safe(m)+'">'+safe(m)+'</option>').join('');
    showDialog('Control de material',
      '<div class="card grid4">'+
        '<label>Fecha<input id="materialReviewDate" type="date" value="'+safe(mDate())+'" disabled></label>'+
        '<label>Grupo<input value="'+safe(mGroup())+'" disabled></label>'+
        '<label>Material<select id="materialReviewSelect">'+opts+'</select></label>'+
      '</div>'+
      '<div class="actions"><button id="materialFinalize" class="danger-outline" type="button">Finalizar · faltantes = No trajo</button><button id="materialMissingPdf2" class="primary" type="button">PDF de faltantes</button></div>'+
      '<div id="materialReviewSummary" class="stats" style="margin:12px 0"></div>'+
      '<div id="materialReviewList" class="list"></div>'
    );

    const render=()=>{
      const mat=document.querySelector('#materialReviewSelect')?.value||mats[0];
      const rec=mRecord(mDate(),mGroup(),mat),st=rec.statuses||{};
      const yes=roster.filter(s=>st[String(s.id)]==='yes').length;
      const no=roster.filter(s=>st[String(s.id)]==='no').length;
      const pend=roster.length-yes-no;
      document.querySelector('#materialReviewSummary').innerHTML=
        '<div class="stat"><b>'+yes+'</b><span>Trajeron</span></div>'+
        '<div class="stat"><b>'+no+'</b><span>No trajeron</span></div>'+
        '<div class="stat"><b>'+pend+'</b><span>Sin marcar</span></div>';
      document.querySelector('#materialReviewList').innerHTML=roster.map(s=>{
        const v=st[String(s.id)]||'pending';
        return '<div class="row"><div><strong>'+safe(studentListDisplayName(s))+'</strong><small>Lista '+safe(s.number||'—')+'</small></div>'+
          '<div class="rowactions"><button type="button" class="'+(v==='yes'?'primary':'secondary')+'" data-mreview-yes="'+safe(s.id)+'">✓ Trajo</button>'+
          '<button type="button" class="'+(v==='no'?'danger':'secondary')+'" data-mreview-no="'+safe(s.id)+'">✕ No trajo</button></div></div>';
      }).join('');
      document.querySelectorAll('[data-mreview-yes]').forEach(b=>b.onclick=async()=>{await markMaterialsForStudent(b.dataset.mreviewYes,[mat],true);render()});
      document.querySelectorAll('[data-mreview-no]').forEach(b=>b.onclick=async()=>{await markMaterialsForStudent(b.dataset.mreviewNo,[mat],false);render()});
    };

    document.querySelector('#materialReviewSelect').onchange=render;
    document.querySelector('#materialFinalize').onclick=async()=>{
      if(!confirm('Los alumnos sin marca quedarán como “No trajo” en todos los materiales seleccionados. ¿Continuar?'))return;
      const all=mStore();
      for(const mat of mats){
        const key=mKey(mDate(),mGroup(),mat),rec=all[key]||{statuses:{}};
        rec.date=mDate();rec.group=mGroup();rec.material=mat;rec.statuses=rec.statuses||{};
        roster.forEach(s=>{if(!rec.statuses[String(s.id)])rec.statuses[String(s.id)]='no'});
        rec.updated_at=new Date().toISOString();all[key]=rec;
      }
      mSave(all);
      try{
        await window.ProfeSupabase.rpc('teacher_activity_material_finalize',{
          p_date:mDate(),p_group_name:mGroup(),p_material_names:mats
        });
      }catch(e){console.warn('Finalización de material pendiente de nube',e)}
      render();
    };
    document.querySelector('#materialMissingPdf2').onclick=()=>generateCombinedMaterialPdf(mats,roster);
    render();
  }

  function generateCombinedMaterialPdf(mats,roster){
    const jsPDF=window.jspdf?.jsPDF;if(!jsPDF)return alert('No se pudo cargar el generador PDF.');
    const rows=[];
    for(const mat of mats){
      const rec=mRecord(mDate(),mGroup(),mat),st=rec.statuses||{};
      roster.forEach(s=>{if(st[String(s.id)]==='no')rows.push([mat,String(s.number||'—'),s.name||''])});
    }
    if(!rows.length)return alert('No hay alumnos marcados como “No trajo” en los materiales seleccionados.');
    const doc=new jsPDF({unit:'mm',format:'letter'});
    pdfHeader(doc,'Alumnos sin material','ESPAÑOL');
    doc.setFontSize(10);doc.setTextColor(40,40,40);
    const [y,m,d]=mDate().split('-');
    doc.text('Grupo: '+mGroup(),14,36);
    doc.text('Fecha: '+(d&&m&&y?d+'/'+m+'/'+y:mDate()),14,42);
    doc.text('Materiales revisados: '+mats.join(', '),14,48);
    doc.autoTable({
      startY:55,
      head:[['Material','No.','Alumno(a)']],
      body:rows,
      styles:{fontSize:9,cellPadding:2.4,lineColor:[220,220,220],lineWidth:.15},
      headStyles:{fillColor:[245,196,0],textColor:[33,27,18]},
      columnStyles:{0:{cellWidth:58},1:{cellWidth:18},2:{cellWidth:105}}
    });
    pdfFooter(doc);
    const file='Sin_material_'+mGroup()+'_'+mDate()+'.pdf';
    printContent('Alumnos sin material','',pdfBlob(doc),file);
  }

  function installActivityMaterialUI(){
    document.querySelector('#materialControlCard')?.remove();

    const anchor=document.querySelector('#actMultiPicker')||document.querySelector('#actSinglePicker');
    if(!anchor||document.querySelector('#actMaterialPanel'))return;
    const panel=document.createElement('div');
    panel.id='actMaterialPanel';panel.className='card';
    panel.innerHTML=
      '<div class="section"><div><h2>📎 Material para esta ronda</h2>'+
      '<p class="hint">Selecciona uno o varios. Al registrar la entrega del alumno, también quedará marcado que sí trajo estos materiales.</p></div>'+
      '<button id="actMaterialReviewBtn" class="secondary" type="button">Revisar / PDF</button></div>'+
      '<div class="grid4"><label>Fecha del control<input id="actMaterialDate" type="date"></label></div>'+
      '<div id="actMaterialChoices" class="activity-multi-choices">'+
        '<label class="activity-multi-choice"><input type="checkbox" value="Gafete"><span><b>Gafete</b></span></label>'+
        '<label class="activity-multi-choice"><input type="checkbox" value="Cuaderno de dictados"><span><b>Cuaderno de dictados</b></span></label>'+
        '<label class="activity-multi-choice"><input type="checkbox" value="Cuaderno de apuntes"><span><b>Cuaderno de apuntes</b></span></label>'+
        '<label class="activity-multi-choice"><input type="checkbox" value="Libro de Español"><span><b>Libro de Español</b></span></label>'+
        '<label class="activity-multi-choice"><input id="actMaterialCustomCheck" type="checkbox" value="__CUSTOM__"><span><b>Otro material</b><input id="actMaterialCustom" type="text" maxlength="80" placeholder="Ej. mapa, investigación, hojas de color" style="margin-top:6px"></span></label>'+
      '</div>'+
      '<p id="actMaterialRoundSummary" class="hint">Sin control de material en esta ronda.</p>';
    anchor.insertAdjacentElement('afterend',panel);
    document.querySelector('#actMaterialDate').value=today();
    restoreMaterialSelection();
    document.querySelectorAll('#actMaterialChoices input[type="checkbox"]').forEach(x=>x.addEventListener('change',saveMaterialSelection));
    document.querySelector('#actMaterialCustom').addEventListener('change',saveMaterialSelection);
    document.querySelector('#actMaterialCustom').addEventListener('input',updateMaterialRoundSummary);
    document.querySelector('#actMaterialReviewBtn').onclick=()=>openMaterialReview().catch(e=>alert('No se pudo abrir el control: '+(e?.message||e)));
  }

  window.addEventListener('load',()=>setTimeout(async()=>{
    installActivityMaterialUI();
    await installWrappers();
  },700));
})();