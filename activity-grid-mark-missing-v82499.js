/* Grid-only action: turn unrecorded deliveries into confirmed "No entregó". */
(function(){
 const grid=document.querySelector('#act-grid');
 const table=document.querySelector('#activityGrid');
 if(!grid||!table)return;
 const action=document.createElement('div');
 action.className='actions';
 action.style.cssText='margin:12px 0;display:flex;align-items:center;flex-wrap:wrap;gap:10px';
 const button=document.createElement('button');
 button.type='button';
 button.className='danger-outline';
 button.textContent='Marcar pendientes como no entregados';
 const status=document.createElement('span');
 status.setAttribute('role','status');
 status.style.cssText='font-size:13px;white-space:normal';
 action.append(button,status);
 table.before(action);
 let busy=false;
 button.addEventListener('click',async()=>{
  if(busy)return;
  const shift=document.querySelector('#gridShift')?.value;
  const group=document.querySelector('#gridGroup')?.value;
  const month=document.querySelector('#gridWeek')?.value;
  if(!shift||!group||!month){alert('Selecciona primero turno, grupo y mes.');return}
  try{
   const [acts,roster,records]=await Promise.all([currentWeekActivities(),students(),all('activityRecords')]);
   const deliveries=acts.filter(a=>(a.evaluationMode||'delivery')==='delivery');
   const pupils=roster.filter(st=>sameShift(st.shift,shift)&&sameGroup(st.group,group));
   const existing=new Set(records.map(r=>String(r.key||r.activityId+'|'+r.studentId)));
   const missing=[];
   for(const a of deliveries)for(const st of pupils){
    const key=String(a.id)+'|'+String(st.id);
    if(!existing.has(key))missing.push({key,activityId:a.id,studentId:st.id,status:'no',timestamp:new Date().toISOString()});
   }
   if(!missing.length){status.textContent='No hay entregas pendientes para marcar en este mes.';return}
   if(!confirm('Grupo '+group+' · '+month+'\\n\\nSe marcarán '+missing.length+' casillas vacías como NO ENTREGÓ (rojo), en '+deliveries.length+' actividades de entrega.\\n\\nLos registros existentes y las actividades numéricas NO se modificarán. ¿Continuar?'))return;
   busy=true;button.disabled=true;
   let saved=0;const errors=[];
   for(const rec of missing){
    try{
     await put('activityRecords',rec);
     saved++;
    }catch(e){errors.push(rec.key);console.error('No entregado sin guardar',rec.key,e);break}
    if(saved%5===0||saved===missing.length)status.textContent='Guardando en servidor: '+saved+' de '+missing.length;
   }
   await renderActivityGrid();
   status.textContent=errors.length?'Guardados '+saved+' de '+missing.length+'. Hubo un error; vuelve a intentar para continuar.':'Listo: '+saved+' faltantes marcados en rojo.';
   if(errors.length)alert('Se guardaron '+saved+' registros. El proceso se detuvo por un error de conexión. Puedes volver a pulsar el botón; los registros ya guardados no se duplicarán.');
  }catch(e){console.error('No se pudieron marcar faltantes',e);alert('No se pudieron marcar faltantes: '+(e.message||e))}
  finally{busy=false;button.disabled=false}
 });
})();
