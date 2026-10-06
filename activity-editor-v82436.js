function renderNewActivityGroupChoices(groups=[],selected=[]){
 const box=$('#newActGroupChoices');if(!box)return;
 const chosen=new Set((Array.isArray(selected)?selected:[selected]).filter(Boolean).map(String));

 box.innerHTML=[
   `<label class="activity-group-choice all-groups"><input type="checkbox" id="newActAllGroups" > Todos</label>`,
   ...groups.map(g=>`<label class="activity-group-choice ${chosen.has(String(g))?'selected':''}">
     <input type="checkbox" class="new-act-group-check" value="${safe(g)}" ${chosen.has(String(g))?'checked':''} > ${safe(g)}
   </label>`)
 ].join('');
 const checks=()=>[...box.querySelectorAll('.new-act-group-check')];
 const paint=()=>box.querySelectorAll('.activity-group-choice').forEach(l=>l.classList.toggle('selected',!!l.querySelector('input')?.checked));
 const all=$('#newActAllGroups');
 if(all){
   all.checked=checks().length>0&&checks().every(x=>x.checked);
   all.onchange=()=>{checks().forEach(c=>c.checked=all.checked);paint()};
 }
 checks().forEach(c=>c.onchange=()=>{if(all)all.checked=checks().length>0&&checks().every(x=>x.checked);paint()});
 paint();
}

const activityEditOriginal=editActivity;
editActivity=async function(id){
 try{
  const out=await ProfeSupabase.rpc('teacher_get_activity_editor',{p_activity_id:id});
  if(!out?.ok||!out.activity)throw Error('No se encontró la actividad en el servidor.');
  const activity=out.activity,groups=activity.groups||[activity.group];
  await req(store('activities','readwrite').put(activity));
  await activityEditOriginal(id);
  const available=uniq([...(await students()).filter(s=>sameShift(s.shift,activity.shift)&&s.active!==false).map(s=>s.group),...groups]);
  renderNewActivityGroupChoices(available,groups);
  $('#newActGroupHelp').textContent='Los cambios se aplican a todos los grupos seleccionados. Puedes agregar o quitar grupos; sus entregas y calificaciones existentes se conservan.';
  $('#newActEvaluation').disabled=!!out.has_records;
  $('#evaluationHelp').textContent=out.has_records?'La forma de evaluación está bloqueada para conservar los registros existentes.':'Las actividades de entrega usan escáner; las numéricas se capturan en la cuadrícula.';
 }catch(e){alert('No se pudo abrir la edición: '+(e.message||e))}
};
