// App Docente v8.23.18 · Gestión de docentes de Mérito
(function(){
  const $m=s=>document.querySelector(s);
  let staffCache=[];

  async function rpc(name,args={}){
    if(!window.ProfeSupabase)throw new Error('Supabase no está disponible.');
    return await window.ProfeSupabase.rpc(name,args);
  }

  function normalizeCode(v){return String(v||'').replace(/\D+/g,'').slice(0,6)}

  async function refreshTeacherFolioSummary(){
    const box=$m('#meritTeacherFolioSummary');if(!box)return;
    try{
      const d=await rpc('teacher_merit_placeholder_summary',{});
      box.textContent=`${Number(d.available||0)} disponibles · ${Number(d.assigned||0)} activados`;
    }catch(e){box.textContent='No se pudo cargar'}
  }

  async function findTeacherFolio(){
    const input=$m('#meritTeacherFolioScan'),code=normalizeCode(input?.value);
    const result=$m('#meritTeacherFolioResult'),status=$m('#meritTeacherFolioStatus');
    if(status)status.textContent='';
    result?.classList.remove('hidden');
    if(!/^\d{6}$/.test(code)){
      status.textContent='Escanea o escribe un ID válido, por ejemplo 700001.';
      return;
    }
    try{
      const d=await rpc('teacher_merit_lookup_staff_code',{p_staff_code:code});
      if(!d?.ok){status.textContent='No se encontró ese ID.';return}
      $m('#meritTeacherFolioCode').value=d.staff_code||code;
      if(d.assigned){
        $m('#meritTeacherFolioActivate').disabled=true;
        status.textContent=d.profile_complete
          ?`Este ID ya pertenece a ${d.display_name||'un docente'}.`
          :'Este ID ya fue activado y está pendiente de que el docente complete sus datos.';
      }else{
        $m('#meritTeacherFolioActivate').disabled=false;
        status.textContent='ID disponible. Pulsa Activar participación.';
      }
    }catch(e){status.textContent='No se pudo consultar el ID: '+(e.message||e)}
  }

  async function activateTeacherFolio(){
    const code=normalizeCode($m('#meritTeacherFolioCode')?.value);
    const status=$m('#meritTeacherFolioStatus'),btn=$m('#meritTeacherFolioActivate');
    btn.disabled=true;status.textContent='Activando…';
    try{
      const d=await rpc('teacher_merit_activate_staff_code',{p_staff_code:code});
      if(!d?.ok){
        if(d?.reason==='already_activated')throw new Error('Este ID ya fue activado.');
        throw new Error(d?.reason||'No se pudo activar.');
      }
      status.textContent=`✓ ID ${code} activado. El docente deberá completar sus datos y cambiar su NIP en su app.`;
      await refreshTeacherFolioSummary();
      setTimeout(()=>{
        $m('#meritTeacherFolioScan').value='';
        $m('#meritTeacherFolioResult')?.classList.add('hidden');
        $m('#meritTeacherFolioScan')?.focus();
      },900);
    }catch(e){status.textContent='No se pudo activar: '+(e.message||e);btn.disabled=false}
  }

  async function resetStaffPin(id,name){
    if(!confirm(`¿Generar un NIP temporal nuevo para ${name}?\n\nSolo se cerrarán las sesiones de este docente. Su nombre, asignatura e historial se conservarán.`))return;
    try{
      const d=await rpc('teacher_merit_reset_staff_pin',{p_staff_id:id});
      if(!d?.ok)throw new Error(d?.reason||'No se pudo generar.');
      const box=$m('#meritActivationBox'),code=$m('#meritActivationCode');
      if(code)code.textContent=d.temporary_pin;
      if(box){
        const hint=box.querySelector('.hint');
        if(hint)hint.textContent=`NIP temporal para ${d.display_name} · ID ${d.staff_code}`;
        box.classList.remove('hidden');
        box.scrollIntoView({behavior:'smooth',block:'center'});
      }
      alert(`NIP temporal de ${d.display_name}: ${d.temporary_pin}\n\nAl ingresar deberá cambiar únicamente su NIP.`);
      await loadAndDecorateStaff();
    }catch(e){alert('No se pudo generar el NIP temporal: '+(e.message||e))}
  }

  async function loadAndDecorateStaff(){
    try{
      const rows=await rpc('teacher_merit_staff',{});
      staffCache=Array.isArray(rows)?rows:[];
      decorateStaffTable();
    }catch(e){console.warn('merit reset pin',e)}
  }

  function decorateStaffTable(){
    const root=$m('#meritStaffList');if(!root)return;
    root.querySelectorAll('tbody tr').forEach(tr=>{
      const id=tr.querySelector('.meritActive')?.dataset.id||tr.querySelector('.meritEditStaffBtn')?.dataset.id;
      if(!id)return;
      const st=staffCache.find(x=>String(x.id)===String(id));
      if(!st)return;
      tr.querySelectorAll('.meritCode').forEach(b=>b.remove());
      const first=tr.children[0];
      if(first&&st.staff_code&&!first.querySelector('.merit-staff-id')){
        const small=document.createElement('div');
        small.className='hint merit-staff-id';
        small.textContent='ID '+st.staff_code;
        first.appendChild(small);
      }
      const action=tr.children[tr.children.length-1];
      if(action&&st.staff_code&&st.active&&!action.querySelector('.meritResetPin')){
        const b=document.createElement('button');
        b.type='button';b.className='secondary meritResetPin';
        b.textContent='Generar NIP temporal';
        b.onclick=()=>resetStaffPin(st.id,st.display_name);
        action.querySelector('.merit-inline-actions')?.prepend(b) || action.prepend(b);
      }
    });
  }

  function code39Svg(text){
    const patterns={'0':'nnnwwnwnn','1':'wnnwnnnnw','2':'nnwwnnnnw','3':'wnwwnnnnn','4':'nnnwwnnnw','5':'wnnwwnnnn','6':'nnwwwnnnn','7':'nnnwnnwnw','8':'wnnwnnwnn','9':'nnwwnnwnn','*':'nwnnwnwnn'};
    const value='*'+text+'*';let x=10,bars='',wide=3,narrow=1.2,h=54;
    for(const ch of value){const p=patterns[ch];if(!p)continue;for(let i=0;i<p.length;i++){const w=p[i]==='w'?wide:narrow;if(i%2===0)bars+=`<rect x="${x.toFixed(2)}" y="2" width="${w}" height="${h}" fill="#111"/>`;x+=w}x+=narrow}
    return `<svg viewBox="0 0 ${x+10} 70" width="100%" height="86" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">${bars}<text x="${(x+10)/2}" y="67" text-anchor="middle" font-family="Arial,sans-serif" font-size="8">${text}</text></svg>`;
  }

  async function printTeacherFolios(){
    let credentials=[];
    try{credentials=await rpc('teacher_merit_print_credentials',{})}
    catch(e){alert('No se pudieron cargar las hojas de acceso: '+(e.message||e));return}
    if(!Array.isArray(credentials)||!credentials.length){alert('No hay credenciales iniciales disponibles para imprimir.');return}
    const w=window.open('','_blank');if(!w){alert('Permite ventanas emergentes para imprimir las hojas.');return}
    const cards=credentials.map(item=>{
      const code=String(item.staff_code||''),pin=String(item.pin||'');
      return `<section class="folio"><div class="top"><div><div class="eyebrow">MÉRITO GABINO A. PALMA</div><h1>Acceso docente</h1></div><div class="id">${code}</div></div><div class="barcode">${code39Svg(code)}</div><div class="credentials"><div><span>ID DOCENTE</span><b>${code}</b></div><div><span>NIP INICIAL</span><b>${pin}</b></div></div><div class="note"><b>Acceso de prueba a Mérito Docentes.</b><br>Ingresa con este ID y NIP. Si confirmas tu participación, el Profr. Jaime activará tu ID y la app te pedirá completar tus datos y elegir un NIP personal.</div><div class="steps"><b>1.</b> Ingresa con ID + NIP. &nbsp; <b>2.</b> Prueba la app. &nbsp; <b>3.</b> Si participas, solicita la activación de tu ID.</div></section>`;
    }).join('');
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Hojas de acceso docentes · Mérito Gabino A. Palma</title><style>@page{size:letter;margin:8mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;margin:0;color:#211b12}.folio{height:126mm;border:1.5px solid #d7b11e;border-radius:14px;padding:10mm;margin:0 0 8mm;page-break-inside:avoid;background:#fff}.folio:nth-child(2n){page-break-after:always}.top{display:flex;justify-content:space-between;gap:10mm;align-items:flex-start}.eyebrow{font-size:9pt;font-weight:800;letter-spacing:.08em;color:#806800}.top h1{margin:3mm 0 0;font-size:20pt}.id{font-size:18pt;font-weight:900;border:2px solid #211b12;border-radius:10px;padding:3mm 5mm}.barcode{margin:8mm auto 5mm;max-width:155mm}.credentials{display:grid;grid-template-columns:1fr 1fr;gap:5mm;margin:4mm 0}.credentials div{border:1px solid #d7b11e;border-radius:10px;padding:4mm;text-align:center}.credentials span{display:block;font-size:8pt;font-weight:800;letter-spacing:.08em;color:#806800}.credentials b{display:block;font-size:20pt;margin-top:1mm}.note{font-size:11pt;line-height:1.45;background:#fff8d7;border-radius:10px;padding:5mm}.steps{font-size:9.5pt;margin-top:5mm;line-height:1.5}</style></head><body>${cards}</body></html>`);
    w.document.close();w.focus();setTimeout(()=>w.print(),350);
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
    $m('#meritTeacherFolioScan')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();findTeacherFolio()}});
    document.querySelectorAll('.meritNav[data-merit-pane="staff"]').forEach(b=>b.addEventListener('click',()=>setTimeout(()=>{refreshTeacherFolioSummary();loadAndDecorateStaff();$m('#meritTeacherFolioScan')?.focus()},120)));
    const list=$m('#meritStaffList');
    if(list)new MutationObserver(()=>setTimeout(decorateStaffTable,20)).observe(list,{childList:true,subtree:true});
    refreshTeacherFolioSummary();
    setTimeout(loadAndDecorateStaff,900);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
})();