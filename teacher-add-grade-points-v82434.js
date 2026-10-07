/* Apply only new points; refunds remain a separate explicit operation. */
openUsePointsDialog=async function(studentId){
 try{
  const methodId=document.getElementById('calcMethodology')?.value;
  const ps=(await ProfeSupabase.rpc('teacher_point_periods')).filter(p=>p.methodology_id===methodId&&!p.closed_at);
  const period=ps.find(p=>Date.now()>=Date.parse(p.opens_at)&&Date.now()<Date.parse(p.closes_at))||ps[0];
  if(!period)throw Error('No hay un periodo de puntos para este mes.');
  const detail=await ProfeSupabase.rpc('teacher_point_period_activity',{p_period_id:period.id});
  if(detail.teacher_can_operate!==true)throw Error('El mes o periodo está cerrado definitivamente. Reábrelo antes de modificar puntos.');
  const student=detail.students.find(s=>s.student_id===studentId),grade=detail.grade_records[studentId]||{};
  if(!student||grade.base==null)throw Error('Falta la calificación provisional.');
  const used=Number(grade.pointsUsed||0),available=Math.max(0,Math.min(Number(student.balance||0),10-Number(grade.base)-Number(grade.manualExtra||0)-used));
  showDialog('Sumar puntos a la calificación','<p>'+safe(student.student_name)+' · Ya aplicados: <b>'+used.toFixed(2)+'</b> · Puedes sumar: <b>'+available.toFixed(2)+'</b></p><label>Puntos adicionales<input id="pointsAmountInput" type="number" min="0.01" max="'+available+'" step="0.01" value="'+available.toFixed(2)+'"></label><button id="applyPointsBtn" type="button">Sumar puntos</button><button id="cancelPointsBtn" type="button">Cancelar</button><p id="gradeAddStatus"></p>');
  document.getElementById('cancelPointsBtn').onclick=()=>document.getElementById('dialog').close();
  document.getElementById('applyPointsBtn').onclick=async function(){
   const amount=Number(document.getElementById('pointsAmountInput').value);
   if(!Number.isFinite(amount)||amount<=0||amount>available)return alert('Revisa los puntos disponibles.');
   const payload={p_student_id:studentId,p_period_id:period.id,p_amount:amount},fingerprint=JSON.stringify(payload),key='teacherPendingGradeAdd';
   let request;try{request=JSON.parse(sessionStorage.getItem(key)||'null')}catch(_){}
   if(!request||request.fingerprint!==fingerprint){request={fingerprint,id:crypto.randomUUID()};sessionStorage.setItem(key,JSON.stringify(request));}
   this.disabled=true;
   try{const r=await ProfeSupabase.rpc('teacher_add_grade_points',{...payload,p_request_id:request.id});if(!r?.ok)throw Error('Sin confirmación del servidor.');
    sessionStorage.removeItem(key);document.getElementById('dialog').close();await renderMethodologyAssignments();
   }catch(e){document.getElementById('gradeAddStatus').textContent=e.message;this.disabled=false;}
  };
 }catch(e){alert(e.message||e)}
};
