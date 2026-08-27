
const SUPABASE_URL="https://xqeyyjakmeiaahecfdmc.supabase.co";
const SUPABASE_KEY="sb_publishable_GY2NGAigumnZw3rIJKU7LA_a2qigAEA";
let accessToken=localStorage.getItem("diagnosticTeacherToken")||"";
let activePeriod=null,activeGroup=null,activeStudentBundle=null,activeLecturaApplications=[],activeProescApplications=[],latestFollowupComparison=null;

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
  if(!p){
    alert("No se pudo identificar el periodo seleccionado.");
    return;
  }

  activePeriod=p;

  try{
    // La sincronización ayuda a incorporar alumnos nuevos, pero no debe impedir abrir
    // un periodo que ya existe si por alguna razón esa sincronización falla.
    try{
      await rpc("teacher_diagnostic_sync_students",{p_period_id:p.id});
    }catch(syncError){
      console.warn("No se pudo sincronizar alumnos al abrir el periodo:",syncError);
    }

    const groups=await rpc("teacher_diagnostic_groups",{p_period_id:p.id});

    if(!Array.isArray(groups)){
      throw new Error("La consulta de grupos no devolvió una lista válida.");
    }

    $("#groupsCard").classList.remove("hidden");
    $("#studentsCard").classList.add("hidden");
    $("#studentCard").classList.add("hidden");
    $("#groupDashboardCard").classList.add("hidden");

    $("#groupList").innerHTML=groups.length
      ? groups.map(g=>`<button class="groupBtn" data-group="${esc(g.group_name)}"><b>${esc(g.group_name||"Sin grupo")}</b><span>${g.student_count} alumnos · ${g.complete_count} completos</span></button>`).join("")
      : '<div class="notice">El periodo abrió correctamente, pero todavía no hay grupos sincronizados.</div>';

    $("#groupList").querySelectorAll("[data-group]").forEach(
      b=>b.onclick=()=>openGroup(b.dataset.group)
    );

    // Llevar la pantalla a la sección de grupos para que el usuario vea el cambio.
    $("#groupsCard").scrollIntoView({behavior:"smooth",block:"start"});
  }catch(e){
    console.error("Error al abrir periodo:",e);
    alert("No se pudo abrir el periodo: "+(e.message||String(e)));
  }
}
async function openGroup(group){
  activeGroup=group;
  const rows=await rpc("teacher_diagnostic_students",{p_period_id:activePeriod.id,p_group_name:group});
  $("#groupsCard").classList.add("hidden");$("#studentsCard").classList.remove("hidden");$("#studentCard").classList.add("hidden");
  $("#studentsTitle").textContent=`Grupo ${group}`;
  $("#studentList").innerHTML=rows.map(s=>`<div class="row">
    <div><b>${esc(s.list_number??"—")}. ${esc(s.name)}</b><small>ID ${esc(s.student_id)} · ${esc(s.status)} · S ${s.sages_complete?"✓":"—"} · LE al abrir · P ${s.proesc_complete?"✓":"—"} · CA ${s.casm_complete?"✓":"—"}</small></div>
    <button data-student="${esc(s.student_id)}">Abrir</button>
  </div>`).join("");
  $("#studentList").querySelectorAll("[data-student]").forEach(b=>b.onclick=()=>openStudent(b.dataset.student));
}
async function openStudent(id){
  const b=await rpc("teacher_diagnostic_student_bundle",{p_period_id:activePeriod.id,p_student_id:id});
  activeStudentBundle=b;
  $("#studentsCard").classList.add("hidden");
  $("#sagesCard").classList.add("hidden");
  $("#lecturaCard").classList.add("hidden");
  $("#proescCard").classList.add("hidden");
  $("#casmCard").classList.add("hidden");
  $("#integratedCard").classList.add("hidden");
  $("#studentCard").classList.remove("hidden");
  $("#studentMeta").textContent=`Grupo ${b.student.group_name} · Lista ${b.student.list_number??"—"} · ID ${b.student.id}`;
  $("#studentName").textContent=b.student.name;
  const set=(sel,val)=>$(sel).textContent=val?"Completa":"Pendiente";
  set("#sagesState",b.progress.sages_complete);
  set("#proescState",b.progress.proesc_complete);
  set("#casmState",b.progress.casm_complete);
  try{
    activeProescApplications=await rpc("teacher_diagnostic_proesc_applications",{
      p_period_id:activePeriod.id,
      p_student_id:b.student.id
    })||[];
    const pIni=activeProescApplications.some(x=>x.moment==="initial");
    const pFin=activeProescApplications.some(x=>x.moment==="final");
    $("#proescState").textContent=pIni?(pFin?"Inicial + Final":"Inicial completa"):"Pendiente";
  }catch(e){console.warn("proesc applications state",e)}
  try{
    activeLecturaApplications=await rpc("teacher_diagnostic_lectura_eficaz_applications",{
      p_period_id:activePeriod.id,
      p_student_id:b.student.id
    })||[];
  }catch(e){
    activeLecturaApplications=[];
    console.warn("lectura eficaz applications",e);
  }
  const initialLE=activeLecturaApplications.find(x=>x.moment==="initial");
  const finalLE=activeLecturaApplications.find(x=>x.moment==="final");
  $("#lecturaState").textContent=initialLE
    ? (finalLE?"Inicial + Final":"Inicial completa")
    : "Pendiente";
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

const SAGES_RAW_TO_Q={"language":{"10":[[2,70],[3,75],[4,80],[5,85],[6,90],[7,95],[8,100],[9,105],[10,110],[11,115],[12,120],[13,125],[14,130],[15,135],[16,140],[17,145],[18,150],[19,155],[20,160]],"11":[[1,55],[2,60],[3,65],[4,70],[5,75],[6,80],[7,85],[8,90],[9,95],[10,100],[11,105],[12,110],[13,115],[14,120],[15,125],[16,130],[17,135],[18,140]],"12":[[4,60],[5,65],[6,70],[7,75],[8,80],[9,85],[10,90],[11,95],[12,100],[13,105],[14,110],[15,115],[16,120],[17,125],[18,130],[19,135],[20,140],[21,145]],"13":[[5,70],[6,74],[7,78],[8,81],[9,85],[10,89],[11,93],[12,96],[13,100],[14,104],[15,108],[16,111],[17,115],[18,119],[19,123],[20,126],[21,130],[22,134],[25,145]],"14":[[3,55],[5,63],[7,70],[8,74],[9,78],[10,81],[11,85],[12,89],[13,93],[14,96],[15,100],[16,104],[17,108],[18,111],[19,115],[20,119],[21,123],[22,126],[24,134]],"15":[[7,60],[8,65],[10,75],[11,80],[12,85],[13,90],[14,95],[15,100],[16,105],[17,110],[18,115],[19,120],[20,125],[22,135],[23,140]]},"reasoning":{"10":[[1,70],[2,73],[3,76],[4,79],[5,82],[6,85],[7,88],[8,91],[9,94],[10,97],[11,100],[12,103],[13,106],[14,109],[15,112],[16,115],[17,118],[18,121],[19,124],[20,127],[21,130],[22,133],[23,136],[24,139]],"11":[[1,73],[2,75],[4,80],[5,83],[6,85],[7,88],[8,90],[9,93],[10,95],[12,100],[13,103],[14,105],[15,108],[16,110],[17,113],[18,115],[19,118],[20,120],[21,123],[23,128],[24,130],[25,133],[26,140]],"12":[[3,64],[4,67],[5,70],[6,73],[7,76],[8,79],[9,82],[10,85],[11,88],[12,91],[13,94],[14,97],[15,100],[16,103],[17,106],[18,109],[19,112],[20,115],[21,118],[22,121],[23,124],[24,127],[25,130],[27,136],[30,145]],"13":[[4,61],[5,64],[6,67],[7,70],[8,73],[9,76],[10,79],[11,82],[12,85],[13,88],[14,91],[15,94],[16,97],[17,100],[18,103],[19,106],[20,109],[21,112],[22,115],[23,118],[24,121],[25,124],[26,127],[27,130]],"14":[[2,49],[4,53],[5,58],[8,67],[9,70],[12,79],[13,82],[14,85],[15,88],[16,91],[17,94],[18,97],[19,100],[20,103],[21,106],[22,109],[23,112],[24,115],[25,118],[26,121],[27,124],[28,127],[29,130],[30,133]],"15":[[8,67],[10,73],[12,79],[14,85],[15,88],[16,91],[17,94],[18,97],[19,100],[20,103],[21,106],[22,109],[23,112],[24,115],[25,118],[26,121],[27,124],[30,133]]}};
const SAGES_Q_TO_P={"140":99,"139":99,"138":99,"137":99,"136":99,"135":99,"134":99,"133":99,"132":98,"131":98,"130":98,"129":97,"128":97,"127":96,"126":96,"125":95,"124":95,"123":94,"122":93,"121":92,"120":91,"119":89,"118":89,"117":87,"116":85,"115":84,"114":82,"113":80,"112":79,"111":77,"110":74,"109":73,"108":70,"107":67,"106":66,"105":64,"104":61,"103":58,"102":55,"101":52,"100":50,"99":48,"98":45,"97":42,"96":39,"95":36,"94":35,"93":32,"92":29,"91":27,"90":25,"89":23,"88":21,"87":19,"86":17,"85":16,"84":14,"83":13,"82":12,"81":10,"80":9,"79":8,"78":7,"77":6,"76":6,"75":5,"74":4,"73":4,"72":3,"71":3,"70":2,"69":2,"68":2,"67":1,"66":1,"65":1};

function nearestPairByFirst(pairs,value){
  if(!pairs||!pairs.length)return null;
  let best=pairs[0],bestDist=Math.abs(Number(value)-best[0]);
  for(const pair of pairs){
    const d=Math.abs(Number(value)-pair[0]);
    // Si hay empate, usa el puntaje inferior para no inflar el resultado.
    if(d<bestDist||(d===bestDist&&pair[0]<best[0])){best=pair;bestDist=d}
  }
  return {pair:best,distance:bestDist,exact:bestDist===0};
}

function nearestPercentileForQuotient(q){
  const qn=Number(q);
  if(Number.isFinite(qn)&&Object.prototype.hasOwnProperty.call(SAGES_Q_TO_P,qn))
    return {percentile:SAGES_Q_TO_P[qn],source_quotient:qn,exact:true};
  const keys=Object.keys(SAGES_Q_TO_P).map(Number);
  if(!keys.length||!Number.isFinite(qn))return null;
  let best=keys[0],dist=Math.abs(qn-best);
  for(const k of keys){
    const d=Math.abs(qn-k);
    if(d<dist||(d===dist&&k<best)){best=k;dist=d}
  }
  return {percentile:SAGES_Q_TO_P[best],source_quotient:best,exact:false};
}

function sagesLocalSubscale(age,raw,type){
  const pairs=SAGES_RAW_TO_Q[type]?.[Number(age)];
  const nearest=nearestPairByFirst(pairs,Number(raw));
  if(!nearest)return null;
  const [sourceRaw,q]=nearest.pair;
  const pc=nearestPercentileForQuotient(q);
  if(!pc)return null;
  const p=pc.percentile;
  const approximated=!nearest.exact||!pc.exact;
  let norm_note='';
  if(!nearest.exact){
    norm_note=`La tabla no publica conversión exacta para PD ${raw}; se usa la puntuación normativa más próxima (PD ${sourceRaw}).`;
  }
  if(!pc.exact){
    norm_note+=(norm_note?' ':'')+`El cociente ${q} no tiene percentil exacto en la tabla; se usa el percentil del cociente más próximo (${pc.source_quotient}).`;
  }
  return {
    raw_score:Number(raw), quotient:q, percentile:p,
    level:p>=90?'Aptitud sobresaliente':'', outstanding:p>=90,
    approximated, source_raw_score:sourceRaw, source_percentile_quotient:pc.source_quotient, norm_note
  };
}

function sagesLocalPreview(payload){
  const language=sagesLocalSubscale(payload.age,payload.language,'language');
  const reasoning=sagesLocalSubscale(payload.age,payload.reasoning,'reasoning');
  if(!language||!reasoning)return null;
  return {ok:true,local_conversion:true,age:{age_years:payload.age},language,reasoning};
}

function normalizeSagesResult(r,payload){
  // La tabla local es la misma tabla de referencia del proyecto. Completa huecos
  // con el valor normativo más próximo, como se acordó para las celdas vacías.
  const local=sagesLocalPreview(payload);
  if(!local)return r;
  if(!r||!r.ok)return local;
  const merge=(server,loc)=>{
    const x={...(loc||{}),...(server||{})};
    if(x.quotient==null||x.quotient==='')x.quotient=loc.quotient;
    if(x.percentile==null||x.percentile==='')x.percentile=loc.percentile;
    if(!x.level&&loc.level)x.level=loc.level;
    if(!x.norm_note&&loc.norm_note)x.norm_note=loc.norm_note;
    if(loc.approximated)x.approximated=true;
    if(loc.outstanding)x.outstanding=true;
    return x;
  };
  return {...r,ok:true,age:r.age||local.age,language:merge(r.language,local.language),reasoning:merge(r.reasoning,local.reasoning)};
}

function showSagesResult(r){
  const box=$("#sagesResult");
  const age=r.age||{};
  const lang=r.language||{};
  const reas=r.reasoning||{};

  const percentileInterpretation=(x)=>{
    const p=x.percentile;
    if(p===null||p===undefined||p==="")return "Sin interpretación percentilar disponible.";
    const n=Number(p);
    if(!Number.isFinite(n))return `Percentil ${esc(p)}.`;
    const extra=n>=90?' <b>Aptitud sobresaliente.</b>':'';
    return `Percentil ${n}: aproximadamente ${n}% de la distribución normativa obtuvo una puntuación igual o inferior.${extra}`;
  };
  const resultBox=(title,x)=>`<div class="resultBox">
    <h3>${esc(title)}</h3>
    <p><b>PD:</b> ${esc(x.raw_score??"—")}</p>
    <p><b>Cociente:</b> ${esc(x.quotient_display??x.quotient??"—")}</p>
    <p><b>Percentil:</b> ${esc(x.percentile_display??x.percentile??"—")}</p>
    ${x.level?`<p><b>Resultado:</b> ${esc(x.level)}</p>`:''}
    <p class="percentileNote"><b>Interpretación:</b> ${percentileInterpretation(x)}</p>
    ${x.norm_note?`<p class="percentileNote"><b>Nota de conversión:</b> ${esc(x.norm_note)}</p>`:''}
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

    const server=await rpc("teacher_diagnostic_sages_preview",{
      p_student_id:activeStudentBundle.student.id,
      p_age_years:p.age,
      p_language_raw:p.language,
      p_reasoning_raw:p.reasoning,
      p_application_date:p.date
    });

    const r=normalizeSagesResult(server,p);
    if(!r||!r.ok){
      $("#sagesStatus").textContent="No fue posible convertir SAGES con la tabla cargada.";
      $("#sagesResult").classList.add("hidden");
      return;
    }
    showSagesResult(r);
    const approx=r.language?.approximated||r.reasoning?.approximated;
    $("#sagesStatus").textContent=approx
      ?"Vista previa calculada. En los huecos de la tabla se aplicó el valor normativo más próximo."
      :"Vista previa calculada. Aún no se ha guardado.";
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
      const local=sagesLocalPreview(p);
      if(local)showSagesResult(local);
      $("#sagesStatus").textContent="El cálculo es válido, pero la rutina de Supabase no aceptó esta conversión aproximada. Avísame si aparece este mensaje para corregir también la rutina de guardado.";
      return;
    }

    showSagesResult(normalizeSagesResult(r,p));
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
let lecturaAnswers={};

const LECTURA_TESTS={
  "0":{title:"El mercader de Bagdad",words:951},
  "A":{title:"Achoque el escogido",words:1084},
  "B":{title:"La Leyenda de la lechuza",words:1091},
  "C":{title:"Marie Curie",words:1047}
};

function lecturaOptionsForMoment(moment){
  return moment==="initial"
    ? ["0"]
    : ["A","B","C"];
}

function renderLecturaTestOptions(){
  const moment=$("#lecturaMoment").value||"initial";
  const options=lecturaOptionsForMoment(moment);
  const current=$("#lecturaTestCode").value;
  $("#lecturaTestCode").innerHTML=options.map(code=>{
    const t=LECTURA_TESTS[code];
    return `<option value="${code}">Prueba ${code} · ${esc(t.title)}</option>`;
  }).join("");
  if(options.includes(current))$("#lecturaTestCode").value=current;
  renderLecturaMeta();
}

function renderLecturaMeta(){
  const code=$("#lecturaTestCode").value;
  const t=LECTURA_TESTS[code];
  $("#lecturaTestMeta").textContent=t
    ? `Prueba ${code} · ${t.title} · ${t.words} palabras · 20 reactivos`
    : "";
}

function renderLecturaItems(){
  const box=$("#lecturaItems");
  box.innerHTML=Array.from({length:20},(_,i)=>{
    const n=i+1;
    return `<div class="complecItem" data-item="${n}">
      <div class="complecItemHead"><b>Reactivo ${n}</b></div>
      <div class="answerGroup">
        ${["A","B","C"].map(o=>`<button type="button" class="answerBtn ${lecturaAnswers[n]===o?"selected":""}" data-answer="${o}">${o}</button>`).join("")}
      </div>
    </div>`;
  }).join("");
  box.querySelectorAll(".complecItem").forEach(item=>{
    const n=Number(item.dataset.item);
    item.querySelectorAll(".answerBtn").forEach(btn=>{
      btn.onclick=()=>{
        lecturaAnswers[n]=btn.dataset.answer;
        item.querySelectorAll(".answerBtn").forEach(x=>x.classList.toggle("selected",x===btn));
        updateLecturaProgress();
      };
    });
  });
}

function updateLecturaProgress(){
  const count=Object.keys(lecturaAnswers).filter(k=>lecturaAnswers[k]).length;
  $("#lecturaProgressText").textContent=`${count} de 20 respondidas`;
  $("#lecturaProgressBar").style.width=`${count/20*100}%`;
}

function lecturaSecondsTotal(){
  const min=Number($("#lecturaMinutes").value||0);
  const sec=Number($("#lecturaSeconds").value||0);
  if(!Number.isInteger(min)||min<0)throw new Error("Los minutos de lectura no son válidos.");
  if(!Number.isInteger(sec)||sec<0||sec>59)throw new Error("Los segundos deben estar entre 0 y 59.");
  const total=min*60+sec;
  if(total<=0)throw new Error("Captura el tiempo empleado en la lectura.");
  return total;
}

function lecturaAnswersPayload(){
  const missing=[];
  const arr=[];
  for(let n=1;n<=20;n++){
    if(!lecturaAnswers[n])missing.push(n);
    arr.push(lecturaAnswers[n]||null);
  }
  if(missing.length)throw new Error(`Faltan respuestas: ${missing.join(", ")}.`);
  return arr;
}

function lecturaCurrentApplication(){
  const moment=$("#lecturaMoment").value||"initial";
  return activeLecturaApplications.find(x=>x.moment===moment)||null;
}

function loadLecturaApplicationIntoForm(){
  const moment=$("#lecturaMoment").value||"initial";
  renderLecturaTestOptions();
  const saved=activeLecturaApplications.find(x=>x.moment===moment);

  lecturaAnswers={};
  $("#lecturaMinutes").value=0;
  $("#lecturaSeconds").value=0;
  $("#lecturaDate").value=todayISO();
  $("#lecturaResult").classList.add("hidden");

  if(saved){
    $("#lecturaTestCode").value=saved.test_code;
    renderLecturaMeta();
    const total=Number(saved.reading_seconds||0);
    $("#lecturaMinutes").value=Math.floor(total/60);
    $("#lecturaSeconds").value=total%60;
    $("#lecturaDate").value=saved.applied_at||todayISO();
    if(Array.isArray(saved.answers)){
      saved.answers.forEach((v,i)=>{if(v)lecturaAnswers[i+1]=v});
    }
    $("#lecturaStatus").textContent=`${moment==="initial"?"Aplicación inicial":"Aplicación final"} guardada. Puedes editarla y volver a guardar.`;
    showLecturaResult(saved);
  }else{
    $("#lecturaStatus").textContent="";
  }
  renderLecturaItems();
  updateLecturaProgress();
}

function openLectura(){
  if(!activeStudentBundle)return;
  const b=activeStudentBundle;
  $("#studentCard").classList.add("hidden");
  $("#lecturaCard").classList.remove("hidden");
  $("#lecturaStudentName").textContent=b.student.name;
  $("#lecturaStudentMeta").textContent=`Grupo ${b.student.group_name} · Lista ${b.student.list_number??"—"} · ID ${b.student.id}`;
  $("#lecturaMoment").value="initial";
  loadLecturaApplicationIntoForm();
}

function showLecturaResult(r){
  const moment=r.moment||$("#lecturaMoment").value;
  const test=r.test||{code:r.test_code,title:r.test_title,word_count:r.word_count};
  $("#lecturaResult").innerHTML=`
    <div class="complecSummary">
      <div class="resultBox wide">
        <h3>${moment==="initial"?"Lectura inicial":"Lectura final"} · Prueba ${esc(test.code||"—")}</h3>
        <p><b>${esc(test.title||"")}</b></p>
        <p class="muted">${esc(test.word_count||"—")} palabras</p>
      </div>
      <div class="resultBox"><h3>VE</h3><p><b>${esc(r.ve??"—")}</b></p><small>palabras por minuto</small></div>
      <div class="resultBox"><h3>CL</h3><p><b>${esc(r.cl??"—")}%</b></p><small>comprensión lectora</small></div>
      <div class="resultBox"><h3>EL</h3><p><b>${esc(r.el??"—")}</b></p><small>palabras leídas y comprendidas/min</small></div>
      <div class="resultBox"><h3>Referencia docente</h3><p><b>${esc(r.teacher_level||"—")}</b></p></div>
      <div class="resultBox"><h3>Aciertos / errores</h3><p><b>${esc(r.correct_count??"—")} / ${esc(r.error_count??"—")}</b></p></div>
    </div>`;
  $("#lecturaResult").classList.remove("hidden");
}

async function previewLectura(){
  try{
    if(!activeStudentBundle)throw new Error("No hay alumno seleccionado.");
    const moment=$("#lecturaMoment").value;
    const testCode=$("#lecturaTestCode").value;
    const seconds=lecturaSecondsTotal();
    const answers=lecturaAnswersPayload();
    $("#lecturaStatus").textContent="Calculando…";
    const r=await rpc("teacher_diagnostic_lectura_eficaz_preview",{
      p_student_id:activeStudentBundle.student.id,
      p_moment:moment,
      p_test_code:testCode,
      p_reading_seconds:seconds,
      p_answers:answers
    });
    showLecturaResult(r);
    $("#lecturaStatus").textContent="Vista previa calculada. Aún no se ha guardado.";
  }catch(e){
    $("#lecturaStatus").textContent=e.message||String(e);
  }
}

async function saveLectura(){
  try{
    if(!activeStudentBundle)throw new Error("No hay alumno seleccionado.");
    const moment=$("#lecturaMoment").value;
    const testCode=$("#lecturaTestCode").value;
    const seconds=lecturaSecondsTotal();
    const answers=lecturaAnswersPayload();
    $("#lecturaStatus").textContent="Guardando…";
    const r=await rpc("teacher_diagnostic_save_lectura_eficaz",{
      p_period_id:activePeriod.id,
      p_student_id:activeStudentBundle.student.id,
      p_moment:moment,
      p_test_code:testCode,
      p_reading_seconds:seconds,
      p_answers:answers,
      p_applied_at:$("#lecturaDate").value||todayISO()
    });
    if(!r.saved)throw new Error(r.reason||"No se pudo guardar Lectura Eficaz.");
    showLecturaResult(r);
    $("#lecturaStatus").textContent="✓ Lectura Eficaz guardada correctamente.";

    activeLecturaApplications=await rpc("teacher_diagnostic_lectura_eficaz_applications",{
      p_period_id:activePeriod.id,
      p_student_id:activeStudentBundle.student.id
    })||[];

    const initialLE=activeLecturaApplications.find(x=>x.moment==="initial");
    const finalLE=activeLecturaApplications.find(x=>x.moment==="final");
    $("#lecturaState").textContent=initialLE
      ? (finalLE?"Inicial + Final":"Inicial completa")
      : "Pendiente";
  }catch(e){
    $("#lecturaStatus").textContent=e.message||String(e);
  }
}

$("#openLecturaBtn").onclick=openLectura;
$("#backStudentFromLectura").onclick=()=>{
  $("#lecturaCard").classList.add("hidden");
  $("#studentCard").classList.remove("hidden");
};
$("#lecturaMoment").onchange=loadLecturaApplicationIntoForm;
$("#lecturaTestCode").onchange=renderLecturaMeta;
$("#previewLecturaBtn").onclick=previewLectura;
$("#saveLecturaBtn").onclick=saveLectura;


function proescGradeFromGroup(group,studentId){
  if(String(studentId||"").trim()==="00001" && String(group||"").trim().toUpperCase()==="MONITOR"){
    return {grade:2,label:"2.º de secundaria · alumno de prueba"};
  }
  const n=Number(String(group||"").trim());
  if(Number.isInteger(n)&&n>=11&&n<=16)return {grade:1,label:"1.º de secundaria"};
  if(Number.isInteger(n)&&n>=21&&n<=26)return {grade:2,label:"2.º de secundaria"};
  if(Number.isInteger(n)&&n>=31&&n<=36)return {grade:3,label:"3.º de secundaria"};
  return {grade:null,label:"Grupo no reconocido"};
}

function clearProescForm(){
  ["#proescWords","#proescPseudo","#proescRules","#proescAccents","#proescCaps","#proescPunct","#proescWritingContent","#proescWritingPresentation"].forEach(sel=>$(sel).value="");
  $("#proescResult").classList.add("hidden");
}
function loadProescMoment(){
  clearProescForm();
  const moment=$("#proescMoment").value||"initial";
  const saved=activeProescApplications.find(x=>x.moment===moment);
  $("#proescDate").value=saved?.application_date||todayISO();
  if(saved){
    $("#proescWords").value=saved.words_score??"";
    $("#proescPseudo").value=saved.pseudowords_score??"";
    $("#proescRules").value=saved.orthographic_rules_score??"";
    $("#proescAccents").value=saved.accents_score??"";
    $("#proescCaps").value=saved.capitals_score??"";
    $("#proescPunct").value=saved.punctuation_score??"";
    $("#proescWritingContent").value=saved.writing_content??"";
    $("#proescWritingPresentation").value=saved.writing_presentation??"";
    if(saved.result_payload)showProescResult(saved.result_payload);
    $("#proescStatus").textContent=`${moment==="initial"?"Aplicación inicial":"Aplicación final"} guardada. Puedes editarla y volver a guardar.`;
  }else{
    $("#proescStatus").textContent=moment==="final"
      ?"Aún no hay aplicación final guardada."
      :"Aún no hay aplicación inicial guardada.";
  }
}

async function openProesc(){
  if(!activeStudentBundle)return;
  const b=activeStudentBundle;
  $("#studentCard").classList.add("hidden");
  $("#followupCard")?.classList.add("hidden");
  $("#sagesCard").classList.add("hidden");
  $("#lecturaCard").classList.add("hidden");
  $("#proescCard").classList.remove("hidden");

  $("#proescStudentName").textContent=b.student.name;
  $("#proescStudentMeta").textContent=`Grupo ${b.student.group_name} · Lista ${b.student.list_number??"—"} · ID ${b.student.id}`;

  const gr=proescGradeFromGroup(b.student.group_name,b.student.id);
  $("#proescGradeNote").textContent=gr.grade
    ? `${gr.label}: la app aplicará automáticamente el baremo PROESC correspondiente.`
    : "El código de grupo no permite determinar automáticamente el grado.";

  try{
    activeProescApplications=await rpc("teacher_diagnostic_proesc_applications",{
      p_period_id:activePeriod.id,
      p_student_id:b.student.id
    })||[];
  }catch(e){
    activeProescApplications=[];
    console.warn("proesc applications",e);
  }

  $("#proescMoment").value="initial";
  loadProescMoment();
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
    const moment=$("#proescMoment").value||"initial";
    $("#proescStatus").textContent="Guardando…";
    const r=await rpc("teacher_diagnostic_save_proesc_moment",{
      p_period_id:activePeriod.id,
      p_student_id:activeStudentBundle.student.id,
      p_moment:moment,
      p_words_score:p.words,
      p_pseudowords_score:p.pseudo,
      p_orthographic_rules_score:p.rules,
      p_accents_score:p.accents,
      p_capitals_score:p.caps,
      p_punctuation_score:p.punct,
      p_writing_content:p.wc,
      p_writing_presentation:p.wp,
      p_application_date:$("#proescDate").value||todayISO()
    });
    if(!r.saved)throw new Error(r.reason||"No se pudo guardar PROESC.");
    showProescResult(r);
    $("#proescStatus").textContent=`✓ PROESC ${moment==="initial"?"Inicial":"Final"} guardado correctamente.`;

    activeProescApplications=await rpc("teacher_diagnostic_proesc_applications",{
      p_period_id:activePeriod.id,
      p_student_id:activeStudentBundle.student.id
    })||[];

    if(moment==="initial"){
      activeStudentBundle=await rpc("teacher_diagnostic_student_bundle",{
        p_period_id:activePeriod.id,
        p_student_id:activeStudentBundle.student.id
      });
    }

    const ini=activeProescApplications.some(x=>x.moment==="initial");
    const fin=activeProescApplications.some(x=>x.moment==="final");
    $("#proescState").textContent=ini?(fin?"Inicial + Final":"Inicial completa"):"Pendiente";
  }catch(e){$("#proescStatus").textContent=e.message||String(e)}
}

$("#openProescBtn").onclick=openProesc;
$("#backStudentFromProesc").onclick=()=>{
  if(activeStudentBundle){
    $("#proescCard").classList.add("hidden");
    $("#studentCard").classList.remove("hidden");
  }
};
$("#proescMoment").onchange=loadProescMoment;
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
  $("#lecturaCard").classList.add("hidden");
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



function changeBadge(v,suffix=""){
  const n=Number(v);
  if(!Number.isFinite(n))return "—";
  const sign=n>0?"+":"";
  return `${sign}${Math.round(n*100)/100}${suffix}`;
}
function renderFollowupComparison(d){
  latestFollowupComparison=d;
  const le=d?.lectura||{};
  const pr=d?.escritura||{};
  const readingAvailable=le.initial_available&&le.final_available;
  const writingAvailable=pr.initial_available&&pr.final_available;

  const readingHtml=readingAvailable?`
    <div class="followupBox">
      <h3>Lectura · Inicial vs. Final</h3>
      <div class="followupMetrics">
        <div><small>VE</small><b>${esc(le.initial?.ve??"—")} → ${esc(le.final?.ve??"—")}</b><span>${esc(changeBadge(le.change?.ve))}</span></div>
        <div><small>CL</small><b>${esc(le.initial?.cl??"—")}% → ${esc(le.final?.cl??"—")}%</b><span>${esc(changeBadge(le.change?.cl,"%"))}</span></div>
        <div><small>EL</small><b>${esc(le.initial?.el??"—")} → ${esc(le.final?.el??"—")}</b><span>${esc(changeBadge(le.change?.el))}</span></div>
      </div>
    </div>`:
    `<div class="followupBox"><h3>Lectura</h3><p class="muted">La comparación estará disponible cuando existan aplicaciones Inicial y Final.</p></div>`;

  const writingFields=[
    ["Palabras","words_score"],
    ["Pseudopalabras","pseudowords_score"],
    ["Reglas ortográficas","orthographic_rules_score"],
    ["Acentos","accents_score"],
    ["Mayúsculas","capitals_score"],
    ["Puntuación","punctuation_score"],
    ["Redacción","writing_total"]
  ];

  const writingHtml=writingAvailable?`
    <div class="followupBox">
      <h3>Escritura · Inicial vs. Final</h3>
      <div class="followupWriting">${writingFields.map(([label,key])=>`
        <div><b>${esc(label)}</b><span>${esc(pr.initial?.[key]??"—")} → ${esc(pr.final?.[key]??"—")}</span><strong>${esc(changeBadge(pr.change?.[key]))}</strong></div>
      `).join("")}</div>
    </div>`:
    `<div class="followupBox"><h3>Escritura</h3><p class="muted">La comparación estará disponible cuando existan aplicaciones Inicial y Final.</p></div>`;

  $("#followupContent").innerHTML=`
    <div class="followupGrid">${readingHtml}${writingHtml}</div>
    <div class="disclaimerBox">${d.comparison_available
      ?"Comparación disponible. Los cambios deben interpretarse junto con el trabajo realizado durante el ciclo escolar."
      :"El seguimiento se completará cuando estén guardadas las aplicaciones finales de Lectura Eficaz y PROESC."}</div>`;
}
async function openFollowup(){
  if(!activeStudentBundle)return;
  $("#studentCard").classList.add("hidden");
  $("#sagesCard").classList.add("hidden");
  $("#lecturaCard").classList.add("hidden");
  $("#proescCard").classList.add("hidden");
  $("#casmCard").classList.add("hidden");
  $("#integratedCard").classList.add("hidden");
  $("#followupCard").classList.remove("hidden");
  $("#followupStudentName").textContent=activeStudentBundle.student.name;
  $("#followupStudentMeta").textContent=`Grupo ${activeStudentBundle.student.group_name} · ID ${activeStudentBundle.student.id}`;
  $("#followupStatus").textContent="Consultando seguimiento…";
  try{
    const d=await rpc("teacher_diagnostic_followup_comparison",{
      p_period_id:activePeriod.id,
      p_student_id:activeStudentBundle.student.id
    });
    renderFollowupComparison(d);
    $("#followupStatus").textContent=d.comparison_available
      ?"✓ Comparativa Inicial vs. Final disponible."
      :"Seguimiento preparado. Faltan una o más aplicaciones finales.";
  }catch(e){
    $("#followupStatus").textContent=e.message||String(e);
  }
}
$("#openFollowupBtn").onclick=openFollowup;
$("#backStudentFromFollowup").onclick=()=>{
  $("#followupCard").classList.add("hidden");
  $("#studentCard").classList.remove("hidden");
};

function integratedPriorityLabel(v){
  if(v==="seguimiento_prioritario")return "Seguimiento prioritario";
  if(v==="seguimiento")return "Seguimiento";
  return "Seguimiento ordinario";
}
function integratedFriendlyItem(x){
  const source=String(x?.source||"");
  const rawArea=String(x?.area||"");
  const info=reportFriendlyAreaInfo(rawArea);
  let title=rawArea||source;
  let text=String(x?.text||"");
  text=text
    .replace(/\bLectura\s+Eficaz\b/gi,"")
    .replace(/\bCompLEC\b/gi,"");

  // CASM-85-R: nunca mostrar claves Área I–V en el resultado individual.
  if(source.toUpperCase().includes("CASM") || /^\s*á?rea\s+(i{1,3}|iv|v)\s*$/i.test(rawArea)){
    title=info.title;
    const areaRoman=(rawArea.match(/(?:área|area)\s+(iv|v|iii|ii|i)(?:\s|$|:)/i)||[])[1];
    if(areaRoman){
      const re=new RegExp(`CASM-85-R\\s+(?:Á|A)rea\\s+${areaRoman}\\s*:?`,"ig");
      text=text.replace(re,`${info.title}:`);
    }
  }

  return {...x,displayArea:title,displayText:text};
}
function renderIntegratedList(items,emptyText){
  if(!Array.isArray(items)||!items.length)return `<p class="muted">${esc(emptyText)}</p>`;
  return `<div class="integratedList">${items.map(original=>{
    const x=integratedFriendlyItem(original);
    return `
    <div class="integratedItem">
      <b>${esc(x.displayArea||x.source||"")}</b>
      <div>${esc(x.displayText||"")}</div>
      ${x.source?`<small>${esc(x.source)}</small>`:""}
    </div>`;
  }).join("")}</div>`;
}
function sagesIntegratedLabel(x,label){
  const p=Number(x?.percentile);
  const suffix=Number.isFinite(p)&&p>=90?' · Aptitud sobresaliente':'';
  return `${label}: P${esc(x?.percentile??"—")}${suffix}`;
}
function renderIntegratedTechnical(t){
  const sg=t?.sages||{};
  const le=t?.lectura_eficaz||{};
  const pr=t?.proesc||{};
  const ca=t?.casm||{};
  return `
    <div class="testMiniGrid">
      <div class="testMini"><b>SAGES-2</b><br>
        ${sagesIntegratedLabel(sg?.language,"Lengua")} · ${sagesIntegratedLabel(sg?.reasoning,"Razonamiento")}
      </div>
      <div class="testMini"><b>Lectura Eficaz · Inicial</b><br>
        VE: ${esc(le?.ve??"—")} · CL: ${esc(le?.cl??"—")}% · EL: ${esc(le?.el??"—")}<br>
        <small>${esc(le?.teacher_level||"—")}</small>
      </div>
      <div class="testMini"><b>PROESC abreviado</b><br>
        Palabras: ${esc(pr?.scores?.words??"—")}/25 · Redacción: ${esc(pr?.scores?.writing_total??"—")}/10
      </div>
      <div class="testMini"><b>CASM-85-R</b><br>
        Total: ${esc(ca?.scores?.TOTAL??"—")} / 53
      </div>
    </div>`;
}
let latestIntegratedTechnical=null;
let latestIntegratedSynthesis=null;

function showIntegratedResult(technical,syn){
  latestIntegratedTechnical=technical;
  latestIntegratedSynthesis=syn;
  const sg=technical?.sages||{};
  const strengths=Array.isArray(syn?.strengths)?syn.strengths.map(x=>({...x})):[];
  const ensureOutstanding=(sub,label)=>{
    const p=Number(sub?.percentile);
    if(!Number.isFinite(p)||p<90)return;
    const idx=strengths.findIndex(x=>String(x?.source||"").toUpperCase().includes("SAGES") && String(x?.area||"").toLowerCase().includes(label.toLowerCase().split(" ")[0]));
    const phrase=`Percentil ${p}. Aptitud sobresaliente en ${label}.`;
    if(idx>=0){
      if(!/aptitud sobresaliente/i.test(String(strengths[idx].text||""))) strengths[idx].text=`${strengths[idx].text||""} ${phrase}`.trim();
    }else{
      strengths.unshift({area:label,text:phrase,source:"SAGES-2"});
    }
  };
  ensureOutstanding(sg?.language,"Lengua y literatura / Ciencias sociales");
  ensureOutstanding(sg?.reasoning,"Razonamiento");

  $("#integratedContent").innerHTML=`
    <div class="integratedGrid">
      <div class="integratedBox wide">
        <h3>Resumen técnico</h3>
        ${renderIntegratedTechnical(technical)}
      </div>
      <div class="integratedBox wide">
        <h3>Prioridad de seguimiento</h3>
        <span class="priorityBadge">${esc(integratedPriorityLabel(syn.priority_level))}</span>
      </div>
      <div class="integratedBox">
        <h3>Fortalezas</h3>
        ${renderIntegratedList(strengths,"No se identificaron fortalezas destacadas con las reglas actuales.")}
      </div>
      <div class="integratedBox">
        <h3>Áreas por reforzar</h3>
        ${renderIntegratedList(syn.support_areas,"No se identificaron áreas específicas de refuerzo con las reglas actuales.")}
      </div>
      <div class="integratedBox wide">
        <h3>Recomendaciones</h3>
        ${renderIntegratedList(syn.recommendations,"No se generaron recomendaciones específicas.")}
      </div>
      <div id="integratedFollowupBox" class="integratedBox wide hidden">
        <h3>Seguimiento final</h3>
        <p class="muted">Comparación entre la aplicación inicial y final.</p>
        <div id="integratedFollowupContent"></div>
      </div>
    </div>
    <div class="disclaimerBox">${esc(syn.disclaimer||"Síntesis pedagógica para orientar el acompañamiento escolar.")}</div>`;
  $("#integratedContent").classList.remove("hidden");
}

function renderIntegratedFollowup(d){
  const box=$("#integratedFollowupBox");
  const content=$("#integratedFollowupContent");
  if(!box||!content)return;

  const le=d?.lectura||{};
  const pr=d?.escritura||{};
  const readingAvailable=le.initial_available&&le.final_available;
  const writingAvailable=pr.initial_available&&pr.final_available;

  if(!(readingAvailable||writingAvailable)){
    box.classList.add("hidden");
    content.innerHTML="";
    return;
  }

  box.classList.remove("hidden");

  const readingHtml=readingAvailable?`
    <div class="integratedFollowupItem">
      <b>Lectura</b>
      <div class="integratedFollowupMetrics">
        <span>VE: ${esc(le.initial?.ve??"—")} → ${esc(le.final?.ve??"—")}</span>
        <span>CL: ${esc(le.initial?.cl??"—")}% → ${esc(le.final?.cl??"—")}%</span>
        <span>EL: ${esc(le.initial?.el??"—")} → ${esc(le.final?.el??"—")}</span>
      </div>
      <p>${esc(familyReadingInterpretation(d))}</p>
    </div>`:"";

  const writingHtml=writingAvailable?`
    <div class="integratedFollowupItem">
      <b>Escritura</b>
      <div class="integratedFollowupMetrics">
        <span>Redacción: ${esc(pr.initial?.writing_total??"—")} → ${esc(pr.final?.writing_total??"—")}</span>
        <span>Palabras: ${esc(pr.initial?.words_score??"—")} → ${esc(pr.final?.words_score??"—")}</span>
        <span>Puntuación: ${esc(pr.initial?.punctuation_score??"—")} → ${esc(pr.final?.punctuation_score??"—")}</span>
      </div>
      <p>${esc(familyWritingInterpretation(d))}</p>
    </div>`:"";

  content.innerHTML=`<div class="integratedFollowupGrid">${readingHtml}${writingHtml}</div>`;
}

async function openIntegrated(){
  if(!activeStudentBundle)return;
  const b=activeStudentBundle;

  $("#studentCard").classList.add("hidden");
  $("#sagesCard").classList.add("hidden");
  $("#lecturaCard").classList.add("hidden");
  $("#proescCard").classList.add("hidden");
  $("#casmCard").classList.add("hidden");
  $("#integratedCard").classList.remove("hidden");

  $("#integratedStudentName").textContent=b.student.name;
  $("#integratedStudentMeta").textContent=`Grupo ${b.student.group_name} · Lista ${b.student.list_number??"—"} · ID ${b.student.id}`;
  $("#integratedContent").classList.add("hidden");
  $("#integratedStatus").textContent="Generando perfil integrado…";

  try{
    const integrated=await rpc("teacher_diagnostic_integrated_preview",{
      p_period_id:activePeriod.id,
      p_student_id:b.student.id
    });

    if(!integrated.complete){
      const missing=Array.isArray(integrated.missing_tests)?integrated.missing_tests.join(", "):"pruebas pendientes";
      $("#integratedStatus").textContent=`No se puede generar todavía. Faltan: ${missing}.`;
      return;
    }

    const syn=await rpc("teacher_diagnostic_generate_synthesis",{
      p_period_id:activePeriod.id,
      p_student_id:b.student.id
    });

    if(!syn.ok||!syn.saved)throw new Error(syn.reason||"No se pudo generar la síntesis.");

    showIntegratedResult(integrated.technical_summary,syn);

    try{
      const follow=await rpc("teacher_diagnostic_followup_comparison",{
        p_period_id:activePeriod.id,
        p_student_id:b.student.id
      });
      renderIntegratedFollowup(follow);
    }catch(e){
      console.warn("integrated followup",e);
      $("#integratedFollowupBox")?.classList.add("hidden");
    }

    await refreshDiagnosticPublication();
    $("#integratedStatus").textContent="✓ Perfil integrado generado y guardado.";
  }catch(e){
    $("#integratedStatus").textContent=e.message||String(e);
  }
}

$("#openIntegratedBtn").onclick=openIntegrated;
$("#backStudentFromIntegrated").onclick=()=>{
  $("#integratedCard").classList.add("hidden");
  $("#studentCard").classList.remove("hidden");
};


function priorityGroupLabel(v){
  if(v==="seguimiento_prioritario")return "Prioritario";
  if(v==="seguimiento")return "Seguimiento";
  if(v==="ordinario")return "Ordinario";
  return "Pendiente";
}
function topItemsHtml(items){
  if(!Array.isArray(items)||!items.length)return '<p class="muted">Todavía no hay datos suficientes.</p>';
  return `<div class="topList">${items.map(x=>{
    const info=reportFriendlyAreaInfo(x.area||"");
    return `<div class="topItem"><span>${esc(info.title)}</span><b>${esc(x.occurrences)} · ${esc(x.percent_of_profiles)}%</b></div>`;
  }).join("")}</div>`;
}
function renderGroupStudents(rows){
  if(!Array.isArray(rows)||!rows.length)return '<p class="muted">No hay alumnos en este grupo.</p>';
  return `<div style="overflow:auto"><table class="studentStatusTable">
    <thead><tr><th>Lista</th><th>Alumno</th><th>Pruebas</th><th>Perfil</th><th>Seguimiento</th></tr></thead>
    <tbody>${rows.map(r=>`
      <tr>
        <td>${esc(r.list_number??"—")}</td>
        <td>${esc(r.student_name)}</td>
        <td>${r.all_tests_complete?"✓ Completo":"Pendiente"}</td>
        <td>${r.integrated_ready?"✓ Generado":"Pendiente"}</td>
        <td><span class="badgeMini">${esc(priorityGroupLabel(r.priority_level))}</span></td>
      </tr>`).join("")}</tbody>
  </table></div>`;
}

let latestGroupOverview=null;
let latestGroupStudents=[];

function reportFriendlyPriority(v){
  if(v==="seguimiento_prioritario")return "Seguimiento prioritario";
  if(v==="seguimiento")return "Seguimiento";
  if(v==="ordinario")return "Seguimiento ordinario";
  return "Pendiente";
}
function reportFriendlyAreaInfo(raw){
  const v=String(raw||"").trim();
  const k=v.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-z0-9]+/g," ").trim();

  const map={
    "area i":{
      title:"Hábitos para estudiar",
      detail:"Forma en que el alumno organiza y realiza el estudio: lectura, repaso, atención a la información y estrategias para aprender."
    },
    "area ii":{
      title:"Realización de tareas",
      detail:"Hábitos relacionados con el cumplimiento de tareas, organización del trabajo, revisión y responsabilidad al realizarlas."
    },
    "area iii":{
      title:"Preparación para exámenes",
      detail:"Forma en que el alumno se organiza, repasa y distribuye el tiempo para prepararse antes de una evaluación."
    },
    "area iv":{
      title:"Atención y aprovechamiento de las clases",
      detail:"Hábitos para escuchar, atender explicaciones, identificar ideas importantes y aprovechar el trabajo realizado durante la clase."
    },
    "area v":{
      title:"Condiciones que acompañan el estudio",
      detail:"Factores que rodean el momento de estudiar, como organización del espacio, distractores, materiales y condiciones que favorecen o dificultan el trabajo."
    },
    "mayusculas":{
      title:"Uso de mayúsculas",
      detail:"Aplicación adecuada de mayúsculas al inicio de oraciones, en nombres propios y en otros casos que lo requieren."
    },
    "ortografia arbitraria":{
      title:"Ortografía de palabras de uso frecuente",
      detail:"Escritura correcta de palabras cuya ortografía se aprende principalmente mediante lectura, memoria visual y práctica."
    },
    "pseudopalabras":{
      title:"Relación entre sonidos y escritura",
      detail:"Capacidad para representar correctamente por escrito una secuencia de sonidos, incluso cuando se trata de palabras nuevas."
    },
    "reglas ortograficas en pseudopalabras":{
      title:"Aplicación de reglas ortográficas",
      detail:"Uso de reglas ortográficas al escribir palabras nuevas o poco familiares."
    },
    "razonamiento":{
      title:"Razonamiento",
      detail:"Capacidad para analizar información, encontrar relaciones entre ideas y utilizar lo aprendido para resolver situaciones nuevas."
    },
    "reflexion evaluacion":{
      title:"Comprensión y reflexión sobre lo leído",
      detail:"Capacidad para interpretar información, justificar respuestas, relacionar ideas y valorar el contenido o la forma de un texto."
    },
    "recuperacion de informacion":{
      title:"Localización de información en textos",
      detail:"Capacidad para encontrar datos, ideas y detalles que aparecen de manera explícita en una lectura."
    },
    "integracion de informacion":{
      title:"Integración de información",
      detail:"Capacidad para relacionar distintas partes de un texto y construir una comprensión global."
    },
    "redaccion":{
      title:"Expresión escrita",
      detail:"Capacidad para organizar, desarrollar y comunicar ideas por escrito de manera clara y comprensible."
    }
  };

  if(map[k])return map[k];
  // CASM: resolver el número romano como término completo. Evita que "Área II"
  // coincida por error con "Área I" y garantiza nombres descriptivos en pantalla/PDF.
  const areaMatch=k.match(/(?:^|\s)area\s+(i{1,3}|iv|v)(?:\s|$)/);
  if(areaMatch){
    const areaKey=`area ${areaMatch[1]}`;
    if(map[areaKey])return map[areaKey];
  }
  if(k.includes("mayus"))return map["mayusculas"];
  if(k.includes("ortograf")&&k.includes("arbitr"))return map["ortografia arbitraria"];
  if(k.includes("pseudo")&&k.includes("regla"))return map["reglas ortograficas en pseudopalabras"];
  if(k.includes("pseudo"))return map["pseudopalabras"];
  if(k.includes("razon"))return map["razonamiento"];
  if(k.includes("reflex")||k.includes("evaluac"))return map["reflexion evaluacion"];
  if(k.includes("recuper"))return map["recuperacion de informacion"];
  if(k.includes("integr"))return map["integracion de informacion"];
  if(k.includes("redac")||k.includes("escrit"))return map["redaccion"];

  return {
    title:v||"Aspecto escolar",
    detail:"Aspecto identificado a partir de los resultados integrados del diagnóstico inicial."
  };
}

function reportTopList(items,emptyText){
  if(!Array.isArray(items)||!items.length)return `<p>${esc(emptyText)}</p>`;
  return `<div class="reportConceptList">${items.map(x=>{
    const info=reportFriendlyAreaInfo(x.area||"");
    return `<div class="reportConcept">
      <b>${esc(info.title)}</b>
      <span>${esc(x.occurrences??0)} perfil(es) · ${esc(x.percent_of_profiles??0)}%</span>
      <p>${esc(info.detail)}</p>
    </div>`;
  }).join("")}</div>`;
}
function reportStudentRows(rows){
  const valid=(Array.isArray(rows)?rows:[]).filter(r=>r.integrated_ready);
  if(!valid.length)return '<p>No hay perfiles integrados para clasificar.</p>';
  return `<table><thead><tr><th>No.</th><th>Alumno</th><th>Seguimiento</th></tr></thead><tbody>${
    valid.map(r=>`<tr><td>${esc(r.list_number??"—")}</td><td>${esc(r.student_name)}</td><td>${esc(reportFriendlyPriority(r.priority_level))}</td></tr>`).join("")
  }</tbody></table>`;
}
function generateGroupDiagnosticReport(){
  const o=latestGroupOverview, rows=latestGroupStudents;
  if(!o||!activePeriod||!activeGroup){
    alert("Primero abre el panorama del grupo.");
    return;
  }
  const c=o.coverage||{}, p=o.priorities||{};
  const incomplete=Number(c.completion_percent||0)<100;

  let old=document.getElementById("groupPrintableReport");
  if(old)old.remove();

  const wrap=document.createElement("div");
  wrap.id="groupPrintableReport";
  wrap.className="printReportOverlay";
  wrap.innerHTML=`
    <div class="printReportToolbar">
      <button type="button" id="closeGroupReportBtn" class="secondary">← Volver</button>
      <button type="button" id="doPrintGroupReportBtn">Imprimir / Guardar como PDF</button>
    </div>
    <article class="printReportPage">
      <h1>Diagnóstico inicial del grupo ${esc(activeGroup)}</h1>
      <p><b>Periodo:</b> ${esc(activePeriod.name||"Diagnóstico inicial")}<br>
      <b>Fecha de generación:</b> ${new Date().toLocaleDateString("es-MX")}</p>

      ${incomplete?`<div class="printPartial"><b>REPORTE PARCIAL</b><br>Se ha integrado el ${esc(c.completion_percent??0)}% del grupo. Las conclusiones pueden cambiar cuando se complete el diagnóstico de los alumnos pendientes.</div>`:""}

      <h2>Cobertura</h2>
      <div class="printMetrics">
        <div><b>${esc(c.total_students??0)}</b><span>Alumnos</span></div>
        <div><b>${esc(c.integrated_profiles??0)}</b><span>Perfiles integrados</span></div>
        <div><b>${esc(c.pending_profiles??0)}</b><span>Pendientes</span></div>
        <div><b>${esc(c.completion_percent??0)}%</b><span>Cobertura</span></div>
      </div>

      <h2>Panorama general</h2>
      <p>${esc(o.summary_text||"")}</p>
      ${incomplete?`<p><b>Importante:</b> los porcentajes siguientes se calculan únicamente sobre los ${esc(c.integrated_profiles??0)} perfiles ya integrados, no sobre el total del grupo.</p>`:""}
      <p><b>Seguimiento ordinario:</b> ${esc(p.ordinario??0)} (${esc(p.ordinario_percent??0)}%) ·
      <b>Seguimiento:</b> ${esc(p.seguimiento??0)} (${esc(p.seguimiento_percent??0)}%) ·
      <b>Prioritario:</b> ${esc(p.seguimiento_prioritario??0)} (${esc(p.seguimiento_prioritario_percent??0)}%)</p>

      <h2>Cómo interpretar este reporte</h2>
      <div class="printInterpretation">
        <p><b>Los porcentajes no son calificaciones.</b> Indican qué proporción de los alumnos con perfil integrado presentó ese mismo aspecto.</p>
        <p><b>Fortalezas más frecuentes</b> señala habilidades o hábitos que aparecen de manera favorable en varios alumnos y que pueden aprovecharse en la planeación.</p>
        <p><b>Aspectos que conviene reforzar</b> muestra necesidades que se repiten en el grupo y que pueden convertirse en objetivos de trabajo durante las primeras semanas.</p>
        <p><b>Prioridades para la planeación</b> reúne los aspectos que conviene atender con actividades específicas, seguimiento y práctica sistemática.</p>
        <p><b>Seguimiento prioritario</b> no significa una calificación baja ni un diagnóstico clínico; indica que el alumno presenta varias necesidades pedagógicas que conviene observar y atender con mayor cercanía.</p>
      </div>

      <h2>Fortalezas más frecuentes</h2>
      ${reportTopList(o.top_strengths,"Todavía no hay información suficiente para identificar fortalezas grupales.")}

      <h2>Aspectos que conviene reforzar</h2>
      ${reportTopList(o.top_support_areas,"Todavía no hay información suficiente para identificar necesidades grupales.")}

      <h2>Prioridades para la planeación</h2>
      ${reportTopList(o.top_recommendations,"Todavía no hay recomendaciones grupales suficientes.")}

      <h2>Seguimiento por alumno</h2>
      ${reportStudentRows(rows)}

      <p class="printFoot">Este reporte es una herramienta pedagógica para orientar la planeación y el seguimiento escolar. Se construye únicamente con perfiles integrados y no constituye un diagnóstico clínico o psicológico.</p>
    </article>`;
  document.body.appendChild(wrap);

  document.getElementById("closeGroupReportBtn").onclick=()=>wrap.remove();
  document.getElementById("doPrintGroupReportBtn").onclick=()=>window.print();
}
async function openGroupDashboard(){
  if(!activePeriod||!activeGroup)return;

  $("#studentsCard").classList.add("hidden");
  $("#groupDashboardCard").classList.remove("hidden");
  $("#groupDashboardContent").classList.add("hidden");
  $("#groupDashboardTitle").textContent=`Grupo ${activeGroup}`;
  $("#groupDashboardMeta").textContent=activePeriod.name||"Periodo diagnóstico";
  $("#groupDashboardStatus").textContent="Calculando panorama grupal…";

  try{
    const [o,students]=await Promise.all([
      rpc("teacher_diagnostic_group_overview",{
        p_period_id:activePeriod.id,
        p_group_name:String(activeGroup)
      }),
      rpc("teacher_diagnostic_group_students",{
        p_period_id:activePeriod.id,
        p_group_name:String(activeGroup)
      })
    ]);
    if(!o.ok)throw new Error("No se pudo generar el panorama grupal.");
    latestGroupOverview=o;
    latestGroupStudents=students||[];

    const c=o.coverage||{}, p=o.priorities||{};
    $("#groupDashboardContent").innerHTML=`
      <div class="groupDashGrid">
        <div class="groupDashBox wide">
          <h3>Cobertura del diagnóstico</h3>
          <div class="metricRow">
            <div class="metric"><b>${esc(c.total_students??0)}</b>Alumnos</div>
            <div class="metric"><b>${esc(c.integrated_profiles??0)}</b>Perfiles integrados</div>
            <div class="metric"><b>${esc(c.pending_profiles??0)}</b>Pendientes</div>
            <div class="metric"><b>${esc(c.completion_percent??0)}%</b>Cobertura</div>
          </div>
          <p><b>${esc(o.coverage_label||"")}</b></p>
        </div>

        <div class="groupDashBox wide">
          <h3>Prioridad de seguimiento</h3>
          <div class="metricRow">
            <div class="metric"><b>${esc(p.ordinario??0)}</b>Ordinario<br><small>${esc(p.ordinario_percent??0)}%</small></div>
            <div class="metric"><b>${esc(p.seguimiento??0)}</b>Seguimiento<br><small>${esc(p.seguimiento_percent??0)}%</small></div>
            <div class="metric"><b>${esc(p.seguimiento_prioritario??0)}</b>Prioritario<br><small>${esc(p.seguimiento_prioritario_percent??0)}%</small></div>
          </div>
          <p>${esc(o.summary_text||"")}</p>
        </div>

        <div class="groupDashBox">
          <h3>Fortalezas más frecuentes</h3>
          ${topItemsHtml(o.top_strengths)}
        </div>
        <div class="groupDashBox">
          <h3>Áreas por reforzar más frecuentes</h3>
          ${topItemsHtml(o.top_support_areas)}
        </div>
        <div class="groupDashBox wide">
          <h3>Prioridades para la planeación</h3>
          ${topItemsHtml(o.top_recommendations)}
        </div>
        <div class="groupDashBox wide">
          <h3>Estado por alumno</h3>
          ${renderGroupStudents(students)}
        </div>
      </div>
      <div class="disclaimerBox">${esc(o.disclaimer||"")}</div>`;
    $("#groupDashboardContent").classList.remove("hidden");
    $("#groupDashboardStatus").textContent="✓ Panorama grupal actualizado.";
  }catch(e){
    $("#groupDashboardStatus").textContent=e.message||String(e);
  }
}
$("#printGroupDiagnosticBtn").onclick=generateGroupDiagnosticReport;
$("#openGroupDashboardBtn").onclick=openGroupDashboard;
$("#backFromGroupDashboard").onclick=()=>{
  $("#groupDashboardCard").classList.add("hidden");
  $("#studentsCard").classList.remove("hidden");
};



function familyPublishedText(original,section){
  const x=integratedFriendlyItem(original);
  const info=reportFriendlyAreaInfo(x.displayArea||x.area||"");
  const src=String(x.source||"").toUpperCase();
  const raw=String(x.displayText||"").trim();

  if(section==="strength"){
    if(src.includes("SAGES") && /aptitud sobresaliente/i.test(raw)){
      const m=raw.match(/percentil\s+(\d+(?:\.\d+)?)/i);
      return `Se identifica una aptitud sobresaliente en ${info.title}${m?` (percentil ${m[1]})`:""}.`;
    }
    if(src.includes("CASM")) return `${info.detail} En este diagnóstico se observa como una fortaleza.`;
    if(src.includes("PROESC") && /sin dificultad/i.test(raw)) return `${info.detail} En este diagnóstico se observa un desempeño favorable.`;
    if(src.includes("LECTURA EFICAZ")) return `${info.detail} Este proceso se ubica entre sus fortalezas de comprensión y eficacia lectora.`;
    return raw || info.detail;
  }

  if(section==="support"){
    return `Conviene reforzar ${info.detail.charAt(0).toLowerCase()+info.detail.slice(1)}`;
  }

  if(section==="recommendation"){
    return raw || info.detail;
  }
  return raw || info.detail;
}
function familyPrintList(items,emptyText,section){
  if(!Array.isArray(items)||!items.length)return `<p class="familyEmpty">${esc(emptyText)}</p>`;
  return `<div class="familyConceptList">${items.map(original=>{
    const x=integratedFriendlyItem(original);
    const info=reportFriendlyAreaInfo(x.displayArea||x.area||"");
    return `<section class="familyConcept"><h3>${esc(info.title)}</h3><p>${esc(familyPublishedText(original,section))}</p></section>`;
  }).join("")}</div>`;
}

function familyReadingInterpretation(followup){
  const r=followup?.lectura||{};
  if(!(r.initial_available&&r.final_available))return "";

  const dVE=Number(r.change?.ve);
  const dCL=Number(r.change?.cl);
  const dEL=Number(r.change?.el);

  let opening="";
  if(Number.isFinite(dEL)){
    if(dEL>=15) opening="Se observa un avance importante en la eficacia lectora respecto al punto de partida.";
    else if(dEL>0) opening="Se observa un avance ligero en la eficacia lectora respecto al punto de partida.";
    else if(dEL===0) opening="La eficacia lectora se mantuvo estable entre ambas aplicaciones.";
    else opening="En la aplicación final la eficacia lectora fue menor que al inicio, por lo que conviene mantener un acompañamiento cercano.";
  }else{
    opening="La comparación permite observar la evolución de la lectura entre el inicio y el cierre del seguimiento.";
  }

  let detail="";
  if(Number.isFinite(dVE)&&Number.isFinite(dCL)){
    const veTxt=dVE>0?"la velocidad de lectura mejoró":dVE<0?"la velocidad de lectura disminuyó":"la velocidad de lectura se mantuvo estable";
    const clTxt=dCL>0?"la comprensión también mejoró":dCL<0?"la comprensión mostró un resultado menor":"la comprensión se mantuvo estable";
    detail=`En particular, ${veTxt} y ${clTxt}.`;
  }

  let rec="";
  if(Number.isFinite(dVE)&&dVE>0 && Number.isFinite(dCL)&&dCL<=0){
    rec="Conviene continuar trabajando estrategias de comprensión para que el aumento en fluidez también se refleje en una mejor comprensión del texto.";
  }else if(Number.isFinite(dCL)&&dCL<0){
    rec="Se recomienda reforzar identificación de ideas principales, inferencias, relectura y explicación con palabras propias.";
  }else if(Number.isFinite(dEL)&&dEL>0){
    rec="Es recomendable mantener la práctica frecuente de lectura y comprensión para consolidar este progreso.";
  }else{
    rec="Conviene mantener lectura frecuente, relectura y preguntas de comprensión para favorecer un avance progresivo.";
  }

  return `${opening} ${detail} ${rec}`.replace(/\s+/g," ").trim();
}

function familyWritingInterpretation(followup){
  const w=followup?.escritura||{};
  if(!(w.initial_available&&w.final_available))return "";

  const ch=w.change||{};
  const dWriting=Number(ch.writing_total);
  const dWords=Number(ch.words_score);
  const dPseudo=Number(ch.pseudowords_score);
  const dRules=Number(ch.orthographic_rules_score);
  const dAcc=Number(ch.accents_score);
  const dCaps=Number(ch.capitals_score);
  const dPunct=Number(ch.punctuation_score);

  const vals=[dWriting,dWords,dPseudo,dRules,dAcc,dCaps,dPunct].filter(Number.isFinite);
  const positives=vals.filter(v=>v>0).length;
  const negatives=vals.filter(v=>v<0).length;

  let opening="";
  if(positives>=4 && negatives===0) opening="Se observa un avance favorable en la escritura.";
  else if(positives>negatives) opening="Se observan avances en varios aspectos de la escritura.";
  else if(positives===0 && negatives===0) opening="El desempeño escrito se mantuvo estable entre ambas aplicaciones.";
  else if(negatives>positives) opening="La aplicación final muestra áreas de escritura que requieren continuar reforzándose.";
  else opening="El desempeño escrito muestra cambios mixtos entre ambas aplicaciones.";

  const improvements=[];
  if(Number.isFinite(dWriting)&&dWriting>0) improvements.push("la redacción");
  if(Number.isFinite(dWords)&&dWords>0) improvements.push("la escritura correcta de palabras de uso frecuente");
  if(Number.isFinite(dRules)&&dRules>0) improvements.push("la aplicación de reglas ortográficas");
  if(Number.isFinite(dAcc)&&dAcc>0) improvements.push("el uso de acentos");
  if(Number.isFinite(dCaps)&&dCaps>0) improvements.push("el uso de mayúsculas");
  if(Number.isFinite(dPunct)&&dPunct>0) improvements.push("la puntuación");

  let detail="";
  if(improvements.length===1) detail=`Mejoró ${improvements[0]}.`;
  else if(improvements.length===2) detail=`Mejoraron ${improvements[0]} y ${improvements[1]}.`;
  else if(improvements.length>2) detail=`Se identificaron mejoras en ${improvements.slice(0,-1).join(", ")} y ${improvements.at(-1)}.`;

  let rec="Es recomendable continuar reforzando la revisión de textos, ortografía y puntuación para consolidar los progresos observados.";
  if(negatives>0){
    rec="Conviene continuar con práctica guiada de escritura y revisión de errores, dando especial atención a los aspectos que todavía muestran dificultad.";
  }

  return `${opening} ${detail} ${rec}`.replace(/\s+/g," ").trim();
}

async function generateIndividualDiagnosticReport(){
  if(!activePeriod||!activeStudentBundle||!latestIntegratedTechnical||!latestIntegratedSynthesis){
    alert("Primero abre el resultado integrado del alumno.");
    return;
  }
  const st=activeStudentBundle.student;
  const t=latestIntegratedTechnical;
  const syn=latestIntegratedSynthesis;
  const sg=t?.sages||{};
  let followup=null;
  try{
    followup=await rpc("teacher_diagnostic_followup_comparison",{
      p_period_id:activePeriod.id,
      p_student_id:activeStudentBundle.student.id
    });
  }catch(e){console.warn("followup PDF",e)}
  const strengths=Array.isArray(syn?.strengths)?syn.strengths.map(x=>({...x})):[];
  const ensureOutstanding=(sub,label)=>{
    const pct=Number(sub?.percentile);
    if(!Number.isFinite(pct)||pct<90)return;
    const idx=strengths.findIndex(x=>String(x?.source||"").toUpperCase().includes("SAGES") && String(x?.area||"").toLowerCase().includes(label.toLowerCase().split(" ")[0]));
    const phrase=`Se identifica aptitud sobresaliente en ${label} (percentil ${pct}).`;
    if(idx>=0){
      if(!/aptitud sobresaliente/i.test(String(strengths[idx].text||""))) strengths[idx].text=`${strengths[idx].text||""} ${phrase}`.trim();
    }else strengths.unshift({area:label,text:phrase,source:"SAGES-2"});
  };
  ensureOutstanding(sg?.language,"Lengua y literatura / Ciencias sociales");
  ensureOutstanding(sg?.reasoning,"Razonamiento");

  let old=document.getElementById("individualPrintableReport");
  if(old)old.remove();
  const wrap=document.createElement("div");
  wrap.id="individualPrintableReport";
  wrap.className="printReportOverlay familyReportOverlay parentMirrorReport";
  wrap.innerHTML=`
    <div class="printReportToolbar">
      <button type="button" id="closeIndividualReportBtn" class="secondary">← Volver</button>
      <button type="button" id="doPrintIndividualReportBtn">Imprimir / Guardar como PDF</button>
    </div>
    <article class="printReportPage familyReportPage parentMirrorPage">
      <header class="parentMirrorHeader">
        <img src="icon-192.png" alt="El Aula del Profe Jaime">
        <div><div class="parentMirrorBrand">El Aula del Profe Jaime</div><h1>Diagnóstico inicial de Español</h1><p>Resultado individual para la familia</p></div>
      </header>

      <section class="parentMirrorStudent">
        <div><span>Alumno(a)</span><b>${esc(st.name)}</b></div>
        <div><span>Grupo</span><b>${esc(st.group_name)}</b></div>
      </section>

      <section class="parentMirrorIntro">
        <b>¿Para qué sirve este resultado?</b>
        <p>Este diagnóstico muestra el punto de partida del alumno al inicio del ciclo escolar. Permite reconocer lo que ya realiza favorablemente y los aspectos que conviene acompañar durante las clases de Español.</p>
      </section>

      <section class="parentMirrorSection strengths">
        <div class="parentMirrorSectionTitle"><span>✓</span><div><h2>Fortalezas</h2><p>Aspectos que se observan favorablemente.</p></div></div>
        ${familyPrintList(strengths,"En este momento no se identificaron fortalezas específicas para destacar.","strength")}
      </section>

      <section class="parentMirrorSection support">
        <div class="parentMirrorSectionTitle"><span>↗</span><div><h2>Aspectos por reforzar</h2><p>Habilidades que conviene seguir trabajando.</p></div></div>
        ${familyPrintList(syn.support_areas,"En este momento no se identificaron aspectos específicos que requieran refuerzo.","support")}
      </section>

      <section class="parentMirrorSection recommendations">
        <div class="parentMirrorSectionTitle"><span>★</span><div><h2>Recomendaciones</h2><p>Sugerencias para acompañar su aprendizaje.</p></div></div>
        ${familyPrintList(syn.recommendations,"No se generaron recomendaciones específicas.","recommendation")}
      </section>

      ${followup?.comparison_available?`
      <section class="parentMirrorSection">
        <div class="parentMirrorSectionTitle"><span>↗</span><div><h2>Avance observado durante el ciclo</h2><p>Interpretación pedagógica de los cambios entre la aplicación inicial y final.</p></div></div>
        <div class="followupPrintGrid">
          <div>
            <b>Lectura</b>
            <p>${esc(familyReadingInterpretation(followup))}</p>
          </div>
          <div>
            <b>Escritura</b>
            <p>${esc(familyWritingInterpretation(followup))}</p>
          </div>
        </div>
      </section>`:""}

      <section class="parentMirrorNotice">
        <b>Importante</b>
        <p>Este resultado es informativo y pedagógico. No representa una calificación y no constituye un diagnóstico clínico ni psicológico.</p>
      </section>

      <footer class="parentMirrorFooter">
        <div><b>Profr. Jaime Armando Pérez Vázquez</b><br><span>Español · Ciclo escolar 2026–2027</span></div>
        <div class="parentMirrorDate">Generado el ${new Date().toLocaleDateString("es-MX")}</div>
      </footer>
    </article>`;
  document.body.appendChild(wrap);
  document.getElementById("closeIndividualReportBtn").onclick=()=>wrap.remove();
  document.getElementById("doPrintIndividualReportBtn").onclick=()=>window.print();
}

async function diagnosticPushParent(studentId){
  const r=await fetch(`${SUPABASE_URL}/functions/v1/send-push`,{
    method:"POST",
    headers:{
      apikey:SUPABASE_KEY,
      Authorization:`Bearer ${accessToken}`,
      "Content-Type":"application/json"
    },
    body:JSON.stringify({
      event:"diagnostic_published",
      student_id:String(studentId),
      title:"Diagnóstico inicial publicado",
      message:"Ya puedes consultar el resultado del diagnóstico inicial."
    })
  });
  const text=await r.text();
  let data=null;try{data=text?JSON.parse(text):null}catch{data=text}
  if(!r.ok)throw new Error(data?.error||text||`HTTP ${r.status}`);
  return data;
}
async function refreshDiagnosticPublication(){
  if(!activePeriod||!activeStudentBundle)return;
  try{
    const st=await rpc("teacher_diagnostic_publication_status",{
      p_period_id:activePeriod.id,
      p_student_id:activeStudentBundle.student.id
    });
    $("#integratedPublicationBox").classList.remove("hidden");
    const published=!!st.published;
    $("#integratedPublicationState").textContent=published?"Publicado para Padres":"No publicado";
    $("#integratedPublicationMeta").textContent=published&&st.published_at
      ? `Publicado: ${new Date(st.published_at).toLocaleString("es-MX")}`
      : "El resultado solo se verá en Padres cuando tú lo publiques.";
    $("#publishDiagnosticBtn").classList.toggle("hidden",published);
    $("#unpublishDiagnosticBtn").classList.toggle("hidden",!published);
  }catch(e){console.warn("publication status",e)}
}
async function publishDiagnosticResult(){
  if(!activePeriod||!activeStudentBundle)return;
  if(!confirm("¿Publicar este diagnóstico para la app de Padres?"))return;
  const btn=$("#publishDiagnosticBtn");btn.disabled=true;
  try{
    const r=await rpc("teacher_diagnostic_publish_result",{
      p_period_id:activePeriod.id,
      p_student_id:activeStudentBundle.student.id
    });
    if(!r.published)throw new Error(r.reason||"No se pudo publicar.");
    let pushResult=null;
    try{pushResult=await diagnosticPushParent(activeStudentBundle.student.id)}catch(e){console.warn("push diagnostic",e)}
    await refreshDiagnosticPublication();
    alert(pushResult?.sent>0
      ?"Diagnóstico publicado y notificación enviada a Padres."
      :"Diagnóstico publicado. No había una suscripción push activa para enviar la notificación.");
  }catch(e){alert("No se pudo publicar: "+(e.message||e))}
  finally{btn.disabled=false}
}
async function unpublishDiagnosticResult(){
  if(!activePeriod||!activeStudentBundle)return;
  if(!confirm("¿Retirar este diagnóstico de la app de Padres? No se borrarán los resultados."))return;
  try{
    await rpc("teacher_diagnostic_unpublish_result",{
      p_period_id:activePeriod.id,
      p_student_id:activeStudentBundle.student.id
    });
    await refreshDiagnosticPublication();
    alert("Publicación retirada. Los resultados permanecen guardados.");
  }catch(e){alert("No se pudo retirar: "+(e.message||e))}
}
$("#publishDiagnosticBtn").onclick=publishDiagnosticResult;
$("#unpublishDiagnosticBtn").onclick=unpublishDiagnosticResult;
$("#printIndividualDiagnosticBtn").onclick=generateIndividualDiagnosticReport;

$("#loginBtn").onclick=login;
$("#createPeriodBtn").onclick=createPeriod;
$("#refreshBtn").onclick=loadPeriods;
$("#logoutBtn").onclick=()=>{localStorage.removeItem("diagnosticTeacherToken");accessToken="";location.reload()};
$("#backGroupsBtn").onclick=()=>openPeriod(activePeriod);
$("#backStudentsBtn").onclick=()=>openGroup(activeGroup);

if("serviceWorker" in navigator)navigator.serviceWorker.register("service-worker.js").catch(()=>{});
boot();
