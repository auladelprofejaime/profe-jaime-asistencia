// App Docente v8.23.58 · Control de material y reporte PDF
(function(){
  const MATERIAL_KEY='profeJaimeMaterialChecksV1';
  let materialRoster=[];

  function materialStore(){
    try{return JSON.parse(localStorage.getItem(MATERIAL_KEY)||'{}')||{}}catch(_){return {}}
  }
  function saveMaterialStore(data){
    localStorage.setItem(MATERIAL_KEY,JSON.stringify(data));
  }
  function materialName(){
    const preset=document.querySelector('#materialType')?.value||'';
    if(preset==='__OTHER__')return (document.querySelector('#materialCustom')?.value||'').trim();
    return preset.trim();
  }
  function materialSessionKey(){
    const date=document.querySelector('#materialDate')?.value||'';
    const group=document.querySelector('#materialGroup')?.value||'';
    const mat=materialName().toLowerCase();
    return date+'|'+group+'|'+mat;
  }
  function currentMaterialRecord(){
    const all=materialStore();
    return all[materialSessionKey()]||{statuses:{},updated_at:null};
  }
  function saveCurrentMaterialRecord(rec){
    const key=materialSessionKey();
    if(!key||key.endsWith('|'))return;
    const all=materialStore();
    rec.updated_at=new Date().toISOString();
    rec.date=document.querySelector('#materialDate')?.value||'';
    rec.group=document.querySelector('#materialGroup')?.value||'';
    rec.material=materialName();
    all[key]=rec;
    saveMaterialStore(all);
    const s=document.querySelector('#materialSaved');
    if(s)s.textContent='Guardado automáticamente · '+new Date(rec.updated_at).toLocaleTimeString('es-MX',{hour:'numeric',minute:'2-digit'});
  }

  async function fillMaterialGroups(){
    const sel=document.querySelector('#materialGroup');if(!sel)return;
    const rows=(await students()).filter(s=>String(s.id)!=='00001'&&s.active!==false);
    const groups=[...new Set(rows.map(s=>String(s.group||'')).filter(Boolean))]
      .sort((a,b)=>a.localeCompare(b,'es',{numeric:true,sensitivity:'base'}));
    const old=sel.value;
    sel.innerHTML=groups.length?groups.map(g=>'<option value="'+safe(g)+'">'+safe(g)+'</option>').join(''):'<option value="">Sin grupos</option>';
    if(groups.includes(old))sel.value=old;
  }

  async function renderMaterialRoster(){
    const box=document.querySelector('#materialRoster');
    const group=document.querySelector('#materialGroup')?.value||'';
    if(!box||!group)return;
    const mat=materialName();
    const custom=document.querySelector('#materialCustomWrap');
    if(custom)custom.style.display=document.querySelector('#materialType')?.value==='__OTHER__'?'block':'none';

    if(!mat){
      box.innerHTML='<div class="empty">Escribe el material solicitado.</div>';
      updateMaterialSummary();
      return;
    }

    materialRoster=(await students())
      .filter(s=>s.active!==false&&String(s.id)!=='00001'&&sameGroup(s.group,group))
      .sort(compareStudentsForList);

    const rec=currentMaterialRecord(),statuses=rec.statuses||{};
    if(rec.updated_at&&document.querySelector('#materialSaved')){
      document.querySelector('#materialSaved').textContent='Último guardado: '+new Date(rec.updated_at).toLocaleString('es-MX');
    }

    box.className='list';
    box.innerHTML=materialRoster.map(st=>{
      const v=statuses[String(st.id)]||'pending';
      return '<div class="row" data-material-row="'+safe(st.id)+'">'+
        '<div><strong>'+safe(studentListDisplayName(st))+'</strong><small>Lista '+safe(st.number||'—')+' · ID '+safe(st.id)+'</small></div>'+
        '<div class="rowactions">'+
          '<button type="button" class="'+(v==='yes'?'primary':'secondary')+'" data-material-yes="'+safe(st.id)+'">✓ Trajo</button>'+
          '<button type="button" class="'+(v==='no'?'danger':'secondary')+'" data-material-no="'+safe(st.id)+'">✕ No trajo</button>'+
        '</div></div>';
    }).join('')||'<div class="empty">No hay alumnos en este grupo.</div>';

    box.querySelectorAll('[data-material-yes]').forEach(b=>b.onclick=()=>setMaterialStatus(b.dataset.materialYes,'yes'));
    box.querySelectorAll('[data-material-no]').forEach(b=>b.onclick=()=>setMaterialStatus(b.dataset.materialNo,'no'));
    updateMaterialSummary();
  }

  function setMaterialStatus(studentId,status){
    const rec=currentMaterialRecord();
    rec.statuses=rec.statuses||{};
    rec.statuses[String(studentId)]=status;
    saveCurrentMaterialRecord(rec);
    renderMaterialRoster().catch(()=>{});
  }

  function markAllMaterial(status){
    if(!materialName())return alert('Selecciona o escribe primero el material solicitado.');
    const rec=currentMaterialRecord();rec.statuses=rec.statuses||{};
    materialRoster.forEach(st=>rec.statuses[String(st.id)]=status);
    saveCurrentMaterialRecord(rec);
    renderMaterialRoster().catch(()=>{});
  }

  function updateMaterialSummary(){
    const rec=currentMaterialRecord(),statuses=rec.statuses||{};
    const yes=materialRoster.filter(s=>statuses[String(s.id)]==='yes').length;
    const no=materialRoster.filter(s=>statuses[String(s.id)]==='no').length;
    const pending=Math.max(0,materialRoster.length-yes-no);
    const el=document.querySelector('#materialSummary');
    if(el)el.innerHTML='<div class="stat"><b>'+materialRoster.length+'</b><span>Alumnos</span></div>'+
      '<div class="stat"><b>'+yes+'</b><span>Trajeron</span></div>'+
      '<div class="stat"><b>'+no+'</b><span>No trajeron</span></div>'+
      '<div class="stat"><b>'+pending+'</b><span>Sin marcar</span></div>';
  }

  function materialRowsForPdf(missingOnly){
    const rec=currentMaterialRecord(),statuses=rec.statuses||{};
    return materialRoster
      .map(st=>({st,status:statuses[String(st.id)]||'pending'}))
      .filter(x=>!missingOnly||x.status==='no');
  }

  function generateMaterialPdf(missingOnly=true){
    const mat=materialName();
    const group=document.querySelector('#materialGroup')?.value||'';
    const date=document.querySelector('#materialDate')?.value||today();
    if(!mat)return alert('Selecciona o escribe el material solicitado.');
    const rows=materialRowsForPdf(missingOnly);
    if(missingOnly&&!rows.length)return alert('No hay alumnos marcados como “No trajo”.');

    const jsPDF=window.jspdf?.jsPDF;
    if(!jsPDF)return alert('No se pudo cargar el generador PDF.');

    const doc=new jsPDF({unit:'mm',format:'letter'});
    pdfHeader(doc,missingOnly?'Alumnos sin material':'Control de material','ESPAÑOL');
    doc.setFont('helvetica','normal');doc.setFontSize(10);doc.setTextColor(40,40,40);
    const [y,m,d]=date.split('-');
    doc.text('Grupo: '+group,14,36);
    doc.text('Fecha: '+(d&&m&&y?d+'/'+m+'/'+y:date),14,42);
    doc.text('Material solicitado: '+mat,14,48);

    const body=rows.map(({st,status})=>[
      st.number||'—',
      st.name||'',
      missingOnly?'No trajo':status==='yes'?'Trajo':status==='no'?'No trajo':'Sin marcar'
    ]);

    doc.autoTable({
      startY:55,
      head:[['No.','Alumno(a)',missingOnly?'Observación':'Estado']],
      body,
      styles:{fontSize:9.5,cellPadding:2.5,lineColor:[220,220,220],lineWidth:.15,valign:'middle'},
      headStyles:{fillColor:[245,196,0],textColor:[33,27,18]},
      columnStyles:{0:{cellWidth:18},1:{cellWidth:115},2:{cellWidth:48}}
    });

    if(missingOnly){
      const y2=doc.lastAutoTable.finalY+8;
      doc.setFontSize(9);doc.setTextColor(80,80,80);
      doc.text('Total de alumnos que no presentaron el material: '+rows.length,14,y2);
    }
    pdfFooter(doc);
    const clean=mat.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,35)||'material';
    const file=(missingOnly?'Sin_material_':'Control_material_')+group+'_'+clean+'_'+date+'.pdf';
    printContent(missingOnly?'Alumnos sin material':'Control de material',
      '<p><b>Grupo '+safe(group)+'</b> · '+safe(mat)+'</p>',
      pdfBlob(doc),file);
  }

  function installMaterialControl(){
    const reports=document.querySelector('#reports');
    if(!reports||document.querySelector('#materialControlCard'))return;

    const card=document.createElement('div');
    card.id='materialControlCard';
    card.className='card';
    card.innerHTML=
      '<div class="section"><div><h2>📎 Control de material</h2>'+
      '<p class="hint">Marca quién trajo o no trajo el material solicitado y genera un PDF para seguimiento.</p></div></div>'+
      '<div class="formgrid">'+
        '<label>Fecha<input id="materialDate" type="date"></label>'+
        '<label>Grupo<select id="materialGroup"></select></label>'+
        '<label>Material<select id="materialType">'+
          '<option value="Gafete">Gafete</option>'+
          '<option value="Cuaderno de dictados">Cuaderno de dictados</option>'+
          '<option value="Cuaderno de apuntes">Cuaderno de apuntes</option>'+
          '<option value="Libro de Español">Libro de Español</option>'+
          '<option value="__OTHER__">Otro material…</option>'+
        '</select></label>'+
        '<label id="materialCustomWrap" style="display:none">Especifica el material<input id="materialCustom" maxlength="80" placeholder="Ej. hojas de color, investigación, mapa…"></label>'+
      '</div>'+
      '<div class="actions" style="margin-top:12px">'+
        '<button id="materialAllYes" class="secondary" type="button">✓ Todos trajeron</button>'+
        '<button id="materialClear" class="secondary" type="button">Limpiar marcas</button>'+
        '<button id="materialMissingPdf" class="primary" type="button">PDF · No trajeron</button>'+
        '<button id="materialFullPdf" class="secondary" type="button">PDF · Lista completa</button>'+
      '</div>'+
      '<div id="materialSummary" class="stats" style="margin:14px 0"></div>'+
      '<p id="materialSaved" class="hint">Se guarda automáticamente en este iPad.</p>'+
      '<div id="materialRoster" class="list"><div class="empty">Selecciona un grupo.</div></div>';

    const reportCards=reports.querySelector('.report-cards');
    if(reportCards)reports.insertBefore(card,reportCards);
    else reports.appendChild(card);

    document.querySelector('#materialDate').value=today();
    fillMaterialGroups().then(renderMaterialRoster);

    document.querySelector('#materialGroup').addEventListener('change',()=>renderMaterialRoster());
    document.querySelector('#materialDate').addEventListener('change',()=>renderMaterialRoster());
    document.querySelector('#materialType').addEventListener('change',()=>renderMaterialRoster());
    document.querySelector('#materialCustom').addEventListener('change',()=>renderMaterialRoster());
    document.querySelector('#materialAllYes').onclick=()=>markAllMaterial('yes');
    document.querySelector('#materialClear').onclick=()=>{
      if(!confirm('¿Quitar todas las marcas de este control?'))return;
      const rec=currentMaterialRecord();rec.statuses={};saveCurrentMaterialRecord(rec);renderMaterialRoster();
    };
    document.querySelector('#materialMissingPdf').onclick=()=>generateMaterialPdf(true);
    document.querySelector('#materialFullPdf').onclick=()=>generateMaterialPdf(false);
  }

  window.addEventListener('load',()=>setTimeout(installMaterialControl,400));
})();