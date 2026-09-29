// App Docente v8.23.89 · botón manual de respaldo "Actualizar apps"
(function(){
  function el(id){return document.getElementById(id)}
  function splitKey(v){
    const [activityId,studentId]=String(v||'').split('|');
    return {activityId,studentId};
  }
  async function merge(activityId,studentId,payload){
    if(!window.ProfeSupabase) throw new Error('Supabase no está disponible.');
    const now=new Date().toISOString();
    const row={
      activity_id:String(activityId),
      student_id:String(studentId),
      delivered:payload.status==='yes'?true:payload.status==='no'?false:null,
      score:typeof payload.score==='number'?payload.score:null,
      delivery_date:now,
      data:{
        key:String(activityId)+'|'+String(studentId),
        activityId:String(activityId),
        studentId:String(studentId),
        ...(payload.status?{status:payload.status}:{}),
        ...(typeof payload.score==='number'?{score:payload.score}:{}),
        timestamp:now
      }
    };
    const out=await window.ProfeSupabase.rpc('teacher_activity_records_merge_safe',{p_rows:[row]});
    if(out?.ok===false)throw new Error(out?.error||'No se pudo confirmar el registro.');
  }
  async function clear(activityId,studentId){
    if(!window.ProfeSupabase) throw new Error('Supabase no está disponible.');
    const out=await window.ProfeSupabase.rpc('teacher_activity_record_clear',{
      p_activity_id:String(activityId),
      p_student_id:String(studentId)
    });
    if(out?.ok===false)throw new Error(out?.error||'No se pudo limpiar el registro.');
  }

  async function syncGrid(rootSelector,button){
    const root=document.querySelector(rootSelector);
    if(!root)throw new Error('No se encontró la cuadrícula.');

    const delivery=[...root.querySelectorAll('[data-mark],[data-range-delivery]')];
    const numeric=[...root.querySelectorAll('[data-score],[data-range-score]')];
    if(!delivery.length&&!numeric.length)throw new Error('Primero carga una cuadrícula con actividades.');

    const original=button.textContent;
    button.disabled=true;
    button.textContent='Actualizando apps…';

    let ok=0,fail=0;
    try{
      // Procesar en grupos pequeños para no saturar el iPad ni Supabase.
      const jobs=[];

      for(const cell of delivery){
        let activityId,studentId;
        if(cell.dataset.mark){
          ({activityId,studentId}=splitKey(cell.dataset.mark));
        }else{
          activityId=cell.dataset.aid; studentId=cell.dataset.sid;
        }
        let state='blank';
        if(cell.classList.contains('yes'))state='yes';
        else if(cell.classList.contains('no'))state='no';
        else if(cell.classList.contains('pending'))state='blank';

        jobs.push(async()=>{
          try{
            if(state==='blank')await clear(activityId,studentId);
            else await merge(activityId,studentId,{status:state});
            ok++;
          }catch(e){console.warn('Actualizar apps · entrega',activityId,studentId,e);fail++}
        });
      }

      for(const input of numeric){
        let activityId,studentId;
        if(input.dataset.score){
          ({activityId,studentId}=splitKey(input.dataset.score));
        }else{
          activityId=input.dataset.aid; studentId=input.dataset.sid;
        }
        const raw=String(input.value||'').trim();
        jobs.push(async()=>{
          try{
            if(raw==='')await clear(activityId,studentId);
            else{
              const score=Number(raw);
              if(!Number.isFinite(score)||score<0||score>10)throw new Error('Calificación fuera de rango.');
              await merge(activityId,studentId,{score});
            }
            ok++;
          }catch(e){console.warn('Actualizar apps · calificación',activityId,studentId,e);fail++}
        });
      }

      for(let i=0;i<jobs.length;i+=8){
        await Promise.all(jobs.slice(i,i+8).map(fn=>fn()));
      }

      if(fail){
        alert(`Se sincronizaron ${ok} registros. ${fail} no pudieron confirmarse; revisa tu conexión y vuelve a pulsar “Actualizar apps”.`);
      }else{
        alert(`Apps actualizadas correctamente. Se confirmaron ${ok} registros con el servidor.`);
      }
    }finally{
      button.disabled=false;
      button.textContent=original;
    }
  }

  function installWeeklyButton(){
    if(el('syncWeeklyApps'))return;
    const pdf=el('gridPdf');
    if(!pdf)return;
    const label=pdf.closest('label')||pdf.parentElement;
    const btn=document.createElement('button');
    btn.id='syncWeeklyApps';
    btn.type='button';
    btn.className='primary';
    btn.textContent='Actualizar apps';
    btn.style.marginTop='8px';
    btn.onclick=()=>syncGrid('#activityGrid',btn).catch(e=>alert('No se pudieron actualizar las apps: '+(e?.message||e)));
    label.appendChild(btn);
  }

  function installRangeButton(){
    if(el('syncRangeApps'))return;
    const refresh=el('rangeRefresh');
    if(!refresh)return;
    const label=refresh.closest('label')||refresh.parentElement;
    const btn=document.createElement('button');
    btn.id='syncRangeApps';
    btn.type='button';
    btn.className='secondary';
    btn.textContent='Actualizar apps';
    btn.style.marginTop='8px';
    btn.onclick=()=>syncGrid('#activityRangeGrid',btn).catch(e=>alert('No se pudieron actualizar las apps: '+(e?.message||e)));
    label.appendChild(btn);
  }

  function install(){
    installWeeklyButton();
    installRangeButton();
    const obs=new MutationObserver(()=>{installWeeklyButton();installRangeButton()});
    obs.observe(document.body,{childList:true,subtree:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();