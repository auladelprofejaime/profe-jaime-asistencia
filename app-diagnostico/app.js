
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
  $("#complecCard").classList.add("hidden");
  $("#proescCard").classList.add("hidden");
  $("#casmCard").classList.add("hidden");
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

  const percentileInterpretation=(p)=>{
    if(p===null||p===undefined||p==="")return "Sin interpretación percentilar disponible.";
    const n=Number(p);
    if(!Number.isFinite(n))return `Percentil ${esc(p)}.`;
    return `Percentil ${n}: aproximadamente ${n}% de la distribución normativa obtuvo una puntuación igual o inferior.`;
  };
  const resultBox=(title,x)=>`<div class="resultBox">
    <h3>${esc(title)}</h3>
    <p><b>PD:</b> ${esc(x.raw_score??"—")}</p>
    <p><b>Cociente:</b> ${esc(x.quotient_display??x.quotient??"—")}</p>
    <p><b>Percentil:</b> ${esc(x.percentile??"—")}</p>
    <p class="percentileNote"><b>Interpretación:</b> ${percentileInterpretation(x.percentile)}</p>
  </div>`;

  box.innerHTML=`
    <div class="ageBand"><b>Edad normativa aplicada:</b> ${esc(age.age_years??"—")} años · Población escolar general (México)</div>
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



const COMPLEC_META=[
  {n:1,text:"Calentamiento Global",q:1,process:"Reflexión/Evaluación",type:"choice"},
  {n:2,text:"Calentamiento Global",q:2,process:"Integración",type:"cg_open"},
  {n:3,text:"Calentamiento Global",q:3,process:"Integración",type:"choice"},
  {n:4,text:"Lenguaje de las Abejas",q:1,process:"Integración",type:"choice"},
  {n:5,text:"Lenguaje de las Abejas",q:2,process:"Recuperación",type:"choice"},
  {n:6,text:"Lenguaje de las Abejas",q:3,process:"Reflexión/Evaluación",type:"choice"},
  {n:7,text:"Lenguaje de las Abejas",q:4,process:"Recuperación",type:"bee_open"},
  {n:8,text:"Lenguaje de las Abejas",q:5,process:"Integración",type:"choice"},
  {n:9,text:"Energía Nuclear",q:1,process:"Recuperación",type:"choice"},
  {n:10,text:"Energía Nuclear",q:2,process:"Integración",type:"choice"},
  {n:11,text:"Energía Nuclear",q:3,process:"Integración",type:"choice"},
  {n:12,text:"Energía Nuclear",q:4,process:"Recuperación",type:"choice"},
  {n:13,text:"Energía Nuclear",q:5,process:"Integración",type:"choice"},
  {n:14,text:"Accidentes de Tráfico",q:1,process:"Recuperación",type:"choice"},
  {n:15,text:"Accidentes de Tráfico",q:2,process:"Integración",type:"traffic_open"},
  {n:16,text:"Accidentes de Tráfico",q:3,process:"Integración",type:"choice"},
  {n:17,text:"Accidentes de Tráfico",q:4,process:"Reflexión/Evaluación",type:"choice"},
  {n:18,text:"Sillas Adecuadas",q:1,process:"Recuperación",type:"choice"},
  {n:19,text:"Sillas Adecuadas",q:2,process:"Integración",type:"choice"},
  {n:20,text:"Sillas Adecuadas",q:3,process:"Integración",type:"choice"}
];
let complecAnswers={};

function complecGradeFromGroup(group){
  const n=Number(String(group||"").trim());
  if(Number.isInteger(n)&&n>=11&&n<=16)return {grade:1,label:"1.º de secundaria",centile:true};
  if(Number.isInteger(n)&&n>=21&&n<=26)return {grade:2,label:"2.º de secundaria",centile:false};
  if(Number.isInteger(n)&&n>=31&&n<=36)return {grade:3,label:"3.º de secundaria",centile:true};
  return {grade:null,label:"Grupo no reconocido",centile:false};
}
function complecOptions(meta){
  if(meta.type==="choice")return ["A","B","C","D"];
  if(meta.type==="cg_open")return ["30 años","3 años","Otra"];
  if(meta.type==="bee_open")return ["Danza en círculo","Otra"];
  if(meta.type==="traffic_open")return ["60%","Otra"];
  return [];
}
function renderComplecItems(){
  const box=$("#complecItems");
  box.innerHTML=COMPLEC_META.map(m=>{
    const opts=complecOptions(m);
    return `<div class="complecItem" data-item="${m.n}">
      <div class="complecItemHead">
        <div><b>Reactivo ${m.n}</b><small>${esc(m.text)} · Pregunta ${m.q}</small></div>
        <small>${esc(m.process)}</small>
      </div>
      <div class="answerBtns ${m.type==="choice"?"":"open"}">
        ${opts.map(o=>`<button type="button" class="answerBtn ${complecAnswers[m.n]===o?"selected":""}" data-answer="${esc(o)}">${esc(o)}</button>`).join("")}
      </div>
    </div>`;
  }).join("");

  box.querySelectorAll(".complecItem").forEach(item=>{
    item.querySelectorAll("[data-answer]").forEach(btn=>{
      btn.onclick=()=>{
        const n=Number(item.dataset.item);
        const value=btn.dataset.answer;
        complecAnswers[n]=value==="Otra" ? "__OTHER__" : value;
        renderComplecItems();
        updateComplecProgress();
      };
    });
  });
}
function updateComplecProgress(){
  const count=COMPLEC_META.filter(m=>complecAnswers[m.n]!=null).length;
  $("#complecProgressText").textContent=`${count} de 20 respondidas`;
  $("#complecProgressBar").style.width=`${count/20*100}%`;
}
function openComplec(){
  if(!activeStudentBundle)return;
  const b=activeStudentBundle;
  $("#studentCard").classList.add("hidden");
  $("#sagesCard").classList.add("hidden");
  $("#complecCard").classList.remove("hidden");

  $("#complecStudentName").textContent=b.student.name;
  $("#complecStudentMeta").textContent=`Grupo ${b.student.group_name} · Lista ${b.student.list_number??"—"} · ID ${b.student.id}`;

  const gr=complecGradeFromGroup(b.student.group_name);
  $("#complecGradeNote").textContent=gr.grade===2
    ? "2.º de secundaria: se calcularán puntuación total y procesos. El manual no publica centil específico para 2.º."
    : gr.grade
      ? `${gr.label}: la app aplicará automáticamente el baremo oficial disponible en el manual.`
      : "El código de grupo no permite determinar automáticamente el grado.";

  complecAnswers={};
  (b.complec_answers||[]).forEach(r=>{if(r.answer!=null)complecAnswers[Number(r.item_number)]=r.answer});
  renderComplecItems(); updateComplecProgress();
  $("#complecResult").classList.add("hidden");
  $("#complecStatus").textContent=b.progress.complec_complete?"CompLEC guardado. Puedes editarlo y volver a guardar.":"";
}
function complecPayload(){
  const missing=COMPLEC_META.filter(m=>complecAnswers[m.n]==null).map(m=>m.n);
  if(missing.length)throw new Error(`Faltan respuestas: ${missing.join(", ")}.`);
  const out={};
  for(const m of COMPLEC_META){
    const v=complecAnswers[m.n];
    out[String(m.n)]=v==="__OTHER__" ? "Otra" : v;
  }
  return out;
}
function showComplecResult(r){
  const p=r.process_scores||{};
  const cent=r.centile||{};
  const centileBlock=r.has_official_centile && cent.ok
    ? `<p><b>Centil:</b> ${esc(cent.centile??"—")}</p>`
    : `<p><b>Centil:</b> No se reporta para este grado.</p>`;
  $("#complecResult").innerHTML=`
    <div class="complecSummary">
      <div class="resultBox wide">
        <h3>Resultado CompLEC</h3>
        <p><b>Grado detectado:</b> ${esc(r.grade_label||"—")}</p>
        <p><b>Puntuación total:</b> ${esc(r.total_score??"—")} / 20</p>
        ${centileBlock}
        <p class="percentileNote">${esc(r.norm_note||"")}</p>
      </div>
      <div class="resultBox"><h3>Recuperación</h3><p><b>${esc(p["Recuperación"]??0)} / 5</b></p></div>
      <div class="resultBox"><h3>Integración</h3><p><b>${esc(p["Integración"]??0)} / 10</b></p></div>
      <div class="resultBox"><h3>Reflexión / Evaluación</h3><p><b>${esc(p["Reflexión/Evaluación"]??0)} / 5</b></p></div>
    </div>`;
  $("#complecResult").classList.remove("hidden");
}
async function previewComplec(){
  try{
    const answers=complecPayload();
    $("#complecStatus").textContent="Calculando…";
    const r=await rpc("teacher_diagnostic_complec_preview_auto",{
      p_student_id:activeStudentBundle.student.id,
      p_answers:answers
    });
    if(!r.ok)throw new Error(r.reason||"No se pudo calcular CompLEC.");
    showComplecResult(r);
    $("#complecStatus").textContent="Vista previa calculada. Aún no se ha guardado.";
  }catch(e){$("#complecStatus").textContent=e.message||String(e)}
}
async function saveComplec(){
  try{
    const answers=complecPayload();
    $("#complecStatus").textContent="Guardando…";
    const r=await rpc("teacher_diagnostic_save_complec_auto",{
      p_period_id:activePeriod.id,
      p_student_id:activeStudentBundle.student.id,
      p_answers:answers
    });
    if(!r.saved)throw new Error(r.reason||"No se pudo guardar CompLEC.");
    showComplecResult(r);
    $("#complecStatus").textContent="✓ CompLEC guardado correctamente.";
    activeStudentBundle=await rpc("teacher_diagnostic_student_bundle",{
      p_period_id:activePeriod.id,
      p_student_id:activeStudentBundle.student.id
    });
    $("#complecState").textContent="Completa";
  }catch(e){$("#complecStatus").textContent=e.message||String(e)}
}

$("#openComplecBtn").onclick=openComplec;
$("#backStudentFromComplec").onclick=()=>{
  if(activeStudentBundle){
    $("#complecCard").classList.add("hidden");
    $("#studentCard").classList.remove("hidden");
  }
};
$("#previewComplecBtn").onclick=previewComplec;
$("#saveComplecBtn").onclick=saveComplec;


function proescGradeFromGroup(group){
  const n=Number(String(group||"").trim());
  if(Number.isInteger(n)&&n>=11&&n<=16)return {grade:1,label:"1.º de secundaria"};
  if(Number.isInteger(n)&&n>=21&&n<=26)return {grade:2,label:"2.º de secundaria"};
  if(Number.isInteger(n)&&n>=31&&n<=36)return {grade:3,label:"3.º de secundaria"};
  return {grade:null,label:"Grupo no reconocido"};
}

function openProesc(){
  if(!activeStudentBundle)return;
  const b=activeStudentBundle;
  $("#studentCard").classList.add("hidden");
  $("#sagesCard").classList.add("hidden");
  $("#complecCard").classList.add("hidden");
  $("#proescCard").classList.remove("hidden");

  $("#proescStudentName").textContent=b.student.name;
  $("#proescStudentMeta").textContent=`Grupo ${b.student.group_name} · Lista ${b.student.list_number??"—"} · ID ${b.student.id}`;

  const gr=proescGradeFromGroup(b.student.group_name);
  $("#proescGradeNote").textContent=gr.grade
    ? `${gr.label}: la app aplicará automáticamente el baremo PROESC correspondiente.`
    : "El código de grupo no permite determinar automáticamente el grado.";

  const p=b.proesc||{};
  if(p.words_score!=null)$("#proescWords").value=p.words_score;
  if(p.pseudowords_score!=null)$("#proescPseudo").value=p.pseudowords_score;
  if(p.orthographic_rules_score!=null)$("#proescRules").value=p.orthographic_rules_score;
  if(p.accents_score!=null)$("#proescAccents").value=p.accents_score;
  if(p.capitals_score!=null)$("#proescCaps").value=p.capitals_score;
  if(p.punctuation_score!=null)$("#proescPunct").value=p.punctuation_score;
  if(p.writing_rubric?.content!=null)$("#proescWritingContent").value=p.writing_rubric.content;
  if(p.writing_rubric?.presentation!=null)$("#proescWritingPresentation").value=p.writing_rubric.presentation;

  $("#proescResult").classList.add("hidden");
  $("#proescStatus").textContent=b.progress.proesc_complete?"PROESC guardado. Puedes editarlo y volver a guardar.":"";
}

function proescPayload(){
  const get=(sel,min,max,label)=>{
    const v=Number($(sel).value);
    if(!Number.isFinite(v)||v<min||v>max)throw new Error(`${label} debe estar entre ${min} y ${max}.`);
    return v;
  };
  return {
    words:get("#proescWords",0,25,"Dictado de palabras"),
    pseudo:get("#proescPseudo",0,25,"Pseudopalabras total"),
    rules:get("#proescRules",0,15,"Reglas ortográficas"),
    accents:get("#proescAccents",0,15,"Acentos"),
    caps:get("#proescCaps",0,10,"Mayúsculas"),
    punct:get("#proescPunct",0,8,"Signos de puntuación"),
    wc:get("#proescWritingContent",0,5,"Contenido de redacción"),
    wp:get("#proescWritingPresentation",0,5,"Presentación de redacción")
  };
}

function showProescResult(r){
  const i=r.interpretation||{};
  const sc=r.scores||{};
  const box=(title,score,max,obj)=>`<div class="resultBox">
    <h3>${esc(title)}</h3>
    <p><b>Puntuación:</b> ${esc(score??"—")} / ${esc(max)}</p>
    <p class="classification">${esc(obj?.label||"Sin clasificación")}</p>
  </div>`;

  $("#proescResult").innerHTML=`
    <div class="proescResultGrid">
      <div class="resultBox wide">
        <h3>Resultado PROESC abreviado</h3>
        <p><b>Grado detectado:</b> ${esc(r.grade_label||"—")}</p>
        <p><b>Versión:</b> ${esc(r.form||"PROESC abreviado")}</p>
      </div>
      ${box("Palabras · Ortografía arbitraria",sc.words,25,i.words_arbitrary)}
      ${box("Pseudopalabras · Total",sc.pseudowords_total,25,i.pseudowords_total)}
      ${box("Pseudopalabras · Reglas",sc.pseudowords_rules,15,i.pseudowords_rules)}
      ${box("Frases · Acentos",sc.accents,15,i.accents)}
      ${box("Frases · Mayúsculas",sc.capitals,10,i.capitals)}
      ${box("Frases · Signos de puntuación",sc.punctuation,8,i.punctuation)}
      ${box("Redacción",sc.writing_total,10,i.writing)}
      <div class="resultBox wide">
        <p><b>Redacción:</b> Contenido ${esc(sc.writing_content??"—")}/5 · Presentación ${esc(sc.writing_presentation??"—")}/5</p>
      </div>
    </div>`;
  $("#proescResult").classList.remove("hidden");
}

async function previewProesc(){
  try{
    const p=proescPayload();
    $("#proescStatus").textContent="Calculando…";
    const r=await rpc("teacher_diagnostic_proesc_preview",{
      p_student_id:activeStudentBundle.student.id,
      p_words_score:p.words,
      p_pseudowords_score:p.pseudo,
      p_orthographic_rules_score:p.rules,
      p_accents_score:p.accents,
      p_capitals_score:p.caps,
      p_punctuation_score:p.punct,
      p_writing_content:p.wc,
      p_writing_presentation:p.wp
    });
    if(!r.ok)throw new Error(r.reason||"No se pudo calcular PROESC.");
    showProescResult(r);
    $("#proescStatus").textContent="Vista previa calculada. Aún no se ha guardado.";
  }catch(e){$("#proescStatus").textContent=e.message||String(e)}
}

async function saveProesc(){
  try{
    const p=proescPayload();
    $("#proescStatus").textContent="Guardando…";
    const r=await rpc("teacher_diagnostic_save_proesc",{
      p_period_id:activePeriod.id,
      p_student_id:activeStudentBundle.student.id,
      p_words_score:p.words,
      p_pseudowords_score:p.pseudo,
      p_orthographic_rules_score:p.rules,
      p_accents_score:p.accents,
      p_capitals_score:p.caps,
      p_punctuation_score:p.punct,
      p_writing_content:p.wc,
      p_writing_presentation:p.wp
    });
    if(!r.saved)throw new Error(r.reason||"No se pudo guardar PROESC.");
    showProescResult(r);
    $("#proescStatus").textContent="✓ PROESC guardado correctamente.";
    activeStudentBundle=await rpc("teacher_diagnostic_student_bundle",{
      p_period_id:activePeriod.id,
      p_student_id:activeStudentBundle.student.id
    });
    $("#proescState").textContent="Completa";
  }catch(e){$("#proescStatus").textContent=e.message||String(e)}
}

$("#openProescBtn").onclick=openProesc;
$("#backStudentFromProesc").onclick=()=>{
  if(activeStudentBundle){
    $("#proescCard").classList.add("hidden");
    $("#studentCard").classList.remove("hidden");
  }
};
$("#previewProescBtn").onclick=previewProesc;
$("#saveProescBtn").onclick=saveProesc;


const CASM_AREAS=[
  {code:"I",name:"¿Cómo estudia usted?",start:1,end:12},
  {code:"II",name:"¿Cómo hace sus tareas?",start:13,end:22},
  {code:"III",name:"¿Cómo prepara sus exámenes?",start:23,end:33},
  {code:"IV",name:"¿Cómo escucha las clases?",start:34,end:45},
  {code:"V",name:"¿Qué acompaña sus momentos de estudio?",start:46,end:53}
];
let casmAnswers={};

function casmAreaForItem(n){
  return CASM_AREAS.find(a=>n>=a.start&&n<=a.end);
}
function renderCasmItems(){
  const box=$("#casmItems");
  let html="";
  for(let n=1;n<=53;n++){
    const area=casmAreaForItem(n);
    if(n===area.start){
      html+=`<div class="casmAreaDivider">Área ${area.code} · ${esc(area.name)}</div>`;
    }
    html+=`<div class="casmItem" data-item="${n}">
      <div class="casmItemHead">
        <b>Reactivo ${n}</b>
        <small>Área ${area.code}</small>
      </div>
      <div class="casmBtns">
        <button type="button" class="casmBtn ${casmAnswers[n]==="SIEMPRE"?"selected":""}" data-answer="SIEMPRE">Siempre</button>
        <button type="button" class="casmBtn ${casmAnswers[n]==="NUNCA"?"selected":""}" data-answer="NUNCA">Nunca</button>
      </div>
    </div>`;
  }
  box.innerHTML=html;

  box.querySelectorAll(".casmItem").forEach(item=>{
    item.querySelectorAll("[data-answer]").forEach(btn=>{
      btn.onclick=()=>{
        const n=Number(item.dataset.item);
        casmAnswers[n]=btn.dataset.answer;
        renderCasmItems();
        updateCasmProgress();
      };
    });
  });
}
function updateCasmProgress(){
  const count=Object.keys(casmAnswers).length;
  $("#casmProgressText").textContent=`${count} de 53 respondidas`;
  $("#casmProgressBar").style.width=`${count/53*100}%`;
}
function openCasm(){
  if(!activeStudentBundle)return;
  const b=activeStudentBundle;
  $("#studentCard").classList.add("hidden");
  $("#sagesCard").classList.add("hidden");
  $("#complecCard").classList.add("hidden");
  $("#proescCard").classList.add("hidden");
  $("#casmCard").classList.remove("hidden");

  $("#casmStudentName").textContent=b.student.name;
  $("#casmStudentMeta").textContent=`Grupo ${b.student.group_name} · Lista ${b.student.list_number??"—"} · ID ${b.student.id}`;

  casmAnswers={};
  (b.casm_answers||[]).forEach(r=>{if(r.answer)casmAnswers[Number(r.item_number)]=r.answer});
  renderCasmItems();
  updateCasmProgress();
  $("#casmResult").classList.add("hidden");
  $("#casmStatus").textContent=b.progress.casm_complete?"CASM-85-R guardado. Puedes editarlo y volver a guardar.":"";
}
function casmPayload(){
  const missing=[];
  const out={};
  for(let n=1;n<=53;n++){
    if(!casmAnswers[n])missing.push(n);
    else out[String(n)]=casmAnswers[n];
  }
  if(missing.length)throw new Error(`Faltan respuestas: ${missing.join(", ")}.`);
  return out;
}
function casmClassText(obj){
  if(!obj)return "—";
  if(obj.ambiguous)return `${obj.label}: ${obj.note||""}`;
  return obj.label||"—";
}
function showCasmResult(r){
  const sc=r.scores||{};
  const cl=r.classifications||{};
  const areaBox=(code,title,max)=>`<div class="resultBox">
    <h3>Área ${code} · ${esc(title)}</h3>
    <p><b>Puntuación:</b> ${esc(sc[code]??"—")} / ${max}</p>
    <p class="classification">${esc(casmClassText(cl[code]))}</p>
  </div>`;

  $("#casmResult").innerHTML=`
    <div class="casmResultGrid">
      <div class="resultBox wide">
        <h3>Resultado CASM-85-R</h3>
        <p><b>Puntuación total:</b> ${esc(sc.TOTAL??"—")} / 53</p>
        <p><b>Categoría:</b> ${esc(casmClassText(cl.TOTAL))}</p>
        ${cl.TOTAL?.percentile_band?`<p><b>Rango percentilar:</b> ${esc(cl.TOTAL.percentile_band)}</p>`:""}
      </div>
      ${areaBox("I","Cómo estudia",12)}
      ${areaBox("II","Cómo hace sus tareas",10)}
      ${areaBox("III","Cómo prepara sus exámenes",11)}
      ${areaBox("IV","Cómo escucha las clases",12)}
      ${areaBox("V","Qué acompaña sus momentos de estudio",8)}
    </div>`;
  $("#casmResult").classList.remove("hidden");
}
async function previewCasm(){
  try{
    const answers=casmPayload();
    $("#casmStatus").textContent="Calculando…";
    const r=await rpc("teacher_diagnostic_casm_preview",{
      p_student_id:activeStudentBundle.student.id,
      p_answers:answers
    });
    if(!r.ok)throw new Error(r.reason||"No se pudo calcular CASM-85-R.");
    showCasmResult(r);
    $("#casmStatus").textContent="Vista previa calculada. Aún no se ha guardado.";
  }catch(e){$("#casmStatus").textContent=e.message||String(e)}
}
async function saveCasm(){
  try{
    const answers=casmPayload();
    $("#casmStatus").textContent="Guardando…";
    const r=await rpc("teacher_diagnostic_save_casm",{
      p_period_id:activePeriod.id,
      p_student_id:activeStudentBundle.student.id,
      p_answers:answers
    });
    if(!r.saved)throw new Error(r.reason||"No se pudo guardar CASM-85-R.");
    showCasmResult(r);
    $("#casmStatus").textContent="✓ CASM-85-R guardado correctamente.";
    activeStudentBundle=await rpc("teacher_diagnostic_student_bundle",{
      p_period_id:activePeriod.id,
      p_student_id:activeStudentBundle.student.id
    });
    $("#casmState").textContent="Completa";
  }catch(e){$("#casmStatus").textContent=e.message||String(e)}
}

$("#openCasmBtn").onclick=openCasm;
$("#backStudentFromCasm").onclick=()=>{
  if(activeStudentBundle){
    $("#casmCard").classList.add("hidden");
    $("#studentCard").classList.remove("hidden");
  }
};
$("#previewCasmBtn").onclick=previewCasm;
$("#saveCasmBtn").onclick=saveCasm;

$("#loginBtn").onclick=login;
$("#createPeriodBtn").onclick=createPeriod;
$("#refreshBtn").onclick=loadPeriods;
$("#logoutBtn").onclick=()=>{localStorage.removeItem("diagnosticTeacherToken");accessToken="";location.reload()};
$("#backGroupsBtn").onclick=()=>openPeriod(activePeriod);
$("#backStudentsBtn").onclick=()=>openGroup(activeGroup);

if("serviceWorker" in navigator)navigator.serviceWorker.register("service-worker.js").catch(()=>{});
boot();
