// App Docente · guardia única de Actividades: Supabase es la fuente de verdad
(function(){
  let installed=false;
  async function notifyActivityDelivered(record){
    const status=String(record?.status||'').toLowerCase();
    if(status!=='yes')return;
    const aid=String(record.activityId||record.activity_id||String(record.key||'').split('|')[0]||'');
    const sid=String(record.studentId||record.student_id||String(record.key||'').split('|')[1]||'');
    if(!aid||!sid||!window.ProfeSupabase)return;
    try{
      const acts=typeof window.all==='function'?await window.all('activities'):[];
      const a=(acts||[]).find(x=>String(x.id)===aid);
      await window.ProfeSupabase.invoke('send-push',{body:{event:'activity_update',student_id:sid,status:'yes',title:a?.name||a?.title||'Actividad',message:'Se registró la actividad como entregada.'}});
    }catch(e){console.error('Push actividad entregada',e);}
  }
  function activityRow(a){return {id:String(a.id),group_name:String(a.group||a.group_name||''),shift:String(a.shift||''),title:a.name||a.title||'Actividad',activity_date:a.date||a.activity_date||null,due_date:a.dueDate||a.due_date||null,evaluation_type:a.evaluationMode||a.evaluation_type||'delivery',max_score:Number.isFinite(Number(a.max_score))?Number(a.max_score):10,visible_to_students:a.visible_to_students!==false,closed:!!a.closed,data:a};}
  function recordRow(r){
    const aid=String(r.activityId||r.activity_id||String(r.key||'').split('|')[0]||''),sid=String(r.studentId||r.student_id||String(r.key||'').split('|')[1]||''),status=String(r.status||'').toLowerCase(),score=typeof r.score==='number'&&Number.isFinite(r.score)?r.score:null;
    if(!aid||!sid)throw new Error('Registro de actividad incompleto.');
    if(status!=='yes'&&status!=='no'&&score===null)throw new Error('El registro no contiene un estado o calificación válida.');
    const stamp=r.timestamp||r.deliveryDate||r.delivery_date||new Date().toISOString();
    return {activity_id:aid,student_id:sid,delivered:status==='yes'?true:status==='no'?false:null,score,delivery_date:stamp,observations:r.observations||null,data:{...r,key:aid+'|'+sid,activityId:aid,studentId:sid,timestamp:stamp}};
  }
  async function install(){
    if(installed||typeof window.put!=='function'||typeof window.del!=='function')return false;
    const originalPut=window.put.bind(window),originalDel=window.del.bind(window);
    window.__activityOriginalPut=originalPut;window.__activityOriginalDel=originalDel;
    window.put=async function(store,value){
      if(store==='activities'){
        if(!window.ProfeSupabase)throw new Error('NO GUARDADO: sin conexión con Supabase.');
        await window.ProfeSupabase.upsert('activities',[activityRow(value)],'id');
      }else if(store==='activityRecords'){
        if(!window.ProfeSupabase)throw new Error('NO GUARDADO: sin conexión con Supabase.');
        const out=await window.ProfeSupabase.rpc('teacher_activity_records_merge_safe',{p_rows:[recordRow(value)]});
        if(out?.ok===false||Number(out?.merged||0)!==1)throw new Error(out?.error||out?.reason||'Supabase no confirmó el registro.');
        await notifyActivityDelivered(value);
      }
      return originalPut(store,value);
    };
    window.del=async function(store,id){
      if(store==='activityRecords'){
        const parts=String(id||'').split('|');
        if(parts.length<2||!parts[0]||!parts[1])throw new Error('NO GUARDADO: llave de actividad inválida.');
        if(!window.ProfeSupabase)throw new Error('NO GUARDADO: sin conexión con Supabase.');
        const out=await window.ProfeSupabase.rpc('teacher_activity_record_clear',{p_activity_id:parts[0],p_student_id:parts.slice(1).join('|')});
        if(out?.ok===false)throw new Error(out?.error||out?.reason||'Supabase no confirmó la eliminación.');
      }
      return originalDel(store,id);
    };
    installed=true;window.__activityServerGuardInstalled=true;return true;
  }
  async function boot(){for(let i=0;i<80&&!installed;i++){try{if(await install())break}catch(e){console.error('Guardia Actividades',e)}await new Promise(r=>setTimeout(r,100));}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();