// App Docente v8.23.70 · compactación segura de cola offline y sincronización protegida
(function(){
  function qget(){try{return typeof offlineQueueGet==='function'?offlineQueueGet():[]}catch(_){return []}}
  function qset(q){try{if(typeof offlineQueueSet==='function')offlineQueueSet(q)}catch(_){}}
  function allowedOfflineItem(item){
    const n=String(item?.name||'');
    return [
      'teacher_book_payment_record',
      'teacher_book_payment_record_safe',
      'teacher_book_payment_void',
      'teacher_book_mark_requested',
      'teacher_book_mark_delivered',
      'teacher_book_editorial_payment_record'
    ].includes(n);
  }

  function purgeLegacyOfflineQueue(){
    const q=qget();
    if(!Array.isArray(q)||!q.length)return {before:0,after:0,removed:0};
    const keep=q.filter(allowedOfflineItem);
    if(keep.length!==q.length)qset(keep);
    try{updateConnectivityUi?.()}catch(_){}
    return {before:q.length,after:keep.length,removed:q.length-keep.length};
  }
  function mkid(){return crypto?.randomUUID?.()||('q_'+Date.now()+'_'+Math.random().toString(36).slice(2))}
  function rowTime(r){
    const v=r?.delivery_date||r?.data?.timestamp||r?.data?.deliveryDate||r?.timestamp||r?.updated_at||'';
    const t=Date.parse(v);return Number.isFinite(t)?t:0;
  }

  function compactActivityRows(items){
    const map=new Map();
    for(const item of items){
      const rows=Array.isArray(item?.args?.p_rows)?item.args.p_rows:[];
      for(const r of rows){
        const aid=String(r?.activity_id||'');
        const sid=String(r?.student_id||'');
        if(!aid||!sid)continue;
        const key=aid+'|'+sid;
        const prev=map.get(key);
        if(!prev || rowTime(r)>=rowTime(prev.row)){
          map.set(key,{row:r,created_at:item.created_at||new Date().toISOString()});
        }
      }
    }
    const vals=[...map.values()];
    const out=[];
    for(let i=0;i<vals.length;i+=40){
      const chunk=vals.slice(i,i+40);
      out.push({
        id:mkid(),
        name:'teacher_activity_records_merge_safe',
        args:{p_rows:chunk.map(x=>x.row)},
        created_at:chunk[0]?.created_at||new Date().toISOString(),
        compacted:true
      });
    }
    return out;
  }

  function compactMaterialMarks(items){
    const map=new Map();
    for(const item of items){
      const a=item?.args||{};
      const mats=Array.isArray(a.p_material_names)?a.p_material_names:[];
      for(const m of mats){
        const key=[a.p_date,a.p_group_name,a.p_student_id,String(m).trim().toLowerCase()].join('|');
        map.set(key,{
          id:mkid(),
          name:'teacher_activity_material_mark',
          args:{
            p_date:a.p_date,
            p_group_name:a.p_group_name,
            p_material_names:[m],
            p_student_id:a.p_student_id,
            p_brought:!!a.p_brought
          },
          created_at:item.created_at||new Date().toISOString(),
          compacted:true
        });
      }
    }
    return [...map.values()];
  }

  function compactBookRequests(items){
    const ids=new Set();
    let created=null;
    for(const item of items){
      if(!created)created=item.created_at;
      for(const sid of (item?.args?.p_student_ids||[]))ids.add(String(sid));
    }
    if(!ids.size)return [];
    return [{
      id:mkid(),
      name:'teacher_book_mark_requested',
      args:{p_student_ids:[...ids]},
      created_at:created||new Date().toISOString(),
      compacted:true
    }];
  }

  function compactOfflineQueue(){
    const purged=purgeLegacyOfflineQueue();
    const q=qget();
    if(!Array.isArray(q)||q.length<2)return {before:purged.before||q?.length||0,after:q?.length||0,removed:purged.removed||0};

    const activity=[],material=[],bookReq=[],keep=[];
    for(const item of q){
      if(item?.name==='teacher_activity_records_merge_safe')activity.push(item);
      else if(item?.name==='teacher_activity_material_mark')material.push(item);
      else if(item?.name==='teacher_book_mark_requested')bookReq.push(item);
      else keep.push(item); // pagos, anulaciones y cualquier evento único se conservan exactamente.
    }

    const compacted=[
      ...keep,
      ...compactActivityRows(activity),
      ...compactMaterialMarks(material),
      ...compactBookRequests(bookReq)
    ].sort((a,b)=>String(a.created_at||'').localeCompare(String(b.created_at||'')));

    qset(compacted);
    try{updateConnectivityUi?.()}catch(_){}
    return {before:Math.max(purged.before||0,q.length),after:compacted.length,removed:purged.removed||0};
  }

  // Al cargar, eliminar cola heredada de módulos que ya no usan offline.
  // Se conservan únicamente Pagos de libros y Mérito.
  window.addEventListener('load',()=>setTimeout(()=>{
    const r=compactOfflineQueue();
    if(r.removed>0){
      try{supaState?.('🟢 Cola saneada · '+r.removed+' reintento'+(r.removed===1?'':'s')+' antiguo'+(r.removed===1?'':'s')+' eliminado'+(r.removed===1?'':'s')+'. '+r.after+' pendiente'+(r.after===1?'':'s')+' real'+(r.after===1?'':'es')+'.')}catch(_){}
    }
  },500));

  // Cada nueva alta compacta únicamente las operaciones seguras.
  try{
    const prev=offlineEnqueueRpc;
    offlineEnqueueRpc=function(name,args={}){
      const id=prev(name,args);
      if(
        name==='teacher_activity_records_merge_safe'||
        name==='teacher_activity_material_mark'||
        name==='teacher_book_mark_requested'
      ){
        compactOfflineQueue();
      }
      return id;
    };
  }catch(_){}

  async function safeSyncNow(){
    const btn=document.querySelector('#syncSupabaseBtn');
    const old=btn?.textContent;
    try{
      if(btn){btn.disabled=true;btn.textContent='Preparando sincronización…'}
      const result=compactOfflineQueue();
      const pending=qget().length;

      const client=window.ProfeSupabase;
      const saved=client?.restore?.();
      if(!saved){
        document.querySelector('#teacherLoginGate')?.classList.remove('hidden');
        if(typeof supaState==='function')supaState('Tu sesión necesita iniciarse para enviar los '+pending+' pendientes. Los datos siguen guardados en este dispositivo.',false);
        return;
      }

      try{
        await client.token();
      }catch(e){
        const msg=String(e?.message||e||'');
        if(/sesión de sincronización venció|sesion de sincronizacion vencio|inicia sesión nuevamente|inicia sesion nuevamente/i.test(msg)){
          document.querySelector('#teacherLoginGate')?.classList.remove('hidden');
          if(typeof supaState==='function')supaState('Sesión vencida · '+pending+' pendiente'+(pending===1?'':'s')+' protegido'+(pending===1?'':'s')+'. Inicia sesión una sola vez para reanudar.',false);
          return;
        }
        if(typeof supaState==='function')supaState('Sincronización en espera · '+pending+' pendiente'+(pending===1?'':'s')+' protegido'+(pending===1?'':'s')+'.',false);
        return;
      }

      try{cloudOnline=true;supabaseReady=true}catch(_){}
      if(typeof supaState==='function'){
        const savedCount=Math.max(0,result.before-result.after);
        supaState('Sincronizando '+pending+' pendiente'+(pending===1?'':'s')+(savedCount?' · '+savedCount+' reintento'+(savedCount===1?'':'s')+' viejo'+(savedCount===1?'':'s')+' descartado'+(savedCount===1?'':'s'):'')+'…');
      }

      if(typeof flushOfflineRpcQueue==='function')await flushOfflineRpcQueue();
      try{updateConnectivityUi?.()}catch(_){}
    }finally{
      if(btn){btn.disabled=false;btn.textContent=old||'Sincronizar ahora'}
    }
  }

  window.addEventListener('load',()=>setTimeout(()=>{
    const btn=document.querySelector('#syncSupabaseBtn');
    if(btn)btn.onclick=safeSyncNow;
  },900));

  window.compactOfflineQueueSafely=compactOfflineQueue;
  window.purgeLegacyOfflineQueue=purgeLegacyOfflineQueue;
})();