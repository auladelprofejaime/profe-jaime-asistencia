/* App Docente · Beneficios de cumpleaños · Matutino + 3.º A vespertino */
(function(){
  const $=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let birthdayRows=[];

  async function birthdayLiveRpc(name,args={}){
    if(!navigator.onLine) throw new Error('Necesitas conexión para consultar o modificar beneficios de cumpleaños.');
    try{ if(typeof probeSupabaseConnection==='function') await probeSupabaseConnection({force:true}); }catch(_){}
    let direct=null;
    try{ direct=(typeof _originalRpc==='function')?_originalRpc:null; }catch(_){}
    const fn=direct||window.ProfeSupabase?.rpc?.bind(window.ProfeSupabase);
    if(!fn) throw new Error('No se pudo conectar con Supabase.');
    const out=await fn(name,args);
    try{ cloudOnline=true;supabaseReady=true;updateConnectivityUi?.(); }catch(_){}
    try{ if(typeof offlineRpcSet==='function') offlineRpcSet(name,args,out); }catch(_){}
    return out;
  }

  function groupKey(r){
    return [String(r.shift||'').trim(),String(r.group_name||'').trim()].join('|');
  }
  function groupLabel(r){
    const shift=String(r.shift||'').trim();
    const group=String(r.group_name||'').trim();
    if(shift.toLowerCase()==='vespertino' && group.replace(/[º°]/g,'').toUpperCase()==='3A') return '3.º A · Vespertino';
    return (group?'Grupo '+group:'Sin grupo')+(shift?' · '+shift:'');
  }
  function formatDate(v){
    if(!v) return 'Sin fecha';
    const d=new Date(String(v).slice(0,10)+'T12:00:00');
    return d.toLocaleDateString('es-MX',{day:'numeric',month:'long'});
  }
  function statusText(r){
    if(r.benefit){
      const total=Number(r.benefit.uses_total||1),used=Number(r.benefit.uses_used||0),remaining=Math.max(0,total-used);
      if(remaining<=0) return 'Utilizado por completo';
      if(!r.benefit.accepted_at) return 'Pendiente de aceptar';
      return total>1?('Activo · '+remaining+' de '+total+' usos disponibles'):'Activo · pendiente de usar';
    }
    return r.eligible?'Pendiente de descubrir':'Aún no llega su cumpleaños';
  }
  function statusClass(r){
    if(r.benefit && Number(r.benefit.uses_remaining||0)<=0) return 'badge';
    if(r.benefit) return 'badge';
    return r.eligible?'badge':'hint';
  }

  function refreshGroupOptions(){
    const sel=$('#birthdayBenefitsGroup');
    if(!sel) return;
    const prev=sel.value||'__ALL__';
    const seen=new Map();
    birthdayRows.forEach(r=>seen.set(groupKey(r),groupLabel(r)));
    const opts=[['__ALL__','Todos los grupos'],...Array.from(seen.entries()).sort((a,b)=>a[1].localeCompare(b[1],'es'))];
    sel.innerHTML=opts.map(([v,l])=>'<option value="'+esc(v)+'">'+esc(l)+'</option>').join('');
    if(opts.some(([v])=>v===prev)) sel.value=prev;
    else if(opts.some(([v,l])=>/3\.º A · Vespertino/.test(l))) sel.value=opts.find(([v,l])=>/3\.º A · Vespertino/.test(l))[0];
  }

  function renderBirthdayBenefitsAdmin(){
    const list=$('#birthdayBenefitsList'),summary=$('#birthdayBenefitsSummary'),sel=$('#birthdayBenefitsGroup');
    if(!list) return;
    const filter=sel?.value||'__ALL__';
    const rows=birthdayRows.filter(r=>filter==='__ALL__'||groupKey(r)===filter);
    const eligible=rows.filter(r=>r.eligible).length;
    const generated=rows.filter(r=>!!r.benefit).length;
    const active=rows.filter(r=>r.benefit && Number(r.benefit.uses_remaining||0)>0).length;
    if(summary){
      summary.innerHTML=
        '<div class="stat"><span>Alumnos</span><b>'+rows.length+'</b></div>'+
        '<div class="stat"><span>Ya cumplieron</span><b>'+eligible+'</b></div>'+
        '<div class="stat"><span>Beneficio generado</span><b>'+generated+'</b></div>'+
        '<div class="stat"><span>Beneficios activos</span><b>'+active+'</b></div>';
    }
    if(!rows.length){ list.innerHTML='<div class="empty">No hay alumnos para este filtro.</div>'; return; }

    list.innerHTML=rows.map(r=>{
      const b=r.benefit;
      const total=Number(b?.uses_total||0),used=Number(b?.uses_used||0),remaining=Math.max(0,total-used);
      let actions='';
      if(r.eligible && !b){
        actions='<button class="primary" type="button" data-bday-reveal="'+esc(r.student_id)+'">Descubrir beneficio</button>';
      }else if(b){
        if(!b.accepted_at) actions+='<button class="primary" type="button" data-bday-accept="'+esc(r.student_id)+'">Confirmar aceptación</button>';
        if(b.accepted_at && remaining>0) actions+='<button class="secondary" type="button" data-bday-use="'+esc(r.student_id)+'">Registrar uso</button>';
        if(used>0) actions+='<button class="secondary" type="button" data-bday-undo="'+esc(r.student_id)+'">Deshacer último uso</button>';
      }
      return '<div class="card" style="margin:10px 0;padding:14px">'+
        '<div class="section" style="align-items:flex-start;gap:12px">'+
          '<div style="min-width:0;flex:1">'+
            '<div style="font-weight:900">'+esc(r.student_name||'Alumno')+'</div>'+
            '<div class="hint">'+esc(groupLabel(r))+' · Cumpleaños: '+esc(formatDate(r.birthday_date))+'</div>'+
            '<div class="'+statusClass(r)+'" style="display:inline-block;margin-top:7px">'+esc(statusText(r))+'</div>'+
            (b?'<div style="margin-top:10px"><b>'+esc(b.label||'Beneficio de cumpleaños')+'</b>'+
              (total>1?'<div class="hint">Usos: '+used+' de '+total+' · Restantes: '+remaining+'</div>':'')+
            '</div>':'')+
          '</div>'+
        '</div>'+
        (actions?'<div class="actions" style="margin-top:12px">'+actions+'</div>':'')+
      '</div>';
    }).join('');

    list.querySelectorAll('[data-bday-reveal]').forEach(btn=>btn.addEventListener('click',()=>birthdayAdminReveal(btn.dataset.bdayReveal)));
    list.querySelectorAll('[data-bday-accept]').forEach(btn=>btn.addEventListener('click',()=>birthdayAdminAccept(btn.dataset.bdayAccept)));
    list.querySelectorAll('[data-bday-use]').forEach(btn=>btn.addEventListener('click',()=>birthdayAdminRegisterUse(btn.dataset.bdayUse)));
    list.querySelectorAll('[data-bday-undo]').forEach(btn=>btn.addEventListener('click',()=>birthdayAdminUndoUse(btn.dataset.bdayUndo)));
  }

  async function loadTeacherBirthdayBenefits(){
    const list=$('#birthdayBenefitsList');
    if(list) list.innerHTML='<div class="empty">Cargando beneficios…</div>';
    try{
      const out=await birthdayLiveRpc('teacher_birthday_benefit_list',{});
      birthdayRows=Array.isArray(out?.students)?out.students:[];
      refreshGroupOptions();
      renderBirthdayBenefitsAdmin();
      try{
        const s=await students?.();
        renderWeeklyBirthdays?.(s);
      }catch(_){}
    }catch(e){
      if(list) list.innerHTML='<div class="message"><b>No se pudieron cargar los beneficios.</b><br>'+esc(e?.message||e)+'</div>';
    }
  }

  async function birthdayRefreshAll(){
    await loadTeacherBirthdayBenefits();
  }

  try{
    const baseSensitive=offlineSensitiveServerAction;
    offlineSensitiveServerAction=function(name){
      if(/^teacher_birthday_benefit_(reveal|accept|register_use|undo_use)$/.test(String(name||''))) return true;
      return baseSensitive(name);
    };
  }catch(_){}

  window.renderBirthdayBenefitsAdmin=renderBirthdayBenefitsAdmin;
  window.loadTeacherBirthdayBenefits=loadTeacherBirthdayBenefits;

  window.birthdayAdminReveal=async function(studentId){
    if(!confirm('¿Revelar ahora el beneficio? Se elegirá aleatoriamente y no podrá volver a sortearse.')) return;
    try{
      const out=await birthdayLiveRpc('teacher_birthday_benefit_reveal',{p_student_id:String(studentId)});
      if(!out?.ok) throw new Error(out?.reason==='not_eligible_yet'?'Todavía no llega su cumpleaños.':out?.reason||'No se pudo revelar.');
      alert('Beneficio revelado: '+(out?.benefit?.label||'Beneficio de cumpleaños'));
      await birthdayRefreshAll();
    }catch(e){ alert('No se pudo revelar el beneficio: '+(e?.message||e)); }
  };

  window.birthdayAdminAccept=async function(studentId){
    if(!confirm('¿Confirmar que el alumno aceptó este beneficio?')) return;
    try{
      const out=await birthdayLiveRpc('teacher_birthday_benefit_accept',{p_student_id:String(studentId)});
      if(!out?.ok) throw new Error(out?.reason||'No se pudo aceptar.');
      await birthdayRefreshAll();
    }catch(e){ alert('No se pudo aceptar el beneficio: '+(e?.message||e)); }
  };

  window.birthdayAdminRegisterUse=async function(studentId){
    if(!confirm('¿Registrar un uso de este beneficio?')) return;
    try{
      const out=await birthdayLiveRpc('teacher_birthday_benefit_register_use',{p_student_id:String(studentId)});
      if(!out?.ok) throw new Error(out?.reason||'No se pudo registrar el uso.');
      await birthdayRefreshAll();
    }catch(e){ alert('No se pudo registrar el uso: '+(e?.message||e)); }
  };

  window.birthdayAdminUndoUse=async function(studentId){
    if(!confirm('¿Deshacer el último uso registrado de este beneficio?')) return;
    try{
      const out=await birthdayLiveRpc('teacher_birthday_benefit_undo_use',{p_student_id:String(studentId)});
      if(!out?.ok) throw new Error(out?.reason||'No se pudo deshacer el uso.');
      await birthdayRefreshAll();
    }catch(e){ alert('No se pudo deshacer el uso: '+(e?.message||e)); }
  };

  function wire(){
    $('#refreshBirthdayBenefits')?.addEventListener('click',loadTeacherBirthdayBenefits);
    $('#birthdayBenefitsGroup')?.addEventListener('change',renderBirthdayBenefitsAdmin);
    document.querySelectorAll('[data-view="birthday-benefits"]').forEach(btn=>{
      btn.addEventListener('click',()=>setTimeout(loadTeacherBirthdayBenefits,80));
    });
    if(location.hash==='#birthday-benefits') setTimeout(loadTeacherBirthdayBenefits,300);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',wire);
  else wire();
})();