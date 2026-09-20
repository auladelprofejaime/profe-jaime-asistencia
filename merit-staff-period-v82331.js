/* App Docente v8.23.31 · Participación de personal por periodo */
(function(){
  const $=s=>document.querySelector(s);
  const $$=s=>[...document.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function restore(){try{window.ProfeSupabase?.restore?.()}catch(_){}}
  async function rpc(name,args={}){
    restore();
    if(!window.ProfeSupabase)throw new Error('Supabase no está disponible.');
    return await window.ProfeSupabase.rpc(name,args);
  }

  function ensurePeriodUI(){
    const staffPane=$('#merit-staff'); if(!staffPane)return null;
    if(!$('#meritStaffPeriodBlock31')){
      const block=document.createElement('div');
      block.id='meritStaffPeriodBlock31';
      block.className='card';
      block.style.cssText='margin:12px 0;background:#f7fbff;border:1px solid rgba(24,91,145,.2)';
      block.innerHTML=
        '<div class="section"><div><h3 style="margin:0">Participación por periodo</h3>'+
        '<p class="hint" style="margin:5px 0 0">Consulta quién participa en cada mes. Cambiar un periodo no modifica ni borra el historial de meses anteriores.</p></div>'+
        '<button id="meritStaffPeriodRefresh31" class="secondary" type="button">Actualizar</button></div>'+
        '<label>Periodo<select id="meritStaffPeriodSelect31"></select></label>'+
        '<p id="meritStaffPeriodSummary31" class="message"></p>'+
        '<div id="meritStaffPeriodTable31" class="tablewrap"></div>';
      const scanner=staffPane.querySelector('.card[style*="fffaf0"]');
      if(scanner)staffPane.insertBefore(block,scanner); else staffPane.prepend(block);
      $('#meritStaffPeriodRefresh31').onclick=loadPeriodStaff;
      $('#meritStaffPeriodSelect31').onchange=loadPeriodStaff;
    }
    return $('#meritStaffPeriodBlock31');
  }

  async function loadPeriods(){
    ensurePeriodUI();
    const sel=$('#meritStaffPeriodSelect31');
    if(!sel)return [];
    try{
      const rows=await rpc('teacher_merit_periods',{});
      const data=Array.isArray(rows)?rows:[];
      const old=sel.value;
      sel.innerHTML=data.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.label)+' · '+esc(p.status)+'</option>').join('');
      if(data.some(p=>String(p.id)===String(old)))sel.value=old;
      else{
        const official=data.find(p=>!/^Prueba\b/i.test(String(p.label||'')));
        if(official)sel.value=official.id;
      }
      return data;
    }catch(e){
      $('#meritStaffPeriodSummary31').textContent='No se pudieron cargar los periodos: '+(e.message||e);
      return [];
    }
  }

  async function setParticipation(staffId,value){
    const periodId=$('#meritStaffPeriodSelect31')?.value;
    if(!periodId)return;
    const msg=value?'¿Marcar a este docente como participante en este periodo?':'¿Quitar su participación solo de este periodo?\n\nSu cuenta y su historial de otros meses se conservarán.';
    if(!confirm(msg))return;
    try{
      const d=await rpc('teacher_merit_set_staff_period_participation',{
        p_period_id:periodId,p_staff_id:staffId,p_participating:value
      });
      if(!d?.ok)throw new Error(d?.reason||'No se pudo actualizar.');
      await loadPeriodStaff();
    }catch(e){alert('No se pudo actualizar la participación: '+(e.message||e))}
  }

  async function loadPeriodStaff(){
    ensurePeriodUI();
    const periodId=$('#meritStaffPeriodSelect31')?.value;
    const box=$('#meritStaffPeriodTable31'),sum=$('#meritStaffPeriodSummary31');
    if(!periodId){box.innerHTML='<p class="hint">Selecciona un periodo.</p>';return;}
    if(sum)sum.textContent='Cargando participación…';
    try{
      const d=await rpc('teacher_merit_staff_period_matrix',{p_period_id:periodId});
      if(!d?.ok)throw new Error(d?.reason||'No se pudo cargar.');
      const rows=Array.isArray(d.rows)?d.rows:[];
      const active=rows.filter(x=>x.participating).length;
      if(sum)sum.innerHTML='<b>'+esc(d.period_label)+'</b> · '+active+' participante'+(active===1?'':'s')+' de '+rows.length+' confirmado'+(rows.length===1?'':'s')+'.';
      if(!rows.length){
        box.innerHTML='<p class="hint">Todavía no hay personal confirmado. Los folios de prueba no aparecen aquí hasta que confirmes su participación.</p>';
        return;
      }
      box.innerHTML='<table><thead><tr><th>ID</th><th>Nombre</th><th>Función</th><th>Estado del periodo</th><th>Acción</th></tr></thead><tbody>'+
        rows.map(r=>{
          const state=r.participating
            ?'<span class="success"><b>✓ Participa</b></span>'
            :'<span class="hint"><b>No participa</b></span>';
          const action=r.participating
            ?'<button class="secondary meritPeriodOff31" type="button" data-id="'+esc(r.staff_id)+'">No participa este mes</button>'
            :'<button class="primary meritPeriodOn31" type="button" data-id="'+esc(r.staff_id)+'">Activar en este mes</button>';
          return '<tr><td><b>'+esc(r.staff_code||'—')+'</b></td><td>'+esc(r.display_name||'')+'</td><td>'+esc(r.subject_area||r.role_type||'')+'</td><td>'+state+'</td><td>'+action+'</td></tr>';
        }).join('')+'</tbody></table>';
      $$('.meritPeriodOn31').forEach(b=>b.onclick=()=>setParticipation(b.dataset.id,true));
      $$('.meritPeriodOff31').forEach(b=>b.onclick=()=>setParticipation(b.dataset.id,false));
    }catch(e){
      box.innerHTML='';
      if(sum)sum.textContent='No se pudo cargar la participación: '+(e.message||e);
    }
  }

  async function activateForSelectedPeriod(e){
    const btn=e.target.closest('#meritTeacherFolioActivate');
    if(!btn)return;
    e.preventDefault();e.stopImmediatePropagation();
    const code=String($('#meritTeacherFolioCode')?.value||'').replace(/\D+/g,'').slice(0,6);
    const periodId=$('#meritStaffPeriodSelect31')?.value;
    const status=$('#meritTeacherFolioStatus');
    if(!periodId){status.textContent='Selecciona primero el periodo en el que participará.';return}
    btn.disabled=true;status.textContent='Activando participación…';
    try{
      const d=await rpc('teacher_merit_activate_staff_code_for_period',{p_staff_code:code,p_period_id:periodId});
      if(!d?.ok){
        if(d?.reason==='not_found')throw new Error('No se encontró ese ID.');
        throw new Error(d?.reason||'No se pudo activar.');
      }
      status.textContent='✓ ID '+code+' confirmado y marcado como participante en el periodo seleccionado. El docente deberá completar su perfil y cambiar su NIP.';
      try{await loadPeriodStaff()}catch(_){}
      setTimeout(()=>{
        const scan=$('#meritTeacherFolioScan');if(scan)scan.value='';
        $('#meritTeacherFolioResult')?.classList.add('hidden');
        scan?.focus();
      },1100);
    }catch(err){status.textContent='No se pudo activar: '+(err.message||err);btn.disabled=false}
  }

  function wire(){
    ensurePeriodUI();
    document.addEventListener('click',activateForSelectedPeriod,true);
    document.querySelectorAll('.meritNav[data-merit-pane="staff"]').forEach(b=>b.addEventListener('click',async()=>{
      await loadPeriods();await loadPeriodStaff();
    }));
    setTimeout(async()=>{await loadPeriods();await loadPeriodStaff()},1600);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
})();