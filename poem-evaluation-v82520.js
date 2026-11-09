(()=>{
'use strict';
const q=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LINK='https://auladelprofejaime.github.io/profe-jaime-asistencia/acceso/';
const criteria=[['dominio','Dominio del contenido'],['expresion','Expresión oral'],['interpretacion','Interpretación'],['postura','Postura y lenguaje corporal'],['estilo','Originalidad y estilo']];
const teacherDesc={
 dominio:{4:'Conoce a fondo el poema, sin errores ni titubeos; demuestra comprensión y significado profundo del texto.',3:'Conoce el poema, con uno o dos errores menores que no afectan el sentido general; comprensión adecuada del texto.',2:'Presenta algunos errores o titubeos que limitan la comprensión total del poema.',1:'No demuestra conocimiento adecuado del poema; errores graves y confusión evidente.'},
 expresion:{4:'Voz clara, proyección excelente, ritmo adecuado; utiliza pausas y énfasis para resaltar el significado del poema.',3:'Voz clara, pero con leves problemas de proyección o ritmo; pausas y énfasis generalmente bien manejados.',2:'Voz entendible, pero con poca proyección o ritmo monótono; pausas o énfasis poco efectivos.',1:'Voz inaudible o ritmo incorrecto que impide la comunicación efectiva del poema.'},
 interpretacion:{4:'Expresa emociones y sentimientos que reflejan el mensaje del poema; conexión evidente con el público.',3:'Emociones bien transmitidas; buena conexión con el mensaje y el público, aunque no totalmente impactante.',2:'Emociones presentes, pero débiles o poco coherentes con el mensaje del poema.',1:'No transmite emociones ni conecta con el poema ni el público.'},
 postura:{4:'Postura adecuada y lenguaje corporal natural que complementan la declamación; movimientos precisos y expresivos.',3:'Postura correcta y lenguaje corporal funcional, aunque limitado en expresividad.',2:'Postura aceptable, pero lenguaje corporal rígido o poco relacionado con el mensaje del poema.',1:'Postura descuidada o lenguaje corporal inexistente o disruptivo.'},
 estilo:{4:'Presenta un estilo único y creativo que enriquece la declamación, manteniendo la esencia del poema.',3:'Muestra creatividad y estilo propio, aunque no se destacan ampliamente.',2:'Poco estilo personal o creatividad limitada; se apega únicamente a lo literal del poema.',1:'No hay estilo personal ni creatividad; declamación plana o mecanizada.'}
};
let dash=null,busy=false;
const scoreRubric=r=>r&&criteria.every(([k])=>Number(r[k])>=1&&Number(r[k])<=4)?criteria.reduce((a,[k])=>a+Number(r[k]),0)/20*10:null;
function trimmed(values){const a=values.filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return null;const b=a.length>=5?a.slice(1,-1):a;return b.reduce((x,y)=>x+y,0)/b.length}
function peerStats(p){const valid=(p.peer_scores||[]).filter(x=>x.valid!==false);const by={};for(const [k] of criteria)by[k]=trimmed(valid.map(x=>Number(x.rubric?.[k])));const overall=trimmed(valid.map(x=>scoreRubric(x.rubric)));return {count:valid.length,overall,by}}
function finalCalc(p){if(p.presentation_status==='absent')return 0;const t=Number(p.teacher_score),self=Number(p.self_eval?.score),peer=peerStats(p).overall;if(!Number.isFinite(t)||!Number.isFinite(self)||!Number.isFinite(peer))return null;const raw=t*.8+self*.1+peer*.1;const hasManual=p.final_manual_score!==null&&p.final_manual_score!==undefined&&p.final_manual_score!=='';return hasManual?Number(p.final_manual_score):Math.round(raw*100)/100}
function rubricInputs(p){const r=p.teacher||{};return criteria.map(([k,l])=>'<label>'+esc(l)+'<select data-rubric="'+k+'"><option value="">—</option>'+[4,3,2,1].map(n=>'<option value="'+n+'" '+(Number(r[k])===n?'selected':'')+'>'+n+' · '+esc(teacherDesc[k][n])+'</option>').join('')+'</select></label>').join('')}
function ensure(){
 if(q('poemEvaluationPanel'))return q('poemEvaluationPanel');
 const sec=q('poem-contest');if(!sec)return null;
 const panel=document.createElement('div');panel.id='poemEvaluationPanel';panel.className='card';
 panel.innerHTML='<div class="section"><div><h2>Evaluación de presentaciones</h2><p class="hint">Profesor 80% · Autoevaluación 10% · Coevaluación 10%</p></div><div class="actions"><button id="poemGenerateFeedback" class="primary" type="button">Generar retroalimentaciones del grupo</button><button id="poemEvalRefresh" class="secondary">Actualizar evaluación</button></div></div><div class="grid2"><label>Grupo<select id="poemEvalGroup"><option>1C</option><option>3A</option><option>3B</option><option>3C</option></select></label><div><b>Formulario para alumnos</b><p><a id="poemEvalLink" href="'+LINK+'" target="_blank" rel="noopener">'+LINK+'</a></p><button id="poemCopyLink" class="secondary" type="button">Copiar enlace</button></div></div><div style="margin-top:12px"><img id="poemEvalQr" alt="QR del formulario" style="width:180px;max-width:100%;border:1px solid #ddd;border-radius:12px" src="https://api.qrserver.com/v1/create-qr-code/?size=360x360&data='+encodeURIComponent(LINK)+'"><p class="hint">Matrícula de demostración del profesor: <b>0001</b></p></div><div id="poemEvalSessions"></div><label style="display:block;margin:12px 0">Día del rol<select id="poemEvalDate"></select></label><div id="poemEvalStudents"></div><p id="poemEvalStatus" class="hint"></p>';
 sec.appendChild(panel);
 q('poemEvalDate').onchange=renderStudents;q('poemEvalRefresh').onclick=load;q('poemEvalGroup').onchange=load;q('poemCopyLink').onclick=()=>navigator.clipboard?.writeText(LINK);q('poemGenerateFeedback').onclick=generateFeedback;
 return panel;
}
async function load(){if(busy)return;ensure();busy=true;q('poemEvalStatus').textContent='Cargando evaluaciones…';try{dash=await ProfeSupabase.rpc('teacher_poem_eval_dashboard',{p_group:q('poemEvalGroup').value});render();q('poemEvalStatus').textContent='Evaluación actualizada.'}catch(e){q('poemEvalStatus').textContent='No se pudo cargar: '+(e.message||e)}finally{busy=false}}
function render(){renderSessions();const sel=q('poemEvalDate'),prev=sel.value,dates=[...new Set((dash.sessions||[]).map(x=>x.date))].sort(),today=new Date().toLocaleDateString('en-CA');sel.innerHTML='<option value="">Todos los días</option>'+dates.map(d=>'<option value="'+esc(d)+'">'+esc(d)+'</option>').join('');sel.value=dates.includes(prev)?prev:(dates.includes(today)?today:(dates[0]||''));renderStudents()}
function localDT(v){if(!v)return '';const d=new Date(v),pad=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+'T'+pad(d.getHours())+':'+pad(d.getMinutes())}
function renderSessions(){const box=q('poemEvalSessions');box.innerHTML='<h3>Jornadas y periodos</h3>'+(dash.sessions||[]).map(s=>'<div class="row" style="align-items:end"><div><b>'+esc(s.date)+' · '+esc(String(s.start).slice(0,5))+'–'+esc(String(s.end).slice(0,5))+'</b><small>Apertura y cierre del formulario</small></div><label>Apertura<input type="datetime-local" data-open="'+esc(s.id)+'" value="'+localDT(s.opens_at)+'"></label><label>Cierre<input type="datetime-local" data-close="'+esc(s.id)+'" value="'+localDT(s.closes_at)+'"></label><button class="secondary" data-save-window="'+esc(s.id)+'">Guardar horario</button></div>').join('');
 box.querySelectorAll('[data-save-window]').forEach(b=>b.onclick=async()=>{const id=b.dataset.saveWindow,op=document.querySelector('[data-open="'+id+'"]').value,cl=document.querySelector('[data-close="'+id+'"]').value;if(!op||!cl)return;await ProfeSupabase.rpc('teacher_poem_set_window',{p_session_id:id,p_opens_at:new Date(op).toISOString(),p_closes_at:new Date(cl).toISOString()});await load()})
}
function renderStudents(){
 const box=q('poemEvalStudents'),sessions=new Map((dash.sessions||[]).map(x=>[x.id,x]));
 const chosen=q('poemEvalDate')?.value||'';const presenters=(dash.presenters||[]).filter(p=>!chosen||sessions.get(p.session_id)?.date===chosen);box.innerHTML='<h3>Alumnos del rol'+(chosen?' · '+esc(chosen):'')+' · '+presenters.length+'</h3><p class="hint">Selecciona al alumno. Marca «Presentó» para habilitar la rúbrica y guardar su calificación.</p>'+(presenters||[]).map((p,i)=>{
  const ps=peerStats(p),fin=finalCalc(p),ses=sessions.get(p.session_id),status=p.presentation_status|| (p.presented?'presented':'pending');
  const statusLabel=status==='presented'?'Presentó':status==='absent'?'No presentó':'Pendiente';
  const statusTone=status==='presented'?'#176b35':status==='absent'?'#9b1c31':'#6b7280';
  const controls='<div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0">'+
    '<button type="button" class="'+(status==='presented'?'primary':'secondary')+'" data-status="presented">Presentó</button>'+
    '<button type="button" class="'+(status==='absent'?'primary':'secondary')+'" data-status="absent">No presentó</button>'+
    '<button type="button" class="'+(status==='pending'?'primary':'secondary')+'" data-status="pending">Pendiente</button>'+
  '</div>';
  let body='';
  if(status==='absent'){
    body='<div class="message bad" style="margin-top:10px"><b>No presentó.</b> La calificación de esta presentación es 0 y el alumno no aparece en el formulario de coevaluación ni tiene autoevaluación habilitada.</div>';
  }else if(status==='pending'){
    body='<div class="hint" style="margin-top:10px">Este alumno está programado para este día. Pulsa «Presentó» para mostrar los cinco criterios de la rúbrica del profesor y registrar la calificación.</div>';
  }else{
    body='<h4>Evaluación del profesor</h4><div class="grid2">'+rubricInputs(p)+'</div>'+
    '<button class="primary" data-save-teacher>Guardar rúbrica del profesor</button>'+
    '<p class="hint">Resultado profesor: '+(p.teacher_score!==null&&p.teacher_score!==undefined?Number(p.teacher_score).toFixed(2):'—')+'</p>'+
    '<h4>Autoevaluación</h4><p>'+(p.self_eval?'Resultado: <b>'+Number(p.self_eval.score).toFixed(2)+'</b><br>Hice mejor: '+esc(p.self_eval.best||'—')+'<br>Necesito mejorar: '+esc(p.self_eval.improve||'—'):'Pendiente')+'</p>'+
    '<h4>Coevaluación</h4><p>'+ps.count+' recibidas · promedio robusto: <b>'+(ps.overall==null?'—':ps.overall.toFixed(2))+'</b></p>'+
    '<div class="grid2">'+criteria.map(([k,l])=>'<div><small>'+l+'</small><b style="display:block">'+(ps.by[k]==null?'—':ps.by[k].toFixed(2))+' / 4</b></div>').join('')+'</div>'+
    '<details><summary>Ver quién evaluó y respuestas</summary>'+(p.peer_scores||[]).map(e=>'<div class="row"><div><b>'+esc(e.evaluator_name)+'</b><small>'+new Date(e.submitted_at).toLocaleString('es-MX')+' · '+Number(e.score).toFixed(2)+'</small></div><button class="secondary" data-invalidate="'+e.id+'" data-valid="'+(e.valid!==false)+'">'+(e.valid===false?'Revalidar':'Invalidar')+'</button></div>').join('')+'</details>'+
    '<h4>Calificación final</h4><p>Calculada: <b>'+(fin==null?'Pendiente':fin.toFixed(2))+'</b></p>'+
    '<div class="grid2"><label>Ajuste manual final<input type="number" min="0" max="10" step="0.1" data-final-score value="'+(p.final_manual_score??'')+'"></label><label>Motivo del ajuste<input data-final-reason value="'+esc(p.final_manual_reason||'')+'"></label></div>'+
    '<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" data-close-final '+(p.closed?'checked':'')+'> Cerrar calificación</label>'+
    '<button class="secondary" data-save-final>Guardar ajuste/cierre</button>'+
    '<div class="card" style="margin-top:10px"><b>Retroalimentación</b><p>'+(p.feedback?.text?esc(p.feedback.text):'Pendiente de generar al terminar el grupo.')+'</p></div>';
  }
  return '<details class="card" data-poem-eval="'+i+'"><summary><b>'+esc(p.number)+'. '+esc(p.name)+'</b> · '+esc(p.poem)+' · '+esc(ses?.date||'')+' · <span style="color:'+statusTone+'">'+statusLabel+'</span> · '+(fin==null?'Sin calificación':('Final '+fin.toFixed(2)))+'</summary><div style="margin-top:12px">'+controls+body+'</div></details>';
 }).join('');

 box.querySelectorAll('[data-poem-eval]').forEach(d=>{
  const p=presenters[Number(d.dataset.poemEval)];
  d.querySelectorAll('[data-status]').forEach(b=>b.onclick=async()=>{
    const status=b.dataset.status;
    if(status==='absent'&&!confirm('¿Marcar a '+p.name+' como NO PRESENTÓ? Su calificación quedará en 0 y dejará de aparecer para los alumnos.'))return;
    await ProfeSupabase.rpc('teacher_poem_set_presentation_status',{p_session_id:p.session_id,p_student_id:p.student_id,p_status:status});
    await load();
  });
  const saveTeacher=d.querySelector('[data-save-teacher]');
  if(saveTeacher)saveTeacher.onclick=async()=>{
    const r={};for(const [k] of criteria){const v=Number(d.querySelector('[data-rubric="'+k+'"]').value);if(!v)return alert('Completa los cinco criterios.');r[k]=v}
    await ProfeSupabase.rpc('teacher_poem_save_teacher_eval',{p_session_id:p.session_id,p_student_id:p.student_id,p_rubric:r,p_manual_score:null,p_manual_reason:null,p_closed:p.closed});await load()
  };
  const saveFinal=d.querySelector('[data-save-final]');
  if(saveFinal)saveFinal.onclick=async()=>{
    const raw=d.querySelector('[data-final-score]').value,score=raw===''?null:Number(raw),reason=d.querySelector('[data-final-reason]').value,closed=d.querySelector('[data-close-final]').checked;
    await ProfeSupabase.rpc('teacher_poem_set_final_adjustment',{p_session_id:p.session_id,p_student_id:p.student_id,p_score:score,p_reason:reason,p_closed:closed});await load()
  };
  d.querySelectorAll('[data-invalidate]').forEach(b=>b.onclick=async()=>{await ProfeSupabase.rpc('teacher_poem_invalidate_eval',{p_id:b.dataset.invalidate,p_valid:b.dataset.valid!=='true'});await load()})
 })
}
function fallbackText(p){
 const final=finalCalc(p),r=p.teacher||{};const vals=criteria.map(([k,l])=>({k,l,v:Number(r[k])})).filter(x=>Number.isFinite(x.v));vals.sort((a,b)=>b.v-a.v);const best=vals[0]?.l||'presentación oral',low=vals[vals.length-1]?.l||'expresión oral';return 'Obtuviste una calificación final de '+(final??0).toFixed(1)+'. Una de tus principales fortalezas fue '+best.toLowerCase()+'. El aspecto que requiere mayor trabajo es '+low.toLowerCase()+'. Para una próxima presentación, practica el poema en voz alta y concentra tus ensayos específicamente en ese criterio.';
}
async function generateFeedback(){
 if(!dash||busy)return;const group=q('poemEvalGroup').value,rows=(dash.presenters||[]).map(p=>{if(p.presentation_status!=='presented')return null;const final=finalCalc(p),ps=peerStats(p);if(final==null)return null;return {student_id:p.student_id,name:p.name,final_score:final,teacher:{score:p.teacher_score,rubric:p.teacher},self:p.self_eval?{score:p.self_eval.score,rubric:p.self_eval.rubric,best:p.self_eval.best,improve:p.self_eval.improve}:null,peer:{score:ps.overall,criteria:ps.by,count:ps.count}}}).filter(Boolean);
 if(!rows.length)return alert('Todavía no hay alumnos con las tres fuentes completas.');
 const btn=q('poemGenerateFeedback');btn.disabled=true;btn.textContent='Generando con Gemini…';q('poemEvalStatus').textContent='Generando una sola solicitud para el grupo…';
 try{
  const out=await ProfeSupabase.edge('poem-feedback',{group,students:rows});
  if(!Array.isArray(out?.feedback))throw Error(out?.message||'Gemini no devolvió retroalimentaciones.');
  for(const fb of out.feedback){
   const p=(dash.presenters||[]).find(x=>x.student_id===fb.student_id);if(!p)continue;
   const final=finalCalc(p);
   await ProfeSupabase.upsert('poem_feedback',[{session_id:p.session_id,student_id:p.student_id,final_score:final,generated_text:fb.text,generated_source:'gemini',generated_at:new Date().toISOString(),updated_at:new Date().toISOString()}],'session_id,student_id');
  }
  q('poemEvalStatus').textContent='Retroalimentaciones del grupo generadas y guardadas.';await load();
 }catch(e){for(const p of (dash.presenters||[])){const final=finalCalc(p);if(final==null)continue;await ProfeSupabase.upsert('poem_feedback',[{session_id:p.session_id,student_id:p.student_id,final_score:final,generated_text:fallbackText(p),generated_source:'rules',generated_at:new Date().toISOString(),updated_at:new Date().toISOString()}],'session_id,student_id')}q('poemEvalStatus').textContent='Gemini no estuvo disponible; se guardó retroalimentación automática de respaldo.';await load()}
 finally{btn.disabled=false;btn.textContent='Generar retroalimentaciones del grupo'}
}
function hook(){ensure();document.querySelector('[data-view="poem-contest"]')?.addEventListener('click',()=>setTimeout(load,120));}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',hook);else hook();
})();