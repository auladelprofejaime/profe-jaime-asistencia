const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
let meritPeriodsCache=[];

function meritPane(name){
 $$(".meritNav").forEach(b=>b.classList.toggle("active",b.dataset.meritPane===name));
 $$(".merit-pane").forEach(p=>p.classList.toggle("active",p.id==="merit-"+name));
}
async function rpc(name,args={}){return await window.ProfeSupabase.rpc(name,args)}

function fillSelect(id,rows){
 const el=$("#"+id); if(!el)return;
 const old=el.value;
 el.innerHTML=rows.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.label)+' · '+esc(p.status)+'</option>').join("");
 if(rows.some(p=>String(p.id)===String(old)))el.value=old;
}
async function loadMeritPeriods(){
 const rows=await rpc("teacher_merit_periods",{});
 meritPeriodsCache=Array.isArray(rows)?rows:[];
 ["meritRankingPeriod","meritMovementPeriod","meritWeeklyPeriod","meritMonthlyPeriod"].forEach(id=>fillSelect(id,meritPeriodsCache));
 renderPeriodList(meritPeriodsCache);
 return meritPeriodsCache;
}
window.loadMeritPeriods=loadMeritPeriods;

function renderPeriodList(rows){
 const box=$("#meritPeriodsList");if(!box)return;
 box.innerHTML=rows.length?'<table><thead><tr><th>Periodo</th><th>Fechas</th><th>Estado</th><th>Portal</th><th>Acciones</th></tr></thead><tbody>'+
 rows.map(p=>'<tr><td><b>'+esc(p.label)+'</b><br><small>'+esc(p.school_year||"")+'</small></td><td>'+esc(p.starts_at)+' → '+esc(p.ends_at)+'</td><td>'+esc(p.status)+'</td><td>'+esc(p.public_state||"")+'</td><td><button type="button" class="secondary periodEdit" data-id="'+esc(p.id)+'">Editar</button> '+((p.status!=="closed"&&p.status!=="published")?'<button type="button" class="secondary periodDelete" data-id="'+esc(p.id)+'" data-label="'+esc(p.label)+'">Eliminar</button>':"")+'</td></tr>').join("")+
 '</tbody></table>':'<p class="hint">Aún no hay periodos.</p>';
 $$(".periodEdit").forEach(b=>b.onclick=()=>openMeritPeriodEdit(b.dataset.id));
 $$(".periodDelete").forEach(b=>b.onclick=()=>deleteMeritPeriodV8164(b.dataset.id,b.dataset.label));
}
async function saveMeritPeriod(e){
 e?.preventDefault();
 const st=$("#meritConfigStatus");
 const args={
  p_school_year:$("#meritSchoolYear").value.trim(),
  p_month_number:Number($("#meritMonthNumber").value),
  p_label:$("#meritPeriodLabel").value.trim(),
  p_starts_at:$("#meritPeriodStart").value,
  p_ends_at:$("#meritPeriodEnd").value,
  p_status:"open"
 };
 try{
  const d=await rpc("teacher_merit_save_period",args);
  if(d?.ok===false)throw new Error(d.reason||"No se pudo guardar.");
  st.innerHTML='<span class="success">✓ Periodo guardado.</span>';
  await loadMeritPeriods();
 }catch(err){st.textContent="No se pudo guardar: "+(err.message||err)}
}
function openMeritPeriodEdit(id){
 const p=meritPeriodsCache.find(x=>String(x.id)===String(id)); if(!p)return;
 $("#meritEditPeriodId").value=p.id;$("#meritEditPeriodCycle").value=p.school_year||"";
 $("#meritEditPeriodMonth").value=p.month_number||"";$("#meritEditPeriodLabel").value=p.label||"";
 $("#meritEditPeriodStart").value=p.starts_at||"";$("#meritEditPeriodEnd").value=p.ends_at||"";
 $("#meritEditPeriodStatus").textContent="";$("#meritEditPeriodDialog").showModal();
}
window.openMeritPeriodEdit=openMeritPeriodEdit;window.meritOpenPeriodEditV8151=openMeritPeriodEdit;
async function saveMeritPeriodEdit(){
 const st=$("#meritEditPeriodStatus");
 try{
  const p=meritPeriodsCache.find(x=>String(x.id)===String($("#meritEditPeriodId").value));
  if(!p)throw new Error("No se encontró el periodo.");
  const d=await rpc("teacher_merit_save_period",{
   p_school_year:p.school_year,p_month_number:Number(p.month_number),p_label:$("#meritEditPeriodLabel").value.trim(),
   p_starts_at:$("#meritEditPeriodStart").value,p_ends_at:$("#meritEditPeriodEnd").value,p_status:p.status
  });
  if(d?.ok===false)throw new Error(d.reason||"No se pudo guardar.");
  $("#meritEditPeriodDialog").close();await loadMeritPeriods();
 }catch(e){st.textContent="No se pudo guardar: "+(e.message||e)}
}
async function deleteMeritPeriodV8164(id,label){
 const typed=prompt('Para eliminar el periodo escribe exactamente: '+label,"");
 if(typed!==label)return;
 try{
  const d=await rpc("teacher_merit_delete_period",{p_period_id:id,p_confirm_label:label});
  if(!d?.ok)throw new Error(d?.reason||"No se pudo eliminar.");
  await loadMeritPeriods();
 }catch(e){alert("No se pudo eliminar el periodo: "+(e.message||e))}
}
window.deleteMeritPeriodV8164=deleteMeritPeriodV8164;

async function loadMeritStaff(){
 const box=$("#meritStaffList");if(!box)return;
 box.innerHTML='<p class="hint">Cargando personal…</p>';
 try{
  const rows=await rpc("teacher_merit_staff",{});
  const data=Array.isArray(rows)?rows:[];
  window.meritStaffBaseCache=data;
  box.innerHTML='<table><thead><tr><th>Personal</th><th>Función</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>'+
   data.map(s=>'<tr><td><b>'+esc(s.display_name||"Pendiente de completar")+'</b><div class="hint">ID '+esc(s.staff_code||"—")+'</div></td><td>'+esc(s.subject_area||s.role_type||"—")+'</td><td>'+(s.active?'<span class="success">Activo</span>':'<span class="hint">Inactivo</span>')+'</td><td><div class="merit-inline-actions"><button type="button" class="secondary meritEditStaffBtn" data-id="'+esc(s.id)+'">Editar</button><button type="button" class="secondary meritActive" data-id="'+esc(s.id)+'" data-next="'+(!s.active)+'">'+(s.active?"Desactivar":"Activar")+'</button></div></td></tr>').join("")+
   '</tbody></table>';
  $$(".meritActive").forEach(b=>b.onclick=()=>setStaffActive(b.dataset.id,b.dataset.next==="true"));
  $$(".meritEditStaffBtn").forEach(b=>b.onclick=()=>openStaffEdit(b.dataset.id));
 }catch(e){box.innerHTML='<p class="message">No se pudo cargar el personal: '+esc(e.message||e)+'</p>'}
}
window.loadMeritStaff=loadMeritStaff;
async function setStaffActive(id,value){
 if(!confirm(value?"¿Activar a este docente?":"¿Desactivar a este docente? Su historial se conservará."))return;
 try{const d=await rpc("teacher_merit_set_staff_active",{p_staff_id:id,p_active:value});if(!d?.ok)throw new Error(d?.reason||"No se pudo actualizar.");await loadMeritStaff()}catch(e){alert("No se pudo actualizar: "+(e.message||e))}
}
function openStaffEdit(id){
 const s=(window.meritStaffBaseCache||[]).find(x=>String(x.id)===String(id));if(!s)return;
 $("#meritEditStaffId").value=s.id;$("#meritEditStaffName").value=s.display_name||"";
 $("#meritEditStaffRole").value=s.role_type||"docente";$("#meritEditStaffSubject").value=s.subject_area||"";
 $("#meritEditStaffStatus").textContent="";$("#meritEditStaffDialog").showModal();
}
async function saveStaffEdit(){
 const st=$("#meritEditStaffStatus");
 try{
  const d=await rpc("teacher_merit_update_staff",{p_staff_id:$("#meritEditStaffId").value,p_display_name:$("#meritEditStaffName").value.trim(),p_role_type:$("#meritEditStaffRole").value,p_subject_area:$("#meritEditStaffSubject").value.trim()});
  if(!d?.ok)throw new Error(d?.reason||"No se pudo guardar.");
  $("#meritEditStaffDialog").close();await loadMeritStaff();
 }catch(e){st.textContent="No se pudo guardar: "+(e.message||e)}
}

async function meritWeeklyPreview(){
 const id=$("#meritWeeklyPeriod").value,box=$("#meritWeeklyPreview"),st=$("#meritWeeklyStatus");
 if(!id)return;
 try{
  const rows=await rpc("teacher_merit_ranking",{p_period_id:id});
  const data=Array.isArray(rows)?rows:[];
  box.innerHTML='<table><thead><tr><th>Lugar</th><th>Grupo</th><th>Puntos</th></tr></thead><tbody>'+data.map(r=>'<tr><td>'+esc(r.rank)+'</td><td><b>'+esc(r.group_code)+'</b></td><td>'+esc(r.score||0)+'</td></tr>').join("")+'</tbody></table>';
  st.textContent="Vista previa actualizada.";
 }catch(e){st.textContent="No se pudo cargar la vista previa: "+(e.message||e)}
}
window.meritWeeklyPreview=meritWeeklyPreview;
async function publishWeekly(){
 const id=$("#meritWeeklyPeriod").value,st=$("#meritWeeklyStatus");if(!id)return;
 if(!confirm("¿Publicar este avance semanal en el portal público?"))return;
 try{const d=await rpc("teacher_merit_publish_weekly",{p_period_id:id,p_public_message:$("#meritWeeklyMessage").value.trim()||null});if(!d?.ok)throw new Error(d?.reason||"No se pudo publicar.");st.innerHTML='<span class="success">✓ Avance semanal publicado.</span>'}catch(e){st.textContent="No se pudo publicar: "+(e.message||e)}
}
async function setPublicState(state){
 const id=$("#meritWeeklyPeriod").value,st=$("#meritWeeklyStatus");if(!id)return;
 try{const d=await rpc("teacher_merit_set_public_state",{p_period_id:id,p_state:state});if(!d?.ok)throw new Error(d?.reason||"No se pudo cambiar el estado.");st.innerHTML='<span class="success">✓ Estado del portal actualizado.</span>'}catch(e){st.textContent="No se pudo actualizar: "+(e.message||e)}
}

async function loadMeritMonthlyPreview(){
 const id=$("#meritMonthlyPeriod").value,box=$("#meritMonthlyPreview"),st=$("#meritMonthlyStatus");if(!id)return;
 try{
  const d=await rpc("teacher_merit_close_preview",{p_period_id:id});
  if(!d?.ok)throw new Error(d?.reason||"No se pudo revisar.");
  const rows=Array.isArray(d.ranking)?d.ranking:(Array.isArray(d.rows)?d.rows:[]);
  box.innerHTML='<p><b>Empates:</b> '+(d.has_ties?"Sí":"No")+'</p><table><thead><tr><th>Lugar</th><th>Grupo</th><th>Puntos</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+esc(r.rank||"")+'</td><td><b>'+esc(r.group_code||r.group||"")+'</b></td><td>'+esc(r.score??r.points??0)+'</td></tr>').join("")+'</tbody></table>';
  st.textContent="Vista previa del cierre actualizada.";
 }catch(e){st.textContent="No se pudo cargar el cierre: "+(e.message||e)}
}
window.loadMeritMonthlyPreview=loadMeritMonthlyPreview;
async function loadMeritMonthlyResult(){
 const id=$("#meritMonthlyPeriod").value,box=$("#meritMonthlyResult");if(!id||!box)return;
 try{const d=await rpc("teacher_merit_monthly_result",{p_period_id:id});box.innerHTML=d?.ok?'<div class="card"><b>Resultado oficial:</b> Grupo '+esc(d.overall_winner||d.winner_group||"—")+'</div>':""}catch(_){}
}
window.loadMeritMonthlyResult=loadMeritMonthlyResult;

async function requireSession(){
 if(!window.ProfeSupabase.restore())return false;
 try{await window.ProfeSupabase.token();return true}catch(_){return false}
}
async function boot(){
 $$(".meritNav").forEach(b=>b.onclick=()=>meritPane(b.dataset.meritPane));
 $("#meritPeriodForm").onsubmit=saveMeritPeriod;
 $("#meritRefreshStaff").onclick=loadMeritStaff;
 $("#meritPreviewWeekly").onclick=meritWeeklyPreview;
 $("#meritPublishWeekly").onclick=publishWeekly;
 $("#meritFreezePublic").onclick=()=>setPublicState("frozen");
 $("#meritProcessPublic").onclick=()=>setPublicState("results_in_process");
 $("#meritOpenPublic").onclick=()=>setPublicState("open");
 $("#meritSaveEditPeriod").onclick=saveMeritPeriodEdit;$("#meritCancelEditPeriod").onclick=()=>$("#meritEditPeriodDialog").close();
 $("#meritSaveEditStaff").onclick=saveStaffEdit;$("#meritCancelEditStaff").onclick=()=>$("#meritEditStaffDialog").close();
 $("#logoutBtn").onclick=async()=>{await window.ProfeSupabase.logout();location.reload()};
 $("#loginBtn").onclick=async()=>{
  const st=$("#loginStatus");st.textContent="Ingresando…";
  try{await window.ProfeSupabase.login($("#loginEmail").value.trim(),$("#loginPassword").value,$("#rememberLogin").checked);$("#loginGate").classList.add("hidden");$("#appShell").classList.remove("hidden");await startData()}catch(e){st.textContent="No se pudo iniciar sesión: "+(e.message||e)}
 };
 if(await requireSession()){$("#loginGate").classList.add("hidden");$("#appShell").classList.remove("hidden");await startData()}
 else{$("#loginGate").classList.remove("hidden");$("#appShell").classList.add("hidden")}
 if("serviceWorker" in navigator)navigator.serviceWorker.register("./service-worker.js?v=1").catch(()=>{});
}
async function startData(){
 await loadMeritPeriods();
 await Promise.allSettled([loadMeritStaff(),window.loadMeritRanking?.(),window.loadMeritMovements?.()]);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();