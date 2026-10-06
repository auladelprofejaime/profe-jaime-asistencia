(function(){
 let data=null,busy=false,seq=0;const q=id=>document.getElementById(id),esc=x=>safe(String(x??''));
 function roster(){return (data?.students||[]).filter(s=>s.group_key===q('poemGroup').value)}
 function catalog(){return data?.catalog||[]}
 function status(text){q('poemStatus').textContent=text}
 function render(){
  const rows=roster(),assigned=rows.filter(s=>s.poem_number!=null),missing=rows.length-assigned.length;
  q('poemTotal').textContent=rows.length;q('poemAssigned').textContent=assigned.length;q('poemMissing').textContent=missing;
  const old=q('poemStudent').value;
  q('poemStudent').innerHTML='<option value="">Selecciona alumno</option>'+rows.map(s=>'<option value="'+esc(s.id)+'">'+esc(s.number||'—')+'. '+esc(s.name)+(s.poem_number?' · #'+s.poem_number:' · Sin elegir')+'</option>').join('');
  if(rows.some(s=>s.id===old))q('poemStudent').value=old;
  renderChoices();renderList();
 }
 function renderChoices(){
  const rows=roster(),sid=q('poemStudent').value,st=rows.find(s=>s.id===sid),old=q('poemNumber').value;
  const taken=new Map(rows.filter(s=>s.poem_number&&s.id!==sid).map(s=>[s.poem_number===16?9:s.poem_number,s]));
  q('poemNumber').innerHTML='<option value="">Número y título del poema</option>'+catalog().map(p=>{const holder=taken.get(p.canonical_number);return '<option value="'+p.number+'" '+(holder?'disabled':'')+'>'+p.number+'. '+esc(p.title)+' · '+esc(p.author)+(holder?' · OCUPADO: '+esc(holder.name):'')+'</option>'}).join('');
  const wanted=st?.poem_number||Number(old);if(wanted&&!taken.has(wanted===16?9:wanted))q('poemNumber').value=String(wanted);
  q('poemSave').disabled=busy||!sid;q('poemRelease').disabled=busy||!st?.poem_number;
 }
 function renderList(){
  const filter=q('poemFilter').value,needle=q('poemSearch').value.trim().toLocaleLowerCase();
  const rows=roster().filter(s=>(filter!=='missing'||!s.poem_number)&&(filter!=='assigned'||s.poem_number)&&(!needle||(s.name+' '+s.id+' '+(s.number||'')).toLocaleLowerCase().includes(needle)));
  q('poemList').innerHTML=rows.length?'<table class="matrix"><thead><tr><th>#</th><th>Alumno</th><th>Poema del listado</th><th>Acción</th></tr></thead><tbody>'+rows.map(s=>{const p=catalog().find(p=>p.number===s.poem_number);return '<tr><td>'+esc(s.number||'—')+'</td><td class="name">'+esc(s.name)+'</td><td>'+(p?'<b>'+p.number+'. '+esc(p.title)+'</b><br><small>'+esc(p.author)+'</small>':'Sin elegir')+'</td><td><button type="button" class="secondary" data-poem-student="'+esc(s.id)+'">'+(p?'Cambiar':'Asignar')+'</button></td></tr>'}).join('')+'</tbody></table>':'<div class="empty">No hay alumnos con este filtro.</div>';
  q('poemList').querySelectorAll('[data-poem-student]').forEach(b=>b.onclick=()=>{q('poemStudent').value=b.dataset.poemStudent;renderChoices();q('poemStudent').scrollIntoView({behavior:'smooth',block:'center'})});
 }
 async function load(){
  const ticket=++seq;status('Consultando reservas guardadas…');
  try{const out=await ProfeSupabase.rpc('teacher_poem_dashboard',{});if(!out?.ok)throw Error('No llegó el concentrado.');if(ticket!==seq)return;data=out;
   const old=q('poemGroup').value,groups=[...new Map(out.students.map(s=>[s.group_key,s.group])).entries()];
   q('poemGroup').innerHTML=groups.map(([key,name])=>'<option value="'+esc(key)+'">'+esc(name)+'</option>').join('');if(groups.some(g=>g[0]===old))q('poemGroup').value=old;
   render();status('Reservas guardadas en el servidor. Sin repetir dentro de cada grupo.');
  }catch(e){status('No se pudo consultar: '+(e.message||e)+'. Pulsa Actualizar.');}
 }
 async function save(release=false){
  if(busy)return;const sid=q('poemStudent').value,num=release?null:Number(q('poemNumber').value);if(!sid||(!release&&!num))return status('Selecciona alumno y número de poema.');
  const st=roster().find(s=>s.id===sid);if((release||st?.poem_number)&&!confirm(release?'¿Liberar el poema de '+st.name+'? Volverá a aparecer sin elegir.':'¿Cambiar el poema de '+st.name+'? Su reserva anterior quedará liberada.'))return;
  busy=true;renderChoices();status('Guardando reserva…');
  try{const out=await ProfeSupabase.rpc('teacher_reserve_poem',{p_student_id:sid,p_poem_number:num});if(!out?.ok)throw Error(out?.reason||'No se confirmó la reserva.');await load();status(release?'Poema liberado.':'✓ Poema '+num+' reservado para '+st.name+'.');}
  catch(e){await load();status('No se guardó: '+(e.message||e));}finally{busy=false;renderChoices();}
 }
 const originalView=setView;setView=function(id){const result=originalView.apply(this,arguments);if(id==='poem-contest'){q('currentSection').textContent='Concurso de poemas';load()}return result};
 window.addEventListener('load',()=>{
  document.querySelector('[data-view="poem-contest"]').onclick=()=>setView('poem-contest');
  q('poemGroup').onchange=()=>{q('poemStudent').value='';q('poemNumber').value='';render()};q('poemStudent').onchange=renderChoices;q('poemFilter').onchange=renderList;q('poemSearch').oninput=renderList;q('poemRefresh').onclick=load;q('poemSave').onclick=()=>save();q('poemRelease').onclick=()=>save(true);
 });
})();
