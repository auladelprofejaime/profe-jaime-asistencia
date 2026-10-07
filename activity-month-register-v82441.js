/* Evaluation months, independent of capture date and delivery week. */
(()=>{
'use strict';
const months=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const q=id=>document.getElementById(id);
let inflight=null,lastRead=0,methods=[],activities=[],actTicket=0,gridTicket=0;
function methodPeriod(m){
 const index=months.findIndex(n=>n.toLowerCase()===String(m.month||'').toLowerCase());
 const start=Number(String(m.cycle||'').slice(0,4));
 return index<0||!start?'':String(index<7?start+1:start)+'-'+String(index+1).padStart(2,'0');
}
function activityPeriod(a){
 if(/^\d{4}-\d{2}$/.test(a.evaluationPeriod||''))return a.evaluationPeriod;
 const assigned=methods.find(m=>m.assignments?.[a.id]&&sameShift(m.shift,a.shift)&&activityMatchesGroup(a,m.group));
 return (assigned&&methodPeriod(assigned))||String(a.date||'').slice(0,7);
}
function label(period){const [year,month]=period.split('-');return (months[Number(month)-1]||'Sin mes')+' '+year}
function hint(prefix,message){
 let el=q(prefix+'MonthHelp');if(!el){el=document.createElement('p');el.id=prefix+'MonthHelp';el.className='hint';q(prefix+'Week')?.closest('.card')?.after(el)}
 el.textContent=message;
}
async function pull(force=false){
 if(inflight)return inflight;
 if(!force&&Date.now()-lastRead<30000)return;
 inflight=(async()=>{
  if(!window.ProfeSupabase)throw Error('Conecta con el servidor para consultar los meses.');
  const [aa,mm]=await Promise.all([
   ProfeSupabase.select('activities','select=*&order=activity_date.desc'),
   ProfeSupabase.select('methodologies','select=*&order=created_at.desc')
  ]);
  if(!Array.isArray(aa)||!Array.isArray(mm))throw Error('El servidor no devolvió las evaluaciones.');
  if(typeof ensureDB==='function')await ensureDB();
  activities=aa.map(r=>({...r.data,id:r.id,name:r.title??r.data?.name,date:r.activity_date??r.data?.date,dueDate:r.due_date??r.data?.dueDate,group:r.group_name,shift:r.shift,evaluationMode:r.evaluation_type||r.data?.evaluationMode||'delivery',closed:!!r.closed}));
  methods=mm.map(r=>({...r.data,id:r.id,group:r.group_name,shift:r.shift,month:r.month,cycle:r.cycle,quarter:r.quarter,closed:!!r.closed}));
  // Cache reads only. Do not enqueue writes or recalculate any saved grades.
  for(const a of activities)await req(store('activities','readwrite').put(a));
  for(const m of methods)await req(store('methodologies','readwrite').put(m));
  lastRead=Date.now();
 })();
 try{await inflight}finally{inflight=null}
}
async function scoped(prefix){
 const shift=q(prefix+'Shift').value,group=q(prefix+'Group').value;
 // Server cache is authoritative; no stale deleted activities in selectors.
 return activities.filter(a=>sameShift(a.shift,shift)&&activityMatchesGroup(a,group));
}
function chooseMonth(prefix,acts){
 const el=q(prefix+'Week'),old=el.value,periods=[...new Set(acts.map(activityPeriod).filter(p=>/^\d{4}-\d{2}$/.test(p)))].sort().reverse();
 const current=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Mexico_City',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()).slice(0,7);
 el.innerHTML=periods.length?periods.map(p=>'<option value="'+p+'">'+safe(label(p))+'</option>').join(''):'<option value="">Sin actividades</option>';
 if(periods.includes(old))el.value=old;else if(periods.includes(current))el.value=current;
 hint(prefix,'Se muestran todas las actividades del mes. Una entrega atrasada conserva su mes de evaluación; selecciona el mes original para registrarla.');
 return acts.filter(a=>activityPeriod(a)===el.value).sort(activitySort);
}
refreshActivitySelectors=async function(){
 if(!db||!q('actWeek'))return;
 const ticket=++actTicket;
 try{await pull()}catch(e){hint('act','No se pudo consultar el servidor: '+e.message);return}
 if(ticket!==actTicket)return;
 const aa=chooseMonth('act',await scoped('act')).filter(a=>(a.evaluationMode||'delivery')==='delivery'||((a.evaluationMode||'delivery')==='numeric'&&String(a.type||'').toLowerCase()==='examen'));
 const sel=q('actSelect'),old=sel.value;
 sel.innerHTML=aa.length?aa.map(a=>'<option value="'+safe(a.id)+'">'+safe(a.name)+' · '+safe(a.date||'')+((a.evaluationMode||'delivery')==='numeric'?' · Calificar':'')+'</option>').join(''):'<option value="">Sin actividades para escáner en este mes</option>';
 if(aa.some(a=>a.id===old))sel.value=old;
 for(const id of ['actScan','actRegister','actClose','actReopen'])if(q(id))q(id).disabled=!aa.length;
 if(activityScanMode()==='multi')await renderActivityMultiChoices();else await refreshActivityStats();
};
refreshGridWeeks=async function(){
 if(!db||!q('gridWeek'))return;
 const ticket=++gridTicket;
 try{await pull()}catch(e){hint('grid','No se pudo consultar el servidor: '+e.message);return}
 if(ticket!==gridTicket)return;
 chooseMonth('grid',await scoped('grid'));await renderActivityGrid();
};
currentDeliveryActivities=async function(){return (await scoped('act')).filter(a=>activityPeriod(a)===q('actWeek').value&&(a.evaluationMode||'delivery')==='delivery').sort(activitySort)};
currentWeekActivities=async function(){return (await scoped('grid')).filter(a=>activityPeriod(a)===q('gridWeek').value).sort(activitySort)};
const originalChoices=renderActivityMultiChoices;
renderActivityMultiChoices=async function(){const result=await originalChoices.apply(this,arguments);const box=q('actMultiChoices');if(box&&!box.querySelector('input'))box.textContent=box.textContent.replace(/esta semana/g,'este mes');return result};
const originalAssignments=renderMethodologyAssignments;
renderMethodologyAssignments=async function(){
 try{await pull()}catch(e){console.warn(e.message)}const id=q('calcMethodology')?.value;
 await originalAssignments.apply(this,arguments);
 if(q('calcMethodology')?.value!==id)return;
 const m=await req(store('methodologies').get(id));if(!m)return;
 const period=methodPeriod(m),byId=new Map(activities.map(a=>[a.id,a]));
 q('methodologyAssignments')?.querySelectorAll('[data-assignment]').forEach(el=>{
  const a=byId.get(el.dataset.assignment);
  // Keep any explicit legacy assignment, so saving cannot discard it.
  if(a&&activityPeriod(a)!==period&&!m.assignments?.[a.id])el.closest('.assignment-row')?.remove();
 });
 let note=q('methodologyPeriodHelp');if(!note){note=document.createElement('p');note.id='methodologyPeriodHelp';note.className='hint';q('methodologyAssignments')?.before(note)}
 note.textContent='Evaluación de '+label(period)+'. Las entregas tardías no cambian de mes. Guarda las asignaciones antes de calcular.';
};
const originalCalculationSelectors=refreshCalculationMethodologies;
refreshCalculationMethodologies=async function(){try{await pull()}catch(e){console.warn(e.message)}return originalCalculationSelectors.apply(this,arguments)};
const originalMethods=renderMethodologies;
renderMethodologies=async function(){try{await pull()}catch(e){console.warn(e.message)}return originalMethods.apply(this,arguments)};
// Creation/edit already reads the server before listing. Invalidate this cache too.
const originalActivities=renderActivities;
renderActivities=async function(){lastRead=0;const result=await originalActivities.apply(this,arguments);await pull(true);return result};
function bind(){
 for(const id of ['actShift','gridShift','calcMetShift']){
  const prefix=id.replace('Shift',''),el=q(id);if(el)el.onchange=()=>fillGroups(prefix).catch(console.error);
 }
 for(const id of ['actGroup','actWeek'])if(q(id))q(id).onchange=()=>refreshActivitySelectors().catch(console.error);
 for(const id of ['gridGroup','gridWeek'])if(q(id))q(id).onchange=()=>refreshGridWeeks().catch(console.error);
 if(q('calcMetGroup'))q('calcMetGroup').onchange=()=>refreshCalculationMethodologies().catch(console.error);
 if(q('calcMethodology'))q('calcMethodology').onchange=()=>renderMethodologyAssignments().catch(console.error);
}
bind();window.addEventListener('load',bind);
})();
