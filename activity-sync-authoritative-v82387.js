// App Docente v8.23.87 · sincronización autoritativa de cambios manuales de actividades
(function(){
  function ids(value){
    const [activityId,studentId]=String(value||'').split('|');
    return {activityId,studentId};
  }
  function warn(message){
    console.error(message);
    try{
      let el=document.getElementById('activityRemoteSyncWarning');
      if(!el){
        el=document.createElement('div');
        el.id='activityRemoteSyncWarning';
        el.style.cssText='position:fixed;left:14px;right:14px;bottom:18px;z-index:99999;background:#8f1d2c;color:#fff;padding:12px 14px;border-radius:12px;font-weight:800;box-shadow:0 8px 28px #0004';
        document.body.appendChild(el);
      }
      el.textContent='⚠️ '+message;
      clearTimeout(el._t);
      el._t=setTimeout(()=>el.remove(),7000);
    }catch(_){}
  }
  async function merge(activityId,studentId,{status,score}={}){
    if(!window.ProfeSupabase||!activityId||!studentId)throw new Error('Supabase no está disponible.');
    const row={
      activity_id:String(activityId),
      student_id:String(studentId),
      delivered:status==='yes'?true:status==='no'?false:null,
      score:typeof score==='number'?score:null,
      delivery_date:new Date().toISOString(),
      data:{
        key:String(activityId)+'|'+String(studentId),
        activityId:String(activityId),
        studentId:String(studentId),
        ...(status?{status}:{}),
        ...(typeof score==='number'?{score}:{}),
        timestamp:new Date().toISOString()
      }
    };
    const out=await window.ProfeSupabase.rpc('teacher_activity_records_merge_safe',{p_rows:[row]});
    if(out?.ok===false||Number(out?.merged||0)!==1)throw new Error(out?.error||'Supabase no confirmó el registro.');
  }
  async function clear(activityId,studentId){
    if(!window.ProfeSupabase||!activityId||!studentId)throw new Error('Supabase no está disponible.');
    const out=await window.ProfeSupabase.rpc('teacher_activity_record_clear',{
      p_activity_id:String(activityId),
      p_student_id:String(studentId)
    });
    if(out?.ok===false)throw new Error(out?.error||'No se confirmó la eliminación.');
  }

  // Cuadrícula semanal y cuadrícula por rango.
  document.addEventListener('click',event=>{
    const weekly=event.target.closest?.('[data-mark]');
    if(weekly){
      const {activityId,studentId}=ids(weekly.dataset.mark);
      const current=weekly.classList.contains('yes')?'yes':weekly.classList.contains('no')?'no':'blank';
      const next=current==='blank'?'yes':current==='yes'?'no':'blank';
      (next==='blank'?clear(activityId,studentId):merge(activityId,studentId,{status:next}))
        .catch(e=>warn('NO GUARDADO. El servidor no confirmó el cambio. '+(e?.message||e)));
      return;
    }

    const range=event.target.closest?.('[data-range-delivery]');
    if(range){
      const activityId=range.dataset.aid,studentId=range.dataset.sid;
      const current=range.classList.contains('yes')?'yes':range.classList.contains('no')?'no':'pending';
      const next=current==='pending'?'yes':current==='yes'?'no':'pending';
      (next==='pending'?clear(activityId,studentId):merge(activityId,studentId,{status:next}))
        .catch(e=>warn('NO GUARDADO. El servidor no confirmó el cambio. '+(e?.message||e)));
    }
  },true);

  document.addEventListener('change',event=>{
    const weekly=event.target.closest?.('[data-score]');
    if(weekly){
      const {activityId,studentId}=ids(weekly.dataset.score);
      const raw=String(weekly.value||'').trim();
      const task=raw===''?clear(activityId,studentId):merge(activityId,studentId,{score:Number(raw)});
      task.catch(e=>warn('NO GUARDADA. El servidor no confirmó la calificación. '+(e?.message||e)));
      return;
    }
    const range=event.target.closest?.('[data-range-score]');
    if(range){
      const activityId=range.dataset.aid,studentId=range.dataset.sid;
      const raw=String(range.value||'').trim();
      const task=raw===''?clear(activityId,studentId):merge(activityId,studentId,{score:Number(raw)});
      task.catch(e=>warn('La calificación no pudo confirmarse en el servidor. '+(e?.message||e)));
    }
  },true);
})();