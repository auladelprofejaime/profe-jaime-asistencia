const URL="https://xqeyyjakmeiaahecfdmc.supabase.co";
const KEY="sb_publishable_GY2NGAigumnZw3rIJKU7LA_a2qigAEA";
const $=s=>document.querySelector(s);
let staffCode="",session=null,items=[],groups=[],choices={};

async function rpc(name,args={}){
  const r=await fetch(URL+"/rest/v1/rpc/"+name,{
    method:"POST",
    headers:{apikey:KEY,Authorization:"Bearer "+KEY,"Content-Type":"application/json"},
    body:JSON.stringify(args),
    cache:"no-store"
  });
  const t=await r.text();let d=null;try{d=t?JSON.parse(t):null}catch{d=t}
  if(!r.ok)throw new Error(d?.message||d?.hint||"No se pudo conectar.");
  return d;
}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function reason(r){
  return ({
    invalid_id:"ID no reconocido. Revisa el número e inténtalo de nuevo.",
    vote_closed:"La votación ya cerró.",
    already_voted:"Este ID ya registró su votación.",
    invalid_group:"Selecciona un grupo válido.",
    group_not_eligible:"Ese grupo no participa en esta categoría.",
    justification_required:"Escribe brevemente por qué propones ese grupo.",
    all_categories_required:"Debes elegir un grupo en todas las categorías antes de enviar.",
    invalid_ballot:"No se pudo validar la votación."
  })[r]||r||"No se pudo completar la operación.";
}
function setDeadline(iso){
  const el=document.querySelector(".deadline");if(!el||!iso)return;
  const d=new Date(iso);
  const fmt=new Intl.DateTimeFormat("es-MX",{timeZone:"America/Mexico_City",day:"numeric",month:"long",hour:"numeric",minute:"2-digit",hour12:true}).format(d);
  el.textContent="Cierre: "+fmt.replace("a. m.","a. m.").replace("p. m.","p. m.");
}
function showThanks(name){
  $("#ballot").innerHTML='<div class="card" style="text-align:center;padding:36px 22px"><div style="font-size:2.2rem;margin-bottom:8px">✓</div><h2>Muchas gracias por tu participación</h2><p class="muted">'+esc(name||"Docente")+', tus votos fueron registrados correctamente.</p><p class="success"><b>Votación enviada.</b></p></div>';
}
function renderProgress(){
  const count=Object.keys(choices).length;
  const btn=$("#submitBallotBtn");
  const msg=$("#selectionProgress");
  if(msg)msg.textContent=count+" de "+items.length+" categorías seleccionadas.";
  if(btn)btn.disabled=count!==items.length;
}
function markChoice(code,label){
  const box=document.querySelector('[data-choice-status="'+code+'"]');
  if(box)box.innerHTML='<span class="done">✓ '+esc(label)+'</span>';
  renderProgress();
}
function chooseProposed(code,group){
  choices[code]={criterion_code:code,agree:true,proposed_group_code:null,justification:null};
  markChoice(code,"Elegiste Grupo "+group);
}
function chooseAlternative(code){
  const sel=document.querySelector('[data-select="'+code+'"]');
  const proposal=sel?.value||"";
  const justification=document.querySelector('[data-reason="'+code+'"]')?.value.trim()||"";
  const st=$("#ballotStatus");
  if(!proposal){st.innerHTML='<span class="error">Selecciona primero el grupo por el que quieres votar.</span>';return}
  if(justification.length<5){st.innerHTML='<span class="error">Escribe brevemente por qué consideras que ese grupo merece la categoría.</span>';return}
  choices[code]={criterion_code:code,agree:false,proposed_group_code:proposal,justification};
  st.textContent="";
  markChoice(code,"Elegiste Grupo "+proposal);
}
function renderBallot(){
  $("#cards").innerHTML=items.map(i=>{
    const excluded=new Set((Array.isArray(i.excluded_groups)?i.excluded_groups:[]).map(String));
    const options=groups
      .filter(g=>String(g.group_code)!==String(i.proposed_group)&&!excluded.has(String(g.group_code)))
      .map(g=>'<option value="'+esc(g.group_code)+'">Grupo '+esc(g.group_code)+'</option>').join('');
    return '<article class="vote-card"><h3>'+esc(i.label)+'</h3>'+
      '<div class="muted">Grupo propuesto</div><div class="proposed">Grupo '+esc(i.proposed_group)+'</div>'+
      '<div class="actions"><button class="primary agreeBtn" data-code="'+esc(i.criterion_code)+'" data-group="'+esc(i.proposed_group)+'">Elegir Grupo '+esc(i.proposed_group)+'</button></div>'+
      '<div class="choiceRow"><select data-select="'+esc(i.criterion_code)+'"><option value="">Elegir otro grupo…</option>'+options+'</select></div>'+
      '<div class="choiceRow"><textarea data-reason="'+esc(i.criterion_code)+'" rows="3" placeholder="¿Por qué consideras que ese grupo merece esta categoría?" style="width:100%;padding:12px;border:1px solid #cfd6df;border-radius:13px;font:inherit;resize:vertical"></textarea></div>'+
      '<div class="actions" style="margin-top:8px"><button class="secondary changeBtn" data-code="'+esc(i.criterion_code)+'">Elegir otro grupo</button></div>'+
      '<div data-choice-status="'+esc(i.criterion_code)+'" style="margin-top:10px"></div>'+
      '</article>';
  }).join('');
  document.querySelectorAll(".agreeBtn").forEach(b=>b.onclick=()=>chooseProposed(b.dataset.code,b.dataset.group));
  document.querySelectorAll(".changeBtn").forEach(b=>b.onclick=()=>chooseAlternative(b.dataset.code));
  const actions=document.createElement("div");
  actions.className="card";
  actions.style.marginTop="18px";
  actions.innerHTML='<p id="selectionProgress" class="muted" style="margin-top:0">0 de '+items.length+' categorías seleccionadas.</p>'+
    '<button id="submitBallotBtn" class="primary" style="width:100%" disabled>Confirmar y enviar mis votos</button>';
  $("#cards").after(actions);
  $("#submitBallotBtn").onclick=submitBallot;
}
async function loadBallot(){
  const d=await rpc("merit_public_category_ballot",{p_staff_code:staffCode});
  if(!d?.ok)throw new Error(reason(d?.reason));
  $("#staffName").textContent=d.staff_name||"Docente";
  $("#staffCode").textContent=d.staff_code||staffCode;
  session=d.session||null;
  if(!session){$("#cards").innerHTML='<div class="card"><h2>Votación cerrada</h2><p class="muted">No hay una votación activa en este momento.</p></div>';return}
  setDeadline(session.closes_at);
  groups=Array.isArray(session.groups)?session.groups:[];
  items=Array.isArray(session.items)?session.items:[];
  if(items.length&&items.every(i=>i.has_voted)){showThanks(d.staff_name);return}
  choices={};
  renderBallot();
}
async function submitBallot(){
  const st=$("#ballotStatus");
  if(Object.keys(choices).length!==items.length){
    st.innerHTML='<span class="error">Debes elegir un grupo en todas las categorías antes de enviar.</span>';return;
  }
  if(!confirm("¿Confirmas y envías tus votos de las 7 categorías?"))return;
  const btn=$("#submitBallotBtn");btn.disabled=true;st.textContent="Enviando votación…";
  try{
    const payload=items.map(i=>choices[i.criterion_code]);
    const d=await rpc("merit_public_submit_category_ballot",{
      p_staff_code:staffCode,
      p_session_id:session.id,
      p_votes:payload
    });
    if(!d?.ok)throw new Error(reason(d?.reason));
    showThanks(d.staff_name);
  }catch(e){
    st.innerHTML='<span class="error">'+esc(e.message||e)+'</span>';
    btn.disabled=false;
  }
}
async function enter(){
  const st=$("#loginStatus"),btn=$("#enterBtn");
  staffCode=$("#staffId").value.trim();
  if(!staffCode){st.innerHTML='<span class="error">Escribe tu ID docente.</span>';return}
  btn.disabled=true;st.textContent="Verificando ID…";
  try{
    const d=await rpc("merit_public_category_ballot",{p_staff_code:staffCode});
    if(!d?.ok)throw new Error(reason(d?.reason));
    $("#loginCard").classList.add("hidden");
    $("#ballot").classList.remove("hidden");
    $("#staffName").textContent=d.staff_name||"Docente";
    $("#staffCode").textContent=d.staff_code||staffCode;
    session=d.session||null;
    await loadBallot();
  }catch(e){st.innerHTML='<span class="error">'+esc(e.message||e)+'</span>'}
  finally{btn.disabled=false}
}
$("#enterBtn").addEventListener("click",enter);
$("#staffId").addEventListener("keydown",e=>{if(e.key==="Enter")enter()});