// App Docente v8.23.16 · Folios de docentes para Mérito Gabino A. Palma
(function(){
  const $m=s=>document.querySelector(s);

  async function rpc(name,args={}){
    if(!window.ProfeSupabase)throw new Error('Supabase no está disponible.');
    return await window.ProfeSupabase.rpc(name,args);
  }

  function normalizeCode(v){
    return String(v||'').replace(/\D+/g,'').slice(0,6);
  }

  async function refreshTeacherFolioSummary(){
    const box=$m('#meritTeacherFolioSummary');
    if(!box)return;
    try{
      const d=await rpc('teacher_merit_placeholder_summary',{});
      box.textContent=`${Number(d.available||0)} disponibles · ${Number(d.assigned||0)} asignados`;
    }catch(e){box.textContent='No se pudo cargar';}
  }

  async function findTeacherFolio(){
    const input=$m('#meritTeacherFolioScan');
    const code=normalizeCode(input?.value);
    const result=$m('#meritTeacherFolioResult');
    const status=$m('#meritTeacherFolioStatus');
    if(status)status.textContent='';
    if(!/^\d{6}$/.test(code)){
      if(status)status.textContent='Escanea o escribe un folio válido, por ejemplo 700001.';
      result?.classList.remove('hidden');
      return;
    }
    try{
      const d=await rpc('teacher_merit_lookup_staff_code',{p_staff_code:code});
      result?.classList.remove('hidden');
      if(!d?.ok){
        status.textContent='No se encontró ese folio.';
        return;
      }
      $m('#meritTeacherFolioCode').value=d.staff_code||code;
      if(d.assigned){
        $m('#meritTeacherFolioName').value=d.display_name||'';
        $m('#meritTeacherFolioRole').value=d.role_type||'docente';
        $m('#meritTeacherFolioSubject').value=d.subject_area||'';
        $m('#meritTeacherFolioActivate').disabled=true;
        status.textContent=`Este folio ya está asignado a ${d.display_name||'un docente'}.`;
      }else{
        $m('#meritTeacherFolioName').value='';
        $m('#meritTeacherFolioRole').value='docente';
        $m('#meritTeacherFolioSubject').value='';
        $m('#meritTeacherFolioActivate').disabled=false;
        status.textContent='ID disponible. Escribe los datos del docente para confirmarlo.';
        setTimeout(()=>$m('#meritTeacherFolioName')?.focus(),50);
      }
    }catch(e){
      result?.classList.remove('hidden');
      status.textContent='No se pudo consultar el folio: '+(e.message||e);
    }
  }

  async function activateTeacherFolio(){
    const code=normalizeCode($m('#meritTeacherFolioCode')?.value);
    const name=String($m('#meritTeacherFolioName')?.value||'').trim();
    const role=$m('#meritTeacherFolioRole')?.value||'docente';
    const subject=String($m('#meritTeacherFolioSubject')?.value||'').trim();
    const status=$m('#meritTeacherFolioStatus');
    if(!name){status.textContent='Escribe el nombre del profesor(a).';return;}
    const btn=$m('#meritTeacherFolioActivate');
    btn.disabled=true;
    status.textContent='Activando…';
    try{
      const d=await rpc('teacher_merit_provision_staff_code',{
        p_staff_code:code,
        p_display_name:name,
        p_role_type:role,
        p_subject_area:subject||null
      });
      if(!d?.ok){
        if(d?.reason==='already_assigned')throw new Error('Este folio ya fue asignado.');
        throw new Error(d?.reason||'No se pudo activar.');
      }
      const box=$m('#meritActivationBox');
      if(box)box.classList.add('hidden');
      status.textContent=`✓ ${name} quedó confirmado con el ID ${code}. En su celular deberá cambiar el NIP impreso.`;
      try{await window.loadMeritStaff?.();}catch(_){}
      await refreshTeacherFolioSummary();
      setTimeout(()=>{
        $m('#meritTeacherFolioScan').value='';
        $m('#meritTeacherFolioResult')?.classList.add('hidden');
        $m('#meritTeacherFolioScan')?.focus();
      },900);
    }catch(e){
      status.textContent='No se pudo activar: '+(e.message||e);
      btn.disabled=false;
    }
  }

  function code39Svg(text){
    const patterns={
      '0':'nnnwwnwnn','1':'wnnwnnnnw','2':'nnwwnnnnw','3':'wnwwnnnnn','4':'nnnwwnnnw',
      '5':'wnnwwnnnn','6':'nnwwwnnnn','7':'nnnwnnwnw','8':'wnnwnnwnn','9':'nnwwnnwnn',
      'A':'wnnnnwnnw','B':'nnwnnwnnw','C':'wnwnnwnnn','D':'nnnnwwnnw','E':'wnnnwwnnn',
      'F':'nnwnwwnnn','G':'nnnnnwwnw','H':'wnnnnwwnn','I':'nnwnnwwnn','J':'nnnnwwwnn',
      'K':'wnnnnnnww','L':'nnwnnnnww','M':'wnwnnnnwn','N':'nnnnwnnww','O':'wnnnwnnwn',
      'P':'nnwnwnnwn','Q':'nnnnnnwww','R':'wnnnnnwwn','S':'nnwnnnwwn','T':'nnnnwnwwn',
      'U':'wwnnnnnnw','V':'nwwnnnnnw','W':'wwwnnnnnn','X':'nwnnwnnnw','Y':'wwnnwnnnn',
      'Z':'nwwnwnnnn','-':'nwnnnnwnw','.':'wwnnnnwnn',' ':'nwwnnnwnn','*':'nwnnwnwnn'
    };
    const value='*'+text+'*';
    let x=10,bars='',wide=3,narrow=1.2,h=54;
    for(const ch of value){
      const p=patterns[ch];
      if(!p)continue;
      for(let i=0;i<p.length;i++){
        const w=p[i]==='w'?wide:narrow;
        if(i%2===0)bars+=`<rect x="${x.toFixed(2)}" y="2" width="${w}" height="${h}" fill="#111"/>`;
        x+=w;
      }
      x+=narrow;
    }
    return `<svg viewBox="0 0 ${x+10} 70" width="100%" height="86" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">${bars}<text x="${(x+10)/2}" y="67" text-anchor="middle" font-family="Arial,sans-serif" font-size="8">${text}</text></svg>`;
  }

  async function printTeacherFolios(){
    const w=window.open('','_blank');
    if(!w){alert('Permite ventanas emergentes para imprimir los folios.');return;}
    const cards=Array.from({length:60},(_,i)=>{
      const code=''+String(i+1).padStart(3,'0');
      return `<section class="folio">
        <div class="top"><div><div class="eyebrow">MÉRITO GABINO A. PALMA</div><h1>Folio docente</h1></div><div class="id">${code}</div></div>
        <div class="barcode">${code39Svg(code)}</div>
        <div class="credentials"><div><span>ID DOCENTE</span><b>${code}</b></div><div><span>NIP INICIAL</span><b>${pin}</b></div></div>
        <div class="note"><b>Acceso de prueba a Mérito Docentes.</b><br>Ingresa con este ID y NIP. Si confirmas tu participación, el Profr. Jaime asociará este ID a tu nombre y el sistema te pedirá cambiar el NIP por uno personal.</div>
        <div class="steps"><b>1.</b> Ingresa con ID + NIP. &nbsp; <b>2.</b> Prueba la app. &nbsp; <b>3.</b> Si participas, confirma tu nombre con el Profr. Jaime y cambia tu NIP.</div>
      </section>`;
    }).join('');
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Folios docentes · Mérito Gabino A. Palma</title><style>
      @page{size:letter;margin:8mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;margin:0;color:#211b12}
      .folio{height:126mm;border:1.5px solid #d7b11e;border-radius:14px;padding:10mm;margin:0 0 8mm;page-break-inside:avoid;background:#fff}
      .folio:nth-child(2n){page-break-after:always}.top{display:flex;justify-content:space-between;gap:10mm;align-items:flex-start}
      .eyebrow{font-size:9pt;font-weight:800;letter-spacing:.08em;color:#806800}.top h1{margin:3mm 0 0;font-size:20pt}
      .id{font-size:18pt;font-weight:900;border:2px solid #211b12;border-radius:10px;padding:3mm 5mm}.barcode{margin:8mm auto 5mm;max-width:155mm}
      .credentials{display:grid;grid-template-columns:1fr 1fr;gap:5mm;margin:4mm 0}.credentials div{border:1px solid #d7b11e;border-radius:10px;padding:4mm;text-align:center}.credentials span{display:block;font-size:8pt;font-weight:800;letter-spacing:.08em;color:#806800}.credentials b{display:block;font-size:20pt;margin-top:1mm}.note{font-size:11pt;line-height:1.45;background:#fff8d7;border-radius:10px;padding:5mm}.steps{font-size:9.5pt;margin-top:5mm;line-height:1.5}
    </style></head><body>${cards}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(()=>w.print(),350);
  }

  function resetFolioForm(){
    $m('#meritTeacherFolioResult')?.classList.add('hidden');
    if($m('#meritTeacherFolioScan'))$m('#meritTeacherFolioScan').value='';
    setTimeout(()=>$m('#meritTeacherFolioScan')?.focus(),20);
  }

  function wire(){
    $m('#meritTeacherFolioFind')?.addEventListener('click',findTeacherFolio);
    $m('#meritTeacherFolioActivate')?.addEventListener('click',activateTeacherFolio);
    $m('#meritTeacherFolioCancel')?.addEventListener('click',resetFolioForm);
    $m('#meritPrintTeacherFolios')?.addEventListener('click',printTeacherFolios);
    const scan=$m('#meritTeacherFolioScan');
    scan?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();findTeacherFolio();}});
    document.querySelectorAll('.meritNav[data-merit-pane="staff"]').forEach(b=>b.addEventListener('click',()=>{
      setTimeout(()=>{refreshTeacherFolioSummary();scan?.focus();},80);
    }));
    refreshTeacherFolioSummary();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);
  else wire();
})();