const URL="https://xqeyyjakmeiaahecfdmc.supabase.co";
const KEY="sb_publishable_GY2NGAigumnZw3rIJKU7LA_a2qigAEA";
const $=s=>document.querySelector(s);
let staffCode="",session=null;

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
  return ({invalid_id:"ID no reconocido. Revisa el número e inténtalo de nuevo.",vote_closed:"La votación ya cerró.",already_voted:"Este ID ya registró su voto en esta categoría.",invalid_group:"Selecciona un grupo válido."})[r]||r||"No se pudo completar la operación.";
}
async function loadBallot(){
  const d=await rpc("merit_public_category_ballot",{p_staff_code:staffCode});
  if(!d?.ok)throw new Error(reason(d?.reason));
  $("#staffName").textContent=d.staff_name||"Docente";
  $("#staffCode").textContent=d.staff_code||staffCode;
  session=d.session||null;
  if(!session){$("#cards").innerHTML='<div class="card"><h2>Votación cerrada</h2><p class="muted">No hay una votación activa en este momento.</p></div>';return}
  const groups=Array.isArray(session.groups)?session.groups:[];
  const items=Array.isArray(session.items)?session.items:[];
  $("#cards").innerHTML=items.map(i=>{
    if(i.has_voted){
      const txt=i.agree?'Ratificaste al Grupo '+esc(i.proposed_group):'Propusiste al Grupo '+esc(i.my_proposal||"");
      return '<article class="vote-card"><h3>'+esc(i.label)+'</h3><div class="proposed">Grupo '+esc(i.proposed_group)+'</div><div class="done">✓ '+txt+'</div></article>';
    }
    const options=groups.filter(g=>String(g.group_code)!==String(i.proposed_group)).map(g=>'<option value="'+esc(g.group_code)+'">Grupo '+esc(g.group_code)+'</option>').join('');
    return '<article class="vote-card"><h3>'+esc(i.label)+'</h3><div class="muted">Propuesta actual</div><div class="proposed">Grupo '+esc(i.proposed_group)+'</div>'+
      '<div class="actions"><button class="primary agreeBtn" data-code="'+esc(i.criterion_code)+'">Estoy de acuerdo</button></div>'+
      '<div class="choiceRow"><select data-select="'+esc(i.criterion_code)+'"><option value="">Proponer otro grupo…</option>'+options+'</select></div>'+
      '<div class="actions" style="margin-top:8px"><button class="secondary changeBtn" data-code="'+esc(i.criterion_code)+'">Votar por otro grupo</button></div>'+
      '</article>';
  }).join('');
  document.querySelectorAll(".agreeBtn").forEach(b=>b.onclick=()=>vote(b.dataset.code,true));
  document.querySelectorAll(".changeBtn").forEach(b=>b.onclick=()=>vote(b.dataset.code,false));
}
async function vote(code,agree){
  const st=$("#ballotStatus");let proposal=null;
  if(!agree){
    const sel=document.querySelector('[data-select="'+code+'"]');
    proposal=sel?.value||"";
    if(!proposal){st.innerHTML='<span class="error">Selecciona primero el grupo que propones.</span>';return}
  }
  const msg=agree?"¿Confirmas que estás de acuerdo con el grupo propuesto?":"¿Confirmas tu voto por el grupo seleccionado?";
  if(!confirm(msg))return;
  try{
    st.textContent="Registrando voto…";
    const d=await rpc("merit_public_cast_category_vote",{
      p_staff_code:staffCode,
      p_session_id:session.id,
      p_criterion_code:code,
      p_agree:agree,
      p_proposed_group_code:proposal||null
    });
    if(!d?.ok)throw new Error(reason(d?.reason));
    st.innerHTML='<span class="success">✓ Voto registrado correctamente.</span>';
    await loadBallot();
  }catch(e){st.innerHTML='<span class="error">'+esc(e.message||e)+'</span>'}
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