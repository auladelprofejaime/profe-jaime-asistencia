
const SUPABASE_URL="https://xqeyyjakmeiaahecfdmc.supabase.co";
const SUPABASE_KEY="sb_publishable_GY2NGAigumnZw3rIJKU7LA_a2qigAEA";
let accessToken=localStorage.getItem("diagnosticTeacherToken")||"";
let activePeriod=null,activeGroup=null,activeStudentBundle=null;

const $=s=>document.querySelector(s);
const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));

async function request(path,{method="GET",body,token=accessToken}={}){
  const headers={apikey:SUPABASE_KEY,Authorization:`Bearer ${token||SUPABASE_KEY}`};
  if(body!==undefined)headers["Content-Type"]="application/json";
  const r=await fetch(SUPABASE_URL+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  const text=await r.text(); let data=null; try{data=text?JSON.parse(text):null}catch{data=text}
  if(!r.ok)throw new Error(data?.message||data?.error||data?.msg||text||`HTTP ${r.status}`);
  return data;
}
const rpc=(name,args={})=>request(`/rest/v1/rpc/${name}`,{method:"POST",body:args});

async function login(){
  const email=$("#email").value.trim(),password=$("#password").value;
  $("#loginStatus").textContent="Entrando…";
  try{
    const data=await request("/auth/v1/token?grant_type=password",{method:"POST",body:{email,password},token:SUPABASE_KEY});
    accessToken=data.access_token;
    localStorage.setItem("diagnosticTeacherToken",accessToken);
    await boot();
  }catch(e){$("#loginStatus").textContent="No se pudo entrar: "+e.message}
}
async function verifyTeacher(){
  const ok=await rpc("is_teacher");
  if(ok!==true)throw new Error("La cuenta no tiene perfil docente.");
}
async function boot(){
  if(!accessToken){$("#loginCard").classList.remove("hidden");$("#appShell").classList.add("hidden");return}
  try{
    await verifyTeacher();
    $("#loginCard").classList.add("hidden");$("#appShell").classList.remove("hidden");
    $("#teacherStatus").textContent="Sesión docente válida · Matutino";
    await loadPeriods();
  }catch(e){
    localStorage.removeItem("diagnosticTeacherToken");accessToken="";
    $("#loginCard").classList.remove("hidden");$("#appShell").classList.add("hidden");
    $("#loginStatus").textContent="Sesión vencida o no autorizada. "+e.message;
  }
}
async function loadPeriods(){
  const rows=await rpc("teacher_diagnostic_periods");
  const box=$("#periodList");
  if(!rows.length){box.className="list empty";box.textContent="Todavía no hay periodos diagnósticos.";return}
  box.className="list";
  box.innerHTML=rows.map(p=>`<div class="row">
    <div><b>${esc(p.name)}</b><small>${esc(p.cycle)} · ${esc(p.shift)} · ${esc(p.status)} · ${p.student_count||0} alumnos</small></div>
    <div class="rowActions">
      <button data-period="${esc(p.id)}">Abrir</button>
      <button class="dangerBtn" data-delete-period="${esc(p.id)}">Eliminar</button>
    </div>
  </div>`).join("");
  box.querySelectorAll("[data-period]").forEach(b=>b.onclick=()=>openPeriod(rows.find(p=>p.id===b.dataset.period)));
  box.querySelectorAll("[data-delete-period]").forEach(b=>b.onclick=()=>deletePeriod(rows.find(p=>p.id===b.dataset.deletePeriod)));
}
async function createPeriod(){
  const name=$("#periodName").value.trim(),cycle=$("#periodCycle").value.trim();
  try{
    const r=await rpc("teacher_diagnostic_create_period",{p_name:name,p_cycle:cycle});
    await rpc("teacher_diagnostic_sync_students",{p_period_id:r.period.id});
    await loadPeriods();
    await openPeriod(r.period);
  }catch(e){alert("No se pudo crear el periodo: "+e.message)}
}

async function deletePeriod(p){
  if(!p)return;
  const first=confirm(`¿Eliminar el periodo "${p.name}"?\n\nSe borrarán también todas las capturas, resultados y publicaciones asociadas a este periodo.`);
  if(!first)return;

  const typed=prompt(`Para confirmar definitivamente escribe BORRAR:`);
  if(String(typed||"").trim().toUpperCase()!=="BORRAR"){
    alert("No se eliminó el periodo.");
    return;
  }

  try{
    await rpc("teacher_diagnostic_delete_period",{p_period_id:p.id});
    if(activePeriod?.id===p.id){
      activePeriod=null;
      activeGroup=null;
      $("#groupsCard").classList.add("hidden");
      $("#studentsCard").classList.add("hidden");
      $("#studentCard").classList.add("hidden");
    }
    await loadPeriods();
    alert("Periodo eliminado correctamente.");
  }catch(e){
    alert("No se pudo eliminar el periodo: "+e.message);
  }
}
async function openPeriod(p){
  activePeriod=p;
  await rpc("teacher_diagnostic_sync_students",{p_period_id:p.id});
  const groups=await rpc("teacher_diagnostic_groups",{p_period_id:p.id});
  $("#groupsCard").classList.remove("hidden");$("#studentsCard").classList.add("hidden");$("#studentCard").classList.add("hidden");
  $("#groupList").innerHTML=groups.map(g=>`<button class="groupBtn" data-group="${esc(g.group_name)}"><b>${esc(g.group_name||"Sin grupo")}</b><span>${g.student_count} alumnos · ${g.complete_count} completos</span></button>`).join("");
  $("#groupList").querySelectorAll("[data-group]").forEach(b=>b.onclick=()=>openGroup(b.dataset.group));
}
async function openGroup(group){
  activeGroup=group;
  const rows=await rpc("teacher_diagnostic_students",{p_period_id:activePeriod.id,p_group_name:group});
  $("#groupsCard").classList.add("hidden");$("#studentsCard").classList.remove("hidden");$("#studentCard").classList.add("hidden");
  $("#studentsTitle").textContent=`Grupo ${group}`;
  $("#studentList").innerHTML=rows.map(s=>`<div class="row">
    <div><b>${esc(s.list_number??"—")}. ${esc(s.name)}</b><small>ID ${esc(s.student_id)} · ${esc(s.status)} · S ${s.sages_complete?"✓":"—"} · C ${s.complec_complete?"✓":"—"} · P ${s.proesc_complete?"✓":"—"} · CA ${s.casm_complete?"✓":"—"}</small></div>
    <button data-student="${esc(s.student_id)}">Abrir</button>
  </div>`).join("");
  $("#studentList").querySelectorAll("[data-student]").forEach(b=>b.onclick=()=>openStudent(b.dataset.student));
}
async function openStudent(id){
  const b=await rpc("teacher_diagnostic_student_bundle",{p_period_id:activePeriod.id,p_student_id:id});
  activeStudentBundle=b;
  $("#studentsCard").classList.add("hidden");
  $("#sagesCard").classList.add("hidden");
  $("#studentCard").classList.remove("hidden");
  $("#studentMeta").textContent=`Grupo ${b.student.group_name} · Lista ${b.student.list_number??"—"} · ID ${b.student.id}`;
  $("#studentName").textContent=b.student.name;
  const set=(sel,val)=>$(sel).textContent=val?"Completa":"Pendiente";
  set("#sagesState",b.progress.sages_complete);
  set("#complecState",b.progress.complec_complete);
  set("#proescState",b.progress.proesc_complete);
  set("#casmState",b.progress.casm_complete);
}

function todayISO(){
  const d=new Date(), off=d.getTimezoneOffset();
  return new Date(d.getTime()-off*60000).toISOString().slice(0,10);
}

function sagesPayload(){
  if(!activeStudentBundle)throw new Error("No hay alumno seleccionado.");
  const age=Number($("#sagesAge").value);
  const language=Number($("#sagesLanguage").value);
  const reasoning=Number($("#sagesReasoning").value);
  const date=$("#sagesDate").value||todayISO();

  if(!age)throw new Error("Selecciona la edad actual del alumno.");
  if(!Number.isInteger(language)||language<0||language>30)
    throw new Error("Lengua/LL-CS debe estar entre 0 y 30.");
  if(!Number.isInteger(reasoning)||reasoning<0||reasoning>35)
    throw new Error("Razonamiento debe estar entre 0 y 35.");

  return {age,language,reasoning,date};
}

function showSagesResult(r){
  const box=$("#sagesResult");
  const age=r.age||{};
  const lang=r.language||{};
  const reas=r.reasoning||{};

  const resultBox=(title,x)=>`<div class="resultBox">
    <h3>${esc(title)}</h3>
    <p><b>PD:</b> ${esc(x.raw_score??"—")}</p>
    <p><b>Cociente:</b> ${esc(x.quotient_display??x.quotient??"—")}</p>
    <p><b>Percentil:</b> ${esc(x.percentile??"—")}</p>
    <p><b>Nivel:</b> ${esc(x.level??"—")}</p>
  </div>`;

  box.innerHTML=`
    <div class="ageBand">
      <b>Intervalo calculado:</b> ${esc((age.age_band||"—").replace("_","–"))}
      · ${esc(age.age_months_rounded??"—")} meses después del cumpleaños
    </div>
    <div class="resultGrid">
      ${resultBox("Lengua / LL-CS",lang)}
      ${resultBox("Razonamiento",reas)}
    </div>`;

  box.classList.remove("hidden");
}

function openSages(){
  if(!activeStudentBundle)return;

  const b=activeStudentBundle;
  $("#studentCard").classList.add("hidden");
  $("#sagesCard").classList.remove("hidden");

  $("#sagesStudentName").textContent=b.student.name;
  $("#sagesStudentMeta").textContent=
    `Grupo ${b.student.group_name} · Lista ${b.student.list_number??"—"} · ID ${b.student.id}`;

  $("#sagesDate").value=todayISO();

  if(b.sages){
    if(b.sages.age_years)$("#sagesAge").value=String(b.sages.age_years);
    if(b.sages.language_raw_score!=null)$("#sagesLanguage").value=b.sages.language_raw_score;
    if(b.sages.reasoning_raw_score!=null)$("#sagesReasoning").value=b.sages.reasoning_raw_score;
  }

  $("#sagesStatus").textContent=
    b.progress.sages_complete
      ?"SAGES guardado. Puedes editarlo y volver a guardar."
      :"";

  $("#sagesResult").classList.add("hidden");
}

async function previewSages(){
  try{
    const p=sagesPayload();
    $("#sagesStatus").textContent="Calculando…";

    const r=await rpc("teacher_diagnostic_sages_preview",{
      p_student_id:activeStudentBundle.student.id,
      p_age_years:p.age,
      p_language_raw:p.language,
      p_reasoning_raw:p.reasoning,
      p_application_date:p.date
    });

    if(!r.ok){
      $("#sagesStatus").textContent=
        "No se pudo calcular: falta un baremo exacto para esta combinación.";
      $("#sagesResult").classList.add("hidden");
      return;
    }

    showSagesResult(r);
    $("#sagesStatus").textContent=
      "Vista previa calculada. Aún no se ha guardado.";
  }catch(e){
    $("#sagesStatus").textContent=e.message||String(e);
  }
}

async function saveSages(){
  try{
    const p=sagesPayload();
    $("#sagesStatus").textContent="Guardando…";

    const r=await rpc("teacher_diagnostic_save_sages",{
      p_period_id:activePeriod.id,
      p_student_id:activeStudentBundle.student.id,
      p_age_years:p.age,
      p_language_raw:p.language,
      p_reasoning_raw:p.reasoning,
      p_application_date:p.date
    });

    if(!r.saved){
      $("#sagesStatus").textContent=
        "No se guardó: no existe un baremo exacto para esta combinación.";
      return;
    }

    showSagesResult(r);
    $("#sagesStatus").textContent="✓ SAGES guardado correctamente.";

    const id=activeStudentBundle.student.id;
    activeStudentBundle=await rpc("teacher_diagnostic_student_bundle",{
      p_period_id:activePeriod.id,
      p_student_id:id
    });
    $("#sagesState").textContent="Completa";
  }catch(e){
    $("#sagesStatus").textContent=e.message||String(e);
  }
}

$("#openSagesBtn").onclick=openSages;
$("#backStudentFromSages").onclick=()=>{
  if(activeStudentBundle){
    $("#sagesCard").classList.add("hidden");
    $("#studentCard").classList.remove("hidden");
  }
};
$("#previewSagesBtn").onclick=previewSages;
$("#saveSagesBtn").onclick=saveSages;


$("#loginBtn").onclick=login;
$("#createPeriodBtn").onclick=createPeriod;
$("#refreshBtn").onclick=loadPeriods;
$("#logoutBtn").onclick=()=>{localStorage.removeItem("diagnosticTeacherToken");accessToken="";location.reload()};
$("#backGroupsBtn").onclick=()=>openPeriod(activePeriod);
$("#backStudentsBtn").onclick=()=>openGroup(activeGroup);

if("serviceWorker" in navigator)navigator.serviceWorker.register("service-worker.js").catch(()=>{});
boot();
