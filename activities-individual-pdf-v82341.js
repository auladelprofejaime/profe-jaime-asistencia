// App Docente v8.23.41 · Actividades · PDF individual por alumno
(function(){
  async function selectedGroupStudents(){
    const shift=$('#gridShift')?.value||'';
    const group=$('#gridGroup')?.value||'';
    return (await students())
      .filter(st=>sameShift(st.shift,shift)&&sameGroup(st.group,group))
      .sort(compareStudentsForList);
  }

  async function printOneWeeklyIndividual(studentId,selectedIds=null,reportTitle='Reporte de actividades',fromDate=null,toDate=null){
    const {shift,group,week,students:sts,acts,map}=await weeklyReportData(selectedIds,fromDate,toDate);
    if(!acts.length)return alert('No seleccionaste actividades para el reporte.');
    const st=sts.find(x=>String(x.id)===String(studentId));
    if(!st)return alert('Selecciona un alumno válido.');
    if(!pdfReady())return alert('No se cargó el generador de PDF. Pulsa Actualizar app con internet una vez y vuelve a intentarlo.');

    const {jsPDF}=window.jspdf;
    const doc=new jsPDF({unit:'mm',format:'letter'});
    const info=individualWeeklyRows(st,acts,map);
    pdfHeader(doc,reportTitle,'ESPAÑOL');
    doc.setFontSize(10);
    doc.text(`Alumno: ${st.name||st.id}`,14,34);
    doc.text(`Grupo: ${group}    No. de lista: ${st.number||'—'}    Periodo: ${week}`,14,40);
    doc.autoTable({
      startY:46,
      head:[['Actividad','Tipo','Asignada','Entrega','Estado']],
      body:info.rows.map(r=>[r.name,r.type,r.assigned||'—',r.due||'—',r.status]),
      styles:{fontSize:8,cellPadding:2,valign:'middle'},
      headStyles:{fillColor:[245,196,0],textColor:[33,27,18]},
      columnStyles:{0:{cellWidth:65},1:{cellWidth:27},2:{cellWidth:27},3:{cellWidth:27},4:{cellWidth:38}}
    });
    const y=doc.lastAutoTable.finalY+8;
    doc.setFont('helvetica','bold');doc.setFontSize(11);
    doc.text(`Entregadas / registradas: ${info.delivered} de ${info.total}`,14,y);
    doc.setFont('helvetica','normal');doc.setFontSize(9);
    doc.text(doc.splitTextToSize('Este reporte corresponde al seguimiento de entregas del periodo seleccionado registrado en Español.',180),14,y+8);
    pdfFooter(doc);

    const safeName=String(st.name||st.id).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/gi,'_').replace(/^_+|_+$/g,'');
    const file=`reporte_actividades_${safeName||st.id}_${group}_${String(week).replace(/[^a-z0-9]+/gi,'_')}.pdf`;
    printContent('Reporte individual de actividades',`<p><b>${safe(studentListDisplayName(st))}</b> · Grupo ${safe(group)} · Periodo ${safe(week)}</p>`,pdfBlob(doc),file);
  }

  window.showWeeklyReportOptions=async function(){
    const current=await currentWeekActivities();
    const dates=current.map(a=>a.date).filter(Boolean).sort();
    const fallback=today();
    const initialFrom=dates[0]||fallback,initialTo=dates[dates.length-1]||fallback;
    const defaultTitle='Reporte de actividades';
    const roster=await selectedGroupStudents();

    let html=`<label style="display:block;margin-bottom:12px"><strong>Encabezado del reporte</strong><input id="weeklyReportTitle" value="${defaultTitle}" maxlength="90" style="margin-top:6px;width:100%"></label>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
      <label><strong>Fecha inicial</strong><input id="weeklyReportFrom" type="date" value="${safe(initialFrom)}" style="margin-top:6px;width:100%"></label>
      <label><strong>Fecha final</strong><input id="weeklyReportTo" type="date" value="${safe(initialTo)}" style="margin-top:6px;width:100%"></label>
    </div>
    <p class="hint">Puedes abarcar una semana, dos semanas o el rango que necesites.</p>
    <p>Selecciona las actividades que deseas incluir.</p>
    <div id="weeklyReportActivities" class="report-options"></div>
    <div class="actions"><button id="selectAllReportActs" class="secondary">Seleccionar todas</button><button id="clearReportActs" class="danger-outline">Quitar todas</button></div>
    <hr style="margin:18px 0;border:0;border-top:1px solid #ead9a8">
    <label style="display:block;margin-bottom:14px"><strong>Alumno para PDF individual</strong>
      <select id="weeklyReportStudent" style="margin-top:6px;width:100%">
        <option value="">Selecciona un alumno</option>
        ${roster.map(st=>`<option value="${safe(st.id)}">${safe(st.number??'—')}. ${safe(studentListDisplayName(st))}</option>`).join('')}
        <option value="__ALL__">Todos los alumnos</option>
      </select>
    </label>
    <div class="actions"><button id="generateSelectedWeeklyPdf" class="primary">PDF general del grupo</button><button id="generateIndividualWeeklyPdf" class="secondary">PDF individual</button><button id="publishWeeklyParents" class="primary">Enviar individuales a Padres</button></div>
    <p class="hint">Para PDF individual elige primero al alumno. “Todos los alumnos” conserva el comportamiento anterior.</p>`;

    showDialog('Preparar reporte por rango',html);

    const renderChoices=async()=>{
      const from=$('#weeklyReportFrom').value,to=$('#weeklyReportTo').value,box=$('#weeklyReportActivities');
      if(!from||!to||from>to){box.innerHTML='<p class="hint">Revisa las fechas del rango.</p>';return}
      const acts=await reportRangeActivities(from,to);
      box.innerHTML=acts.length?acts.map((a,i)=>`<label class="report-option"><input type="checkbox" data-report-act="${a.id}" checked><span><strong>${i+1}. ${safe(a.name)}</strong><br><small>${safe(a.date)} · ${safe(a.type||'Actividad')}</small></span></label>`).join(''):'<p class="hint">No hay actividades en este rango.</p>';
    };

    await renderChoices();
    $('#weeklyReportFrom').onchange=renderChoices;
    $('#weeklyReportTo').onchange=renderChoices;
    $('#selectAllReportActs').onclick=()=>$$('[data-report-act]').forEach(x=>x.checked=true);
    $('#clearReportActs').onclick=()=>$$('[data-report-act]').forEach(x=>x.checked=false);

    const selected=()=>$$('[data-report-act]:checked').map(x=>x.dataset.reportAct);
    const title=()=>($('#weeklyReportTitle').value||defaultTitle).trim();
    const range=()=>({from:$('#weeklyReportFrom').value,to:$('#weeklyReportTo').value});

    $('#generateSelectedWeeklyPdf').onclick=async()=>{
      const ids=selected();if(!ids.length)return alert('Selecciona al menos una actividad.');
      const r=range(),t=title();$('#dialog').close();await printWeekly(ids,t,r.from,r.to);
    };
    $('#generateIndividualWeeklyPdf').onclick=async()=>{
      const ids=selected();if(!ids.length)return alert('Selecciona al menos una actividad.');
      const sid=$('#weeklyReportStudent').value;
      if(!sid)return alert('Selecciona el alumno del que quieres generar el PDF.');
      const r=range(),t=title();$('#dialog').close();
      if(sid==='__ALL__')await printWeeklyIndividuals(ids,t,r.from,r.to);
      else await printOneWeeklyIndividual(sid,ids,t,r.from,r.to);
    };
    $('#publishWeeklyParents').onclick=async()=>{
      const ids=selected();if(!ids.length)return alert('Selecciona al menos una actividad.');
      const r=range(),t=title();
      if(!confirm('Se publicará un reporte individual para cada familia del grupo seleccionado y se enviará una notificación. ¿Continuar?'))return;
      $('#dialog').close();await publishWeeklyReportsToParents(ids,t,r.from,r.to);
    };
  };

  function bindWeeklyPdfSelector(){
    const btn=$('#gridPdf');
    if(btn)btn.onclick=()=>window.showWeeklyReportOptions();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(bindWeeklyPdfSelector,900));
  else setTimeout(bindWeeklyPdfSelector,900);
  document.querySelector('[data-acttab="grid"]')?.addEventListener('click',()=>setTimeout(bindWeeklyPdfSelector,80));
})();