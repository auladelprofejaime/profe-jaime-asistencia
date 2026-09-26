(()=>{
"use strict";
const ROSTER={"1C":[{"student_id":"V222316","list_number":1,"name":"ALVAREZ JUAREZ MATEO","matricula":"222316","group_name":"1C"},{"student_id":"V202196","list_number":2,"name":"AVILA RODRIGUEZ SOFIA","matricula":"202196","group_name":"1C"},{"student_id":"V263324","list_number":3,"name":"COLIN RAMIREZ ANGEL SANTIAGO","matricula":"263324","group_name":"1C"},{"student_id":"V263290","list_number":4,"name":"DIAZ ESTRADA ALDO","matricula":"263290","group_name":"1C"},{"student_id":"V202336","list_number":5,"name":"DIAZ RAMOS MAXIMILIANO","matricula":"202336","group_name":"1C"},{"student_id":"V212259","list_number":6,"name":"FRANCO SANCHEZ GERARDO ANTONIO","matricula":"212259","group_name":"1C"},{"student_id":"V263391","list_number":7,"name":"GERVACIO TAPIA AMANE EIZA","matricula":"263391","group_name":"1C"},{"student_id":"V202133","list_number":8,"name":"GONZALEZ LOPEZ DANIELA REGINA","matricula":"202133","group_name":"1C"},{"student_id":"V263157","list_number":9,"name":"HERNANDEZ CERVANTES VICTORIA","matricula":"263157","group_name":"1C"},{"student_id":"V263040","list_number":10,"name":"HUEDA CARRASCO JESUS ADIV","matricula":"263040","group_name":"1C"},{"student_id":"V263320","list_number":11,"name":"MARTINEZ JUAREZ EVANS DANIEL","matricula":"263320","group_name":"1C"},{"student_id":"V263175","list_number":12,"name":"MARTINEZ PIÑA DIEGO OSVALDO","matricula":"263175","group_name":"1C"},{"student_id":"V202082","list_number":13,"name":"MAYA MADRIGAL MIA GUADALUPE","matricula":"202082","group_name":"1C"},{"student_id":"V263270","list_number":14,"name":"MORALES ALTAMIRANO ELIAS","matricula":"263270","group_name":"1C"},{"student_id":"V263353","list_number":15,"name":"MORALES NERI LEONARDO","matricula":"263353","group_name":"1C"},{"student_id":"V263218","list_number":16,"name":"MUNOZ CARDENAS ELENA","matricula":"263218","group_name":"1C"},{"student_id":"V263321","list_number":17,"name":"OLIVARES MENDOZA LEONEL EMILIANO","matricula":"263321","group_name":"1C"},{"student_id":"V263311","list_number":18,"name":"OSORNIO LEDESMA YARA RENATA","matricula":"263311","group_name":"1C"},{"student_id":"V263041","list_number":19,"name":"PADUA PEDROZA VANESSA NICOLE","matricula":"263041","group_name":"1C"},{"student_id":"V263080","list_number":20,"name":"PIÑA MARMOLEJO ALFREDO","matricula":"263080","group_name":"1C"},{"student_id":"V263284","list_number":21,"name":"POSADAS MEJIA MATIAS","matricula":"263284","group_name":"1C"},{"student_id":"V202042","list_number":22,"name":"RAMIREZ CORNEJO MATEO","matricula":"202042","group_name":"1C"},{"student_id":"V252244","list_number":23,"name":"RODRIGUEZ SILVA CESAR KARIM","matricula":"252244","group_name":"1C"},{"student_id":"V263263","list_number":24,"name":"ROJAS MENDEZ ITZA DAYAMI","matricula":"263263","group_name":"1C"},{"student_id":"V263224","list_number":25,"name":"ROSAS RAMIREZ EMMANUEL NAHUM","matricula":"263224","group_name":"1C"},{"student_id":"V202084","list_number":26,"name":"SALAS LOZANO ANA LUCIA","matricula":"202084","group_name":"1C"},{"student_id":"V192179","list_number":27,"name":"SALDAÑA LEON SOFIA ISABELA","matricula":"192179","group_name":"1C"},{"student_id":"V222142","list_number":28,"name":"VALDEZ GONZALEZ MARCO ANTONIO","matricula":"222142","group_name":"1C"},{"student_id":"V202263","list_number":29,"name":"VALENCIA BORJA MATIAS","matricula":"202263","group_name":"1C"},{"student_id":"V263389","list_number":30,"name":"VARGAS RINCON DEREK CALEB","matricula":"263389","group_name":"1C"},{"student_id":"V263370","list_number":31,"name":"VELAZQUEZ LOPEZ IAN DAVID","matricula":"263370","group_name":"1C"},{"student_id":"V222377","list_number":32,"name":"YACAMAN BAUTISTA MIGUEL","matricula":"222377","group_name":"1C"}],"3A":[{"student_id":"V182144","list_number":1,"name":"ALVAREZ CERON CRISTIAN LEONARDO","matricula":"182144","group_name":"3A"},{"student_id":"V243403","list_number":2,"name":"ARROYO VAZQUEZ MIGUEL ALEXANDER","matricula":"243403","group_name":"3A"},{"student_id":"V243358","list_number":3,"name":"BECERRIL JIMENEZ JOEL EMILIO","matricula":"243358","group_name":"3A"},{"student_id":"V243172","list_number":4,"name":"CAMACHO RANGEL ERNESTO EMILIANO","matricula":"243172","group_name":"3A"},{"student_id":"V212097","list_number":5,"name":"CORTES GOMEZ DEIVID","matricula":"212097","group_name":"3A"},{"student_id":"V243378","list_number":6,"name":"GALLARDO MIJANGOS HANNIA SAMANTHA","matricula":"243378","group_name":"3A"},{"student_id":"V182047","list_number":7,"name":"GOMEZ LOPEZ DIEGO ZADKIEL","matricula":"182047","group_name":"3A"},{"student_id":"V243145","list_number":8,"name":"GONZALEZ HERNANDEZ SEBASTIAN","matricula":"243145","group_name":"3A"},{"student_id":"V182105","list_number":9,"name":"HERNANDEZ FLORES DIEGO URIEL","matricula":"182105","group_name":"3A"},{"student_id":"V182279","list_number":10,"name":"HERNANDEZ MEDRANO JUAN CARLOS","matricula":"182279","group_name":"3A"},{"student_id":"V182087","list_number":11,"name":"LOMELI CAZAREZ SHARON AILYM","matricula":"182087","group_name":"3A"},{"student_id":"V222095","list_number":12,"name":"LOPEZ SANCHEZ MATILDA","matricula":"222095","group_name":"3A"},{"student_id":"V243062","list_number":13,"name":"MANJARREZ ORTEGA TABATHA XARENI","matricula":"243062","group_name":"3A"},{"student_id":"V243160","list_number":14,"name":"MARTINEZ OLIVARES EDGAR GAEL","matricula":"243160","group_name":"3A"},{"student_id":"V182262","list_number":15,"name":"MERCADO NAVARRETE MATEO","matricula":"182262","group_name":"3A"},{"student_id":"V192090","list_number":16,"name":"MONTES DE OCA MUCIÑO EVANDER","matricula":"192090","group_name":"3A"},{"student_id":"V243007","list_number":17,"name":"OLVERA PEREZ VALENTINA","matricula":"243007","group_name":"3A"},{"student_id":"V243005","list_number":18,"name":"OSORNIO CARLOS DENISSE VALENTINA","matricula":"243005","group_name":"3A"},{"student_id":"V243098","list_number":19,"name":"PEREZ BERISTAIN ANDREA NOEMI","matricula":"243098","group_name":"3A"},{"student_id":"V263378","list_number":20,"name":"PEREZ GADNER LIA","matricula":"263378","group_name":"3A"},{"student_id":"V192075","list_number":21,"name":"RODRIGUEZ CORTES SOPHIE ALEXIA","matricula":"192075","group_name":"3A"},{"student_id":"V243009","list_number":22,"name":"ROMERO CASTAÑEDA ALAN SEBASTIAN","matricula":"243009","group_name":"3A"},{"student_id":"V182006","list_number":23,"name":"RUIZ GARRIDO VALERIA YUNUE","matricula":"182006","group_name":"3A"},{"student_id":"V182134","list_number":24,"name":"SANCHEZ ILESCAS BRANDON ALEXIS","matricula":"182134","group_name":"3A"},{"student_id":"V212235","list_number":25,"name":"SANCHEZ RUIZ NATALIA AGLAE","matricula":"212235","group_name":"3A"},{"student_id":"V192105","list_number":26,"name":"SANDOVAL GOMEZ MARIA JOSE","matricula":"192105","group_name":"3A"},{"student_id":"V182140","list_number":27,"name":"SANTIAGO ROJAS PEDRO IKER","matricula":"182140","group_name":"3A"},{"student_id":"V182066","list_number":28,"name":"TEJADA ESCARCEGA LILIAN THAMARA","matricula":"182066","group_name":"3A"},{"student_id":"V243424","list_number":29,"name":"TREJO ACEVEDO PAOLA","matricula":"243424","group_name":"3A"},{"student_id":"V243060","list_number":30,"name":"VALDIVIA LUNA ARWEN ANDREA","matricula":"243060","group_name":"3A"}],"3B":[{"student_id":"V182173","list_number":1,"name":"ALCANTAR LARA IAN JEREMY","matricula":"182173","group_name":"3B"},{"student_id":"V243102","list_number":2,"name":"ALCANTARA DIAZ LEONARDO","matricula":"243102","group_name":"3B"},{"student_id":"V182119","list_number":3,"name":"ALCOCER CARDOSO REGINA","matricula":"182119","group_name":"3B"},{"student_id":"V192045","list_number":4,"name":"ALONSO LOPEZ SOFIA","matricula":"192045","group_name":"3B"},{"student_id":"V243355","list_number":5,"name":"ALVAREZ JIMENEZ ANGEL SANTIAGO","matricula":"243355","group_name":"3B"},{"student_id":"V232232","list_number":6,"name":"CASTILLO RANGEL NESTOR GERARDO","matricula":"232232","group_name":"3B"},{"student_id":"V243113","list_number":7,"name":"CORDERO CORONA FERNANDO ABRAHAM","matricula":"243113","group_name":"3B"},{"student_id":"V243096","list_number":8,"name":"DOMINGUEZ DUARTE HANNA FERNANDA","matricula":"243096","group_name":"3B"},{"student_id":"V243057","list_number":9,"name":"ESPINOSA RODRIGUEZ MARINA XCARET","matricula":"243057","group_name":"3B"},{"student_id":"V243112","list_number":10,"name":"FIGUEROA GONZALEZ IXCHEL","matricula":"243112","group_name":"3B"},{"student_id":"V182267","list_number":11,"name":"GARCIA BERNAL RONALDO","matricula":"182267","group_name":"3B"},{"student_id":"V253329","list_number":12,"name":"GOMEZ LICEA ASHLEY MAYTHE","matricula":"253329","group_name":"3B"},{"student_id":"V243064","list_number":13,"name":"GONZALEZ MARTINEZ MAXIMILIANO","matricula":"243064","group_name":"3B"},{"student_id":"V243344","list_number":14,"name":"HERNANDEZ HERNANDEZ NICOLAS GABRIEL","matricula":"243344","group_name":"3B"},{"student_id":"V243257","list_number":15,"name":"JIMENEZ UBERA DIEGO JAVIER","matricula":"243257","group_name":"3B"},{"student_id":"V243058","list_number":16,"name":"LOVE BADILLO FERNANDA","matricula":"243058","group_name":"3B"},{"student_id":"V243395","list_number":17,"name":"MADRUEÑO MEJIA IAAN EMILIANIO","matricula":"243395","group_name":"3B"},{"student_id":"V182135","list_number":18,"name":"MAGAÑA GOROSTIAGA GUILLERMO GABRIEL","matricula":"182135","group_name":"3B"},{"student_id":"V182145","list_number":19,"name":"MARTINEZ CAMARGO REBECA MONTSERRAT","matricula":"182145","group_name":"3B"},{"student_id":"V243169","list_number":20,"name":"MARTINEZ ROMERO SANTIAGO DAMIR","matricula":"243169","group_name":"3B"},{"student_id":"V263356","list_number":21,"name":"ORDOÑEZ MUÑOZ ANA SOFIA","matricula":"263356","group_name":"3B"},{"student_id":"V182207","list_number":22,"name":"PEÑA MUÑOZ ISABELLA","matricula":"182207","group_name":"3B"},{"student_id":"V243134","list_number":23,"name":"PEREZ REYNOSO JOSELINE","matricula":"243134","group_name":"3B"},{"student_id":"V182033","list_number":24,"name":"PEREZ TELLECHEA ANDER ISSAC","matricula":"182033","group_name":"3B"},{"student_id":"V243267","list_number":25,"name":"PIÑA ABURTO LEONARDO","matricula":"243267","group_name":"3B"},{"student_id":"V243263","list_number":26,"name":"RETIZ CUADRA RODOLFO","matricula":"243263","group_name":"3B"},{"student_id":"V182025","list_number":27,"name":"ROBLEDO VALENZUELA FATIMA MONTSERRAT","matricula":"182025","group_name":"3B"},{"student_id":"V243063","list_number":28,"name":"RODRIGUEZ LOPEZ ANDREA GISELLE","matricula":"243063","group_name":"3B"},{"student_id":"V182036","list_number":29,"name":"RODRIGUEZ SOLIS SEBASTIAN","matricula":"182036","group_name":"3B"},{"student_id":"V243099","list_number":30,"name":"RUIZ BARNARD MARIA JOSE","matricula":"243099","group_name":"3B"},{"student_id":"V243050","list_number":31,"name":"SALAZAR ESPINO ANNA SOPHIA","matricula":"243050","group_name":"3B"}],"3C":[{"student_id":"V243072","list_number":1,"name":"AGUILAR MORENO YAEL","matricula":"243072","group_name":"3C"},{"student_id":"V182154","list_number":2,"name":"BARRIGA GUEVARA JOSE SALVADOR","matricula":"182154","group_name":"3C"},{"student_id":"V182009","list_number":3,"name":"BARRIOS RAMIREZ IXCHEL FATIMA","matricula":"182009","group_name":"3C"},{"student_id":"V232263","list_number":4,"name":"BURGOS SARMIENTO DIEGO","matricula":"232263","group_name":"3C"},{"student_id":"V182048","list_number":5,"name":"CORDERO MONDRAGON JESUS","matricula":"182048","group_name":"3C"},{"student_id":"V243356","list_number":6,"name":"CORONADO CASTAÑEDA YAHANI","matricula":"243356","group_name":"3C"},{"student_id":"V253099","list_number":7,"name":"CORRAL PICHARDO ANA MARIA","matricula":"253099","group_name":"3C"},{"student_id":"V212289","list_number":8,"name":"GALEANA OROZCO MIA VALENTINA","matricula":"212289","group_name":"3C"},{"student_id":"V243230","list_number":9,"name":"GARCIA OLMOS ESMERALDA","matricula":"243230","group_name":"3C"},{"student_id":"V243180","list_number":10,"name":"GARCIA RIZO VALERIA MONTSERRAT","matricula":"243180","group_name":"3C"},{"student_id":"V243322","list_number":11,"name":"GONZALEZ JURADO KATHERINE","matricula":"243322","group_name":"3C"},{"student_id":"V253325","list_number":12,"name":"GRACIA MARTINEZ MIRANDA TRINIDAD","matricula":"253325","group_name":"3C"},{"student_id":"V263325","list_number":13,"name":"GUTIERREZ HERNANDEZ ISAAC","matricula":"263325","group_name":"3C"},{"student_id":"V243323","list_number":14,"name":"HERNANDEZ MORENO GAEL","matricula":"243323","group_name":"3C"},{"student_id":"V202220","list_number":15,"name":"HERNANDEZ PEREZ ISABELA","matricula":"202220","group_name":"3C"},{"student_id":"V243061","list_number":16,"name":"HERNANDEZ SOTO MATIAS ACAT","matricula":"243061","group_name":"3C"},{"student_id":"V243390","list_number":17,"name":"JUAREZ LARRONDO RICARDO JAMIL","matricula":"243390","group_name":"3C"},{"student_id":"V243377","list_number":18,"name":"JURADO FERNANDEZ KATIA MELANI","matricula":"243377","group_name":"3C"},{"student_id":"V222198","list_number":19,"name":"LOPEZ SARACHO HEBER ADRIAN","matricula":"222198","group_name":"3C"},{"student_id":"V253297","list_number":20,"name":"LUCATERO CAMPOS ANA REGINA","matricula":"253297","group_name":"3C"},{"student_id":"V243266","list_number":21,"name":"OLARTE SOTO MAXIMILIANO","matricula":"243266","group_name":"3C"},{"student_id":"V182043","list_number":22,"name":"ORDUÑA LOPEZ PAULINA","matricula":"182043","group_name":"3C"},{"student_id":"V182102","list_number":23,"name":"PINEDA BUENROSTRO MARIA PAULA","matricula":"182102","group_name":"3C"},{"student_id":"V182240","list_number":24,"name":"RAMIREZ FLORES GISELLE MONTSERRAT","matricula":"182240","group_name":"3C"},{"student_id":"V253162","list_number":25,"name":"SALAS GIL SANTIAGO","matricula":"253162","group_name":"3C"},{"student_id":"V182169","list_number":26,"name":"SANCHEZ ALBARRAN AYAX EATHAN","matricula":"182169","group_name":"3C"},{"student_id":"V192280","list_number":27,"name":"TORRES COBOS CAMILA ALEJANDRA","matricula":"192280","group_name":"3C"},{"student_id":"V243008","list_number":28,"name":"TORRES MENDEZ DANTE RAFAEL","matricula":"243008","group_name":"3C"},{"student_id":"V202287","list_number":29,"name":"YAÑEZ GOMEZ EMILIO ADAN","matricula":"202287","group_name":"3C"}]};
const GROUPS=["1C","3A","3B","3C"];
const allStudents=Object.values(ROSTER).flat().sort((a,b)=>a.name.localeCompare(b.name,"es",{sensitivity:"base"}));
let received=new Map(),lastReceivedId=null,activePendingGroup="1C",loading=false;
const $=s=>document.querySelector(s);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
function studentById(id){return allStudents.find(s=>String(s.student_id)===String(id))}
function fmtDate(v){if(!v)return"";try{return new Date(v).toLocaleString("es-MX",{dateStyle:"short",timeStyle:"short"})}catch{return String(v)}}
function setStatus(msg,type="neutral"){const el=$("#bookCustodyStatus");if(!el)return;el.textContent=msg;el.dataset.type=type}
function pending(){return allStudents.filter(s=>!received.has(String(s.student_id)))}
function renderCounts(){
 const rec=received.size,pend=allStudents.length-rec;
 $("#bookCustodyReceivedCount").textContent=rec;
 $("#bookCustodyPendingCount").textContent=pend;
 $("#bookCustodyTotalCount").textContent=allStudents.length;
}
function renderQuick(){
 renderCounts();
 const box=$("#bookCustodyQuickList"); if(!box)return;
 const rows=pending();
 if(!rows.length){box.innerHTML='<div class="book-custody-empty">✅ Ya registraste los 122 libros.</div>';return}
 box.innerHTML=rows.map(s=>`<button type="button" class="book-custody-student" data-custody-id="${esc(s.student_id)}">
   <span class="book-custody-name">${esc(s.name)}</span>
   <span class="book-custody-meta">Grupo ${esc(s.group_name)} · No. ${esc(s.list_number)}</span>
 </button>`).join("");
 box.querySelectorAll("[data-custody-id]").forEach(btn=>btn.onclick=()=>receiveBook(btn.dataset.custodyId,btn));
 const undo=$("#bookCustodyUndo");
 if(undo)undo.disabled=!lastReceivedId;
}
function renderGroupButtons(){
 const box=$("#bookCustodyGroupButtons"); if(!box)return;
 box.innerHTML=GROUPS.map(g=>{
   const total=ROSTER[g].length;
   const rec=ROSTER[g].filter(s=>received.has(String(s.student_id))).length;
   const pend=total-rec;
   return `<button type="button" class="book-custody-group ${g===activePendingGroup?"active":""}" data-custody-group="${g}">
     <b>${g}</b><span>${rec} recibidos · ${pend} pendientes</span>
   </button>`;
 }).join("");
 box.querySelectorAll("[data-custody-group]").forEach(btn=>btn.onclick=()=>{
   activePendingGroup=btn.dataset.custodyGroup;renderGroupButtons();renderPendingGroup();
 });
}
function renderPendingGroup(){
 const title=$("#bookCustodyPendingTitle"),box=$("#bookCustodyPendingList");
 if(!title||!box)return;
 const rows=ROSTER[activePendingGroup].filter(s=>!received.has(String(s.student_id)));
 title.textContent=`Pendientes · ${activePendingGroup} (${rows.length})`;
 box.innerHTML=rows.length?rows.map(s=>`<div class="book-custody-pending-row"><b>${esc(s.list_number)}.</b><span>${esc(s.name)}</span></div>`).join("")
 :'<div class="book-custody-empty">✅ Este grupo ya está completo.</div>';
}
function renderAll(){renderQuick();renderGroupButtons();renderPendingGroup()}
async function loadReceived(){
 if(loading)return;loading=true;
 try{
   setStatus("Actualizando registro…");
   const rows=await window.ProfeSupabase.rpc("teacher_evening_book_custody_list",{});
   received=new Map((Array.isArray(rows)?rows:[]).map(r=>[String(r.student_id),r]));
   renderAll();setStatus("✓ Registro actualizado.","ok");
 }catch(e){
   setStatus("No pude cargar el registro: "+(e?.message||e),"error");
 }finally{loading=false}
}
async function receiveBook(id,button){
 if(!navigator.onLine){setStatus("Sin conexión. No se registró nada; inténtalo cuando tengas internet.","error");return}
 const s=studentById(id);if(!s||received.has(String(id)))return;
 button.disabled=true;
 try{
   setStatus("Guardando "+s.name+"…");
   const r=await window.ProfeSupabase.rpc("teacher_evening_book_custody_receive",{
     p_student_id:s.student_id,p_student_name:s.name,p_group_name:s.group_name,p_list_number:s.list_number
   });
   received.set(String(s.student_id),{...s,received_at:r?.received_at||new Date().toISOString()});
   lastReceivedId=String(s.student_id);renderAll();
   setStatus("✓ "+s.name+" · "+s.group_name+" registrado.","ok");
 }catch(e){
   button.disabled=false;setStatus("No se registró: "+(e?.message||e),"error");
 }
}
async function undoLast(){
 if(!lastReceivedId)return;
 if(!navigator.onLine){setStatus("Sin conexión. No se modificó el registro.","error");return}
 const s=studentById(lastReceivedId);if(!s)return;
 try{
   $("#bookCustodyUndo").disabled=true;
   await window.ProfeSupabase.rpc("teacher_evening_book_custody_undo",{p_student_id:s.student_id});
   received.delete(String(s.student_id));lastReceivedId=null;renderAll();
   setStatus("Se deshizo el registro de "+s.name+".","ok");
 }catch(e){setStatus("No pude deshacer: "+(e?.message||e),"error");renderAll()}
}
function showPanel(which){
 const quick=$("#bookCustodyQuickPanel"),pendingPanel=$("#bookCustodyPendingPanel");
 quick?.classList.toggle("hidden",which!=="quick");
 pendingPanel?.classList.toggle("hidden",which!=="pending");
 $("#bookCustodyTabQuick")?.classList.toggle("active",which==="quick");
 $("#bookCustodyTabPending")?.classList.toggle("active",which==="pending");
 if(which==="pending"){renderGroupButtons();renderPendingGroup()}
}
function injectStyle(){
 if(document.getElementById("bookCustodyStyle"))return;
 const st=document.createElement("style");st.id="bookCustodyStyle";st.textContent=`
 #book-custody .book-custody-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 16px}
 #book-custody .book-custody-tabs button.active{box-shadow:inset 0 0 0 2px currentColor}
 #book-custody .book-custody-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:12px 0}
 #book-custody .book-custody-stat{padding:14px;border:1px solid #ddd;border-radius:14px;background:#fff}
 #book-custody .book-custody-stat b{display:block;font-size:1.65rem}
 #book-custody .book-custody-quick-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:9px}
 #book-custody .book-custody-student{display:flex;flex-direction:column;align-items:flex-start;text-align:left;min-height:72px;padding:12px 14px;border-radius:14px}
 #book-custody .book-custody-name{font-weight:800;line-height:1.2}
 #book-custody .book-custody-meta{font-size:.86rem;opacity:.76;margin-top:6px}
 #book-custody .book-custody-groups{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:12px 0}
 #book-custody .book-custody-group{display:flex;flex-direction:column;gap:4px;padding:12px;border-radius:14px}
 #book-custody .book-custody-group.active{box-shadow:inset 0 0 0 2px currentColor}
 #book-custody .book-custody-pending-row{display:grid;grid-template-columns:42px 1fr;gap:8px;padding:10px 8px;border-bottom:1px solid #e6e6e6}
 #book-custody .book-custody-empty{padding:18px;text-align:center;border:1px dashed #bbb;border-radius:14px}
 #bookCustodyStatus[data-type="ok"]{color:#176c36}
 #bookCustodyStatus[data-type="error"]{color:#9e2929}
 @media(max-width:700px){#book-custody .book-custody-groups{grid-template-columns:repeat(2,minmax(0,1fr))}}
 `;document.head.appendChild(st);
}
function init(){
 if(!$("#book-custody")||!window.ProfeSupabase)return;
 injectStyle();
 $("#bookCustodyTabQuick").onclick=()=>showPanel("quick");
 $("#bookCustodyTabPending").onclick=()=>showPanel("pending");
 $("#bookCustodyUndo").onclick=undoLast;
 $("#bookCustodyRefresh").onclick=loadReceived;
 document.querySelectorAll('[data-view="book-custody"]').forEach(btn=>btn.addEventListener("click",()=>setTimeout(loadReceived,0)));
 renderAll();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();