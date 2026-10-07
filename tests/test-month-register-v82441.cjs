const {JSDOM}=require('jsdom'),fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const groups=['22','23','24','25','26'];
const dom=new JSDOM(['act','grid'].map(p=>`<div class="card"><select id="${p}Shift"><option>Matutino</option></select><select id="${p}Group">${groups.map(g=>`<option>${g}</option>`).join('')}</select><select id="${p}Week"></select></div>`).join('')+'<select id="actSelect"></select>'+['actScan','actRegister','actClose','actReopen'].map(id=>`<button id="${id}"></button>`).join('')+'<div id="actMultiChoices"></div><select id="calcMethodology"><option value="oct">Oct</option><option value="sep">Sep</option></select><div id="methodologyAssignments"></div>',{runScripts:'outside-only'});
const w=dom.window,ctx=dom.getInternalVMContext();
const acts=[
 ...['Dictado','Repeticiones','Otra semana'].map((name,i)=>({id:'a'+i,name,group:'22',groups,shift:'Matutino',date:['2026-10-05','2026-10-06','2026-10-13'][i],week:['5–9 oct','5–9 oct','12–16 oct'][i],evaluationMode:'delivery',evaluationPeriod:'2026-10'})),
 {id:'exam',name:'Examen mensual (septiembre)',group:'22',groups,shift:'Matutino',date:'2026-10-01',type:'Examen',evaluationMode:'numeric',evaluationPeriod:'2026-09'},
 {id:'late',name:'Entrega septiembre',group:'22',groups,shift:'Matutino',date:'2026-09-25',evaluationMode:'delivery',timestamp:'2026-10-07T12:00:00Z'},
 {id:'fallback',name:'Examen sin etiqueta',group:'22',groups,shift:'Matutino',date:'2026-10-01',type:'Examen',evaluationMode:'numeric'},
 {id:'other',name:'Otro grupo',group:'11',shift:'Matutino',date:'2026-10-05',evaluationMode:'delivery'}
];
const methods=[{id:'oct',group:'22',shift:'Matutino',month:'Octubre',cycle:'2026-2027',assignments:{a0:'c',a1:'c'},gradeRecords:{}},{id:'sep',group:'22',shift:'Matutino',month:'Septiembre',cycle:'2026-2027',assignments:{exam:'e',fallback:'e',late:'a'},gradeRecords:{s:{pointsUsed:4,base:6}}}];
let calls=0,gridCalls=0,mode='single';const cache={activities:new Map(),methodologies:new Map()};
Object.assign(w,{$:s=>w.document.querySelector(s),db:true,safe:s=>String(s),sameGroup:(a,b)=>a===b,sameShift:(a,b)=>a===b,activityMatchesGroup:(a,g)=>[a.group,...(a.groups||[])].includes(g),activitySort:(a,b)=>a.date.localeCompare(b.date),req:async x=>x,store:n=>({put:v=>cache[n].set(v.id,v),get:id=>cache[n].get(id)}),all:async n=>[...cache[n].values()],activityScanMode:()=>mode,refreshActivityStats:async()=>{},renderActivityGrid:async()=>gridCalls++,refreshActivitySelectors:async()=>{},refreshGridWeeks:async()=>{},currentDeliveryActivities:async()=>[],currentWeekActivities:async()=>[],renderMethodologyAssignments:async()=>{
 w.document.getElementById('methodologyAssignments').innerHTML=acts.filter(a=>a.group==='22').map(a=>`<div class="assignment-row"><select data-assignment="${a.id}"></select></div>`).join('');
},refreshCalculationMethodologies:async()=>{},renderMethodologies:async()=>{},renderActivities:async()=>{},renderActivityMultiChoices:async()=>{w.document.getElementById('actMultiChoices').innerHTML=(await w.currentDeliveryActivities()).map(a=>`<input value="${a.id}">`).join('')},ProfeSupabase:{select:async n=>{calls++;return n==='activities'?acts.map(a=>({id:a.id,title:a.name,group_name:a.group,shift:a.shift,activity_date:a.date,evaluation_type:a.evaluationMode,data:a})):methods.map(m=>({id:m.id,group_name:m.group,shift:m.shift,month:m.month,cycle:m.cycle,quarter:1,data:m}))}}});
vm.runInContext(fs.readFileSync('activity-month-register-v82441.js','utf8'),ctx);
(async()=>{
 for(const group of groups){
  for(const p of ['act','grid'])w.document.getElementById(p+'Group').value=group;
  await w.refreshActivitySelectors();await w.refreshGridWeeks();
  w.document.getElementById('actWeek').value='2026-10';await w.refreshActivitySelectors();
  assert.equal(w.document.getElementById('actSelect').options.length,3);
  w.document.getElementById('gridWeek').value='2026-10';assert.equal((await w.currentWeekActivities()).length,3);
  w.document.getElementById('actWeek').value='2026-09';await w.refreshActivitySelectors();
  assert.equal(w.document.getElementById('actSelect').options.length,3);assert.match(w.document.getElementById('actSelect').textContent,/Examen mensual/);
  mode='multi';await w.refreshActivitySelectors();assert.equal(w.document.querySelectorAll('#actMultiChoices input').length,1);
  mode='single';
 }
 assert.equal(calls,2,'one deduplicated server snapshot');
 await w.renderMethodologyAssignments();assert.deepEqual([...w.document.querySelectorAll('[data-assignment]')].map(el=>el.dataset.assignment),['a0','a1','a2']);
 w.document.getElementById('calcMethodology').value='sep';await w.renderMethodologyAssignments();assert.deepEqual([...w.document.querySelectorAll('[data-assignment]')].map(el=>el.dataset.assignment),['exam','late','fallback']);
 assert.equal(cache.methodologies.get('sep').gradeRecords.s.pointsUsed,4);
 w.document.getElementById('actGroup').value='22';w.document.getElementById('actWeek').value='2026-10';w.document.getElementById('actWeek').dispatchEvent(new w.Event('change'));await new Promise(r=>setImmediate(r));assert.equal(w.document.getElementById('actSelect').options.length,3);
 console.log('PASS all five groups, all weeks per month, numeric exams, late deliveries, September exam exemption, monthly assignments, preserved grades/points, current DOM handlers, read-only server cache.');w.close();
})().catch(e=>{console.error(e);process.exitCode=1;w.close()});
