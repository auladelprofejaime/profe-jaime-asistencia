// App Diagnóstico v0.13.6 · Vespertino: tiempos en segundos + exportación Excel
(function(){
  function secondsLabel(total){
    const n=Math.max(0,Math.floor(Number(total)||0));
    return n+' s';
  }

  // El cronómetro grupal de Vespertino se expresa siempre en segundos.
  try{lecturaFormatSeconds=secondsLabel}catch(_){}

  function xmlEsc(v){
    return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  }

  function rosterRow(group,studentId){
    try{return (LECTURA_VESPERTINO_ROSTER[group]||[]).find(x=>String(x.student_id)===String(studentId))||null}catch(_){return null}
  }

  async function lecturaExcelRows(groupFilter=null){
    if(!activePeriod?.id)throw new Error('Abre primero el periodo diagnóstico.');
    let cloud=[];
    try{
      const x=await rpc('teacher_diagnostic_lectura_times',{p_period_id:activePeriod.id});
      cloud=Array.isArray(x)?x:[];
    }catch(e){console.warn('Excel lectura: nube',e)}

    let local=[];
    try{
      local=(typeof lecturaAuditAllLocalTimes==='function'?lecturaAuditAllLocalTimes():[])
        .filter(r=>String(r.periodId||'')===String(activePeriod.id) && String(r.studentId||'').startsWith('V'));
    }catch(_){}

    const map=new Map();

    for(const r of local){
      const group=String(r.group||'');
      if(!LECTURA_VESPERTINO_GROUPS.includes(group))continue;
      if(groupFilter&&group!==groupFilter)continue;
      const sid=String(r.studentId||'');
      if(!sid||!Number(r.seconds))continue;
      const rr=rosterRow(group,sid)||{};
      const k=group+'|'+sid+'|'+String(r.moment||'initial');
      map.set(k,{
        group,
        list_number:rr.list_number??r.listNumber??'',
        name:rr.name||r.name||sid,
        matricula:rr.matricula||'',
        student_id:sid,
        moment:String(r.moment||'initial'),
        test_code:r.testCode||'',
        seconds:Number(r.seconds),
        captured_at:r.when?new Date(Number(r.when)).toISOString():'',
        source:'Local'
      });
    }

    // La nube prevalece porque es lo que comparten las apps y el respaldo central.
    for(const r of cloud){
      const group=String(r.group_name||'');
      if(!LECTURA_VESPERTINO_GROUPS.includes(group))continue;
      if(groupFilter&&group!==groupFilter)continue;
      const sid=String(r.student_id||'');
      if(!sid||!Number(r.reading_seconds))continue;
      const rr=rosterRow(group,sid)||{};
      const k=group+'|'+sid+'|'+String(r.moment||'initial');
      map.set(k,{
        group,
        list_number:rr.list_number??'',
        name:rr.name||sid,
        matricula:rr.matricula||'',
        student_id:sid,
        moment:String(r.moment||'initial'),
        test_code:r.test_code||'',
        seconds:Number(r.reading_seconds),
        captured_at:r.captured_at||'',
        source:'Supabase'
      });
    }

    return [...map.values()].sort((a,b)=>
      String(a.group).localeCompare(String(b.group),'es',{numeric:true})||
      Number(a.list_number||999)-Number(b.list_number||999)||
      String(a.moment).localeCompare(String(b.moment))
    );
  }

  function downloadExcelFile(rows,groupFilter=null){
    if(!rows.length){alert('No hay tiempos registrados para exportar.');return}
    const data=rows.map(r=>({
      'Grupo':r.group,
      'No. de lista':Number(r.list_number)||'',
      'Alumno':r.name,
      'Matrícula':r.matricula,
      'ID':r.student_id,
      'Momento':r.moment==='final'?'Final':'Inicial',
      'Prueba':r.test_code||'',
      'Tiempo (segundos)':Number(r.seconds)||0,
      'Registrado':r.captured_at?new Date(r.captured_at).toLocaleString('es-MX'):'',
      'Fuente':r.source
    }));
    const safePeriod=String(activePeriod?.name||'periodo').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/gi,'_').replace(/^_+|_+$/g,'');
    const base='tiempos_lectura_eficaz_'+(groupFilter?'grupo_'+groupFilter.replace(/[^a-z0-9]+/gi,'_'):'vespertino')+'_'+safePeriod;

    if(window.XLSX?.utils){
      const ws=XLSX.utils.json_to_sheet(data);
      ws['!cols']=[
        {wch:10},{wch:12},{wch:38},{wch:14},{wch:16},
        {wch:10},{wch:10},{wch:18},{wch:22},{wch:12}
      ];
      const wb=XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb,ws,'Tiempos');
      XLSX.writeFile(wb,base+'.xlsx');
      return;
    }

    const headers=Object.keys(data[0]);
    const rowXml=(cells)=>'<Row>'+cells.map(v=>'<Cell><Data ss:Type="'+(typeof v==='number'?'Number':'String')+'">'+xmlEsc(v)+'</Data></Cell>').join('')+'</Row>';
    const xml='<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>'+
      '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">'+
      '<Worksheet ss:Name="Tiempos"><Table>'+rowXml(headers)+data.map(r=>rowXml(headers.map(h=>r[h]))).join('')+'</Table></Worksheet></Workbook>';
    const blob=new Blob(['\ufeff'+xml],{type:'application/vnd.ms-excel;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=base+'.xls';
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
  }
  async function exportVespertinoExcel(group=null,ev=null){
    const btn=ev?.currentTarget||null;
    const old=btn?.textContent;
    try{
      if(btn){btn.disabled=true;btn.textContent='Preparando Excel…'}
      const rows=await lecturaExcelRows(group);
      downloadExcelFile(rows,group);
    }catch(e){
      alert('No se pudo generar el Excel: '+(e?.message||e));
    }finally{
      if(btn){btn.disabled=false;btn.textContent=old}
    }
  }

  function installButtons(){
    const historyHead=document.querySelector('#lecturaHistoryCard .sectionHead');
    if(historyHead&&!document.querySelector('#exportLecturaExcelAll')){
      const actions=historyHead.querySelector('.sectionActions')||historyHead;
      const btn=document.createElement('button');
      btn.id='exportLecturaExcelAll';btn.type='button';btn.className='secondary';
      btn.textContent='⬇ Excel tiempos vespertino';
      btn.addEventListener('click',e=>exportVespertinoExcel(null,e));
      actions.appendChild(btn);
    }

    const controls=document.querySelector('.lecturaTimerMainActions');
    if(controls&&!document.querySelector('#exportLecturaExcelGroup')){
      const btn=document.createElement('button');
      btn.id='exportLecturaExcelGroup';btn.type='button';btn.className='secondary';
      btn.textContent='⬇ Excel de este grupo';
      btn.addEventListener('click',e=>{
        const g=document.querySelector('#lecturaTimerGroup')?.value||null;
        exportVespertinoExcel(g,e);
      });
      controls.appendChild(btn);
    }

    // Textos visibles del cronómetro en segundos.
    const clock=document.querySelector('#lecturaTimerClock');
    if(clock&&!/ s$/.test(clock.textContent||''))clock.textContent='0 s';
    document.querySelectorAll('#lecturaHistoryCard th,#lecturaTimerResults th').forEach(th=>{
      if((th.textContent||'').trim()==='Tiempo')th.textContent='Tiempo (segundos)';
    });
  }

  // Reaplica el rótulo después de renderizados dinámicos.
  const obs=new MutationObserver(()=>{
    document.querySelectorAll('#lecturaHistoryResults td:last-child,#lecturaTimerResults td:last-child').forEach(()=>{});
    installButtons();
  });

  function boot(){
    installButtons();
    const root=document.querySelector('#appShell')||document.body;
    obs.observe(root,{childList:true,subtree:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);
  else boot();
})();