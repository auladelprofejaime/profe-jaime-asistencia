(function(){
 let data=null,busy=false,seq=0,inFlight=null,loadedAt=0,loading=false,verified=false;const q=id=>document.getElementById(id),esc=x=>safe(String(x??''));
 function roster(){return (data?.students||[]).filter(s=>s.group_key===q('poemGroup').value)}
 function catalog(){return data?.catalog||[]}
 function status(text){q('poemStatus').textContent=text}
 function render(){
  const rows=roster(),assigned=rows.filter(s=>s.poem_number!=null),missing=rows.length-assigned.length;
  q('poemTotal').textContent=rows.length;q('poemAssigned').textContent=assigned.length;q('poemMissing').textContent=missing;
  const old=q('poemStudent').value;
  q('poemStudent').innerHTML='<option value="">Selecciona alumno</option>'+rows.map(s=>'<option value="'+esc(s.id)+'">'+esc(s.number||'—')+'. '+esc(s.name)+(s.poem_number?' · #'+s.poem_number:' · Sin elegir')+'</option>').join('');
  if(rows.some(s=>s.id===old))q('poemStudent').value=old;
  renderChoices();renderList();renderAvailable();
 }
 function renderAvailable(){
  let panel=q('poemAvailablePanel');
  if(!panel){panel=document.createElement('section');panel.id='poemAvailablePanel';panel.className='card';q('poemGroup').closest('label').after(panel);}
  const canonical=n=>Number(n)===16?9:Number(n),taken=new Set(roster().filter(s=>s.poem_number!=null).map(s=>canonical(s.poem_number)));
  const available=new Map();
  for(const p of catalog()){const key=Number(p.canonical_number)||canonical(p.number);if(taken.has(key))continue;if(!available.has(key))available.set(key,{...p,numbers:[]});available.get(key).numbers.push(p.number);}
  panel.innerHTML='<h3>Poemas disponibles en este grupo · '+available.size+'</h3><p class="hint">'+(verified?'Sin reservar en el grupo seleccionado. Toca un poema para seleccionarlo; no se guarda hasta pulsar Reservar poema.':'Última consulta: verificando disponibilidad. Espera la confirmación antes de reservar.')+'</p><div class="poem-available-grid">'+([...available.values()].map(p=>'<button type="button" class="secondary poem-available-choice" data-poem-available="'+p.number+'" '+(loading||busy||!verified?'disabled':'')+'><b>'+p.numbers.join(' / ')+'. '+esc(p.title)+'</b><small>'+esc(p.author)+'</small></button>').join('')||'<p class="empty">Todos los poemas del catálogo están reservados en este grupo.</p>')+'</div>';
  panel.querySelectorAll('[data-poem-available]').forEach(b=>b.onclick=()=>{q('poemNumber').value=b.dataset.poemAvailable;q('poemStudent').scrollIntoView({behavior:'smooth',block:'center'});status('Poema '+b.dataset.poemAvailable+' seleccionado. Elige al alumno y pulsa Reservar poema.');});
 }
 function renderChoices(){
  const rows=roster(),sid=q('poemStudent').value,st=rows.find(s=>s.id===sid),old=q('poemNumber').value;
  const taken=new Map(rows.filter(s=>s.poem_number&&s.id!==sid).map(s=>[s.poem_number===16?9:s.poem_number,s]));
  q('poemNumber').innerHTML='<option value="">Número y título del poema</option>'+catalog().map(p=>{const holder=taken.get(p.canonical_number);return '<option value="'+p.number+'" '+(holder?'disabled':'')+'>'+p.number+'. '+esc(p.title)+' · '+esc(p.author)+(holder?' · OCUPADO: '+esc(holder.name):'')+'</option>'}).join('');
  const wanted=st?.poem_number||Number(old);if(wanted&&!taken.has(wanted===16?9:wanted))q('poemNumber').value=String(wanted);
  q('poemSave').disabled=busy||loading||!verified||!sid;q('poemRelease').disabled=busy||loading||!verified||!st?.poem_number;
 }
 function renderList(){
  const filter=q('poemFilter').value,needle=q('poemSearch').value.trim().toLocaleLowerCase();
  const rows=roster().filter(s=>(filter!=='missing'||!s.poem_number)&&(filter!=='assigned'||s.poem_number)&&(!needle||(s.name+' '+s.id+' '+(s.number||'')).toLocaleLowerCase().includes(needle)));
  q('poemList').innerHTML=rows.length?'<table class="matrix"><thead><tr><th>#</th><th>Alumno</th><th>Poema del listado</th><th>Acción</th></tr></thead><tbody>'+rows.map(s=>{const p=catalog().find(p=>p.number===s.poem_number);return '<tr><td>'+esc(s.number||'—')+'</td><td class="name">'+esc(s.name)+'</td><td>'+(p?'<b>'+p.number+'. '+esc(p.title)+'</b><br><small>'+esc(p.author)+'</small>':'Sin elegir')+'</td><td><button type="button" class="secondary" data-poem-student="'+esc(s.id)+'">'+(p?'Cambiar':'Asignar')+'</button></td></tr>'}).join('')+'</tbody></table>':'<div class="empty">No hay alumnos con este filtro.</div>';
  q('poemList').querySelectorAll('[data-poem-student]').forEach(b=>b.onclick=()=>{q('poemStudent').value=b.dataset.poemStudent;renderChoices();q('poemStudent').scrollIntoView({behavior:'smooth',block:'center'})});
 }
 async function load(force=false){
  if(data)render();
  if(inFlight)return await inFlight;
  if(data&&verified&&!force&&Date.now()-loadedAt<20000){status('Reservas verificadas. Los cambios de grupo y filtros no requieren otra consulta.');return true;}
  const ticket=++seq;loading=true;verified=false;status(data?'Verificando reservas; el listado anterior sigue visible…':'Consultando reservas guardadas…');if(data)render();
  let timer;
  const work=(async()=>{try{const out=await Promise.race([ProfeSupabase.rpc('teacher_poem_dashboard',{}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('La consulta está tardando más de lo esperado')),12000);})]);if(!out?.ok)throw Error('No llegó el concentrado.');if(ticket!==seq)return false;data=out;verified=true;loadedAt=Date.now();
   const old=q('poemGroup').value,groups=[...new Map(out.students.map(s=>[s.group_key,s.group])).entries()];
   q('poemGroup').innerHTML=groups.map(([key,name])=>'<option value="'+esc(key)+'">'+esc(name)+'</option>').join('');if(groups.some(g=>g[0]===old))q('poemGroup').value=old;
   status('Reservas verificadas en el servidor. Sin repetir dentro de cada grupo.');return true;
  }catch(e){if(ticket===seq)status('No se pudo verificar: '+(e.message||e)+'. Pulsa Actualizar. El listado anterior no confirma disponibilidad actual.');return false;}
  finally{clearTimeout(timer);if(ticket===seq){loading=false;if(data)render();}}})();
  inFlight=work;try{return await work}finally{if(inFlight===work)inFlight=null;}
 }
 async function save(release=false){
  if(busy||loading)return;if(!verified)return status('Actualiza las reservas antes de guardar.');const sid=q('poemStudent').value,num=release?null:Number(q('poemNumber').value);if(!sid||(!release&&!num))return status('Selecciona alumno y número de poema.');
  const st=roster().find(s=>s.id===sid);if((release||st?.poem_number)&&!confirm(release?'¿Liberar el poema de '+st.name+'? Volverá a aparecer sin elegir.':'¿Cambiar el poema de '+st.name+'? Su reserva anterior quedará liberada.'))return;
  busy=true;renderChoices();renderAvailable();status('Guardando reserva…');
  try{const out=await ProfeSupabase.rpc('teacher_reserve_poem',{p_student_id:sid,p_poem_number:num});if(!out?.ok)throw Error(out?.reason||'No se confirmó la reserva.');const refreshed=await load(true);status((release?'Poema liberado.':'✓ Poema '+num+' reservado para '+st.name+'.')+(refreshed?'':' El cambio se guardó, pero falta verificar el listado. Pulsa Actualizar.'));}
  catch(e){await load(true);status('No se confirmó el cambio: '+(e.message||e));}finally{busy=false;renderChoices();renderAvailable();}
 }
 const originalView=setView;setView=function(id){const result=originalView.apply(this,arguments);if(id==='poem-contest'){q('currentSection').textContent='Concurso de poemas';load()}return result};
 window.addEventListener('load',()=>{
  const style=document.createElement('style');style.textContent='#poemAvailablePanel{margin:16px 0;background:#fffbe9}#poemAvailablePanel h3{margin:0 0 8px}.poem-available-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px}.poem-available-choice{text-align:left;white-space:normal}.poem-available-choice small{display:block;margin-top:4px;opacity:.7}';document.head.appendChild(style);
  document.querySelector('[data-view="poem-contest"]').onclick=()=>setView('poem-contest');
  q('poemGroup').onchange=()=>{q('poemStudent').value='';q('poemNumber').value='';render()};q('poemStudent').onchange=renderChoices;q('poemFilter').onchange=renderList;q('poemSearch').oninput=renderList;q('poemRefresh').onclick=()=>load(true);q('poemSave').onclick=()=>save();q('poemRelease').onclick=()=>save(true);
 });
})();
