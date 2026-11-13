(function(){
'use strict';
const $=s=>document.querySelector(s), api=()=>window.ProfeSupabase;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let students=[],campaigns=[],payments=[],current='',busy=false;
const status=m=>{const x=$('#tcMessage');if(x)x.textContent=m||''};
function build(){
 const root=$('#contributionsStandalone')||$('#titular');if(!root)return;
 const tabs=root.querySelector('.subtabs');
 if(tabs&&!root.querySelector('[data-tittab="contributions"]')){const b=document.createElement('button');b.className='sub';b.dataset.tittab='contributions';b.textContent='Cooperaciones';tabs.appendChild(b);}
 const pane=$('#tit-contributions')||document.createElement('div');pane.id='tit-contributions';pane.className='titpane';pane.innerHTML=`
 <div class="card"><div class="section"><div><h2>Cooperaciones · 3.º A</h2><p class="hint">Crea registros independientes. Toca el nombre al recibir su aportación; desaparecerá de pendientes y quedará registrado.</p></div><button type="button" id="tcReload" class="secondary">Actualizar</button></div>
 <div class="formgrid"><label>Concepto<input id="tcTitle" maxlength="100" placeholder="Ej. Cooperación para vela"></label><label>Monto por alumno ($)<input id="tcAmount" type="number" min="0.01" step="0.01" value="5"></label><button type="button" id="tcCreate" class="primary">Crear cooperación</button></div><p id="tcMessage" class="message" aria-live="polite"></p></div>
 <div class="card"><label>Registro de cooperación<select id="tcSelect"></select></label><div id="tcSummary" style="margin:12px 0"></div><h3>Pendientes de aportar</h3><div id="tcPending" style="display:flex;flex-wrap:wrap;gap:8px"></div><details style="margin-top:18px"><summary><b id="tcPaidHeading">Aportaciones recibidas</b></summary><div id="tcPaid" style="margin-top:10px"></div></details></div>`;
 if(!pane.parentElement)root.appendChild(pane);if($('#contributionsStandalone'))pane.classList.add('active');
 // The original titular tab controller may only know two panes: handle this tab independently.
 tabs?.addEventListener('click',e=>{const b=e.target.closest('[data-tittab]');if(!b)return;const key=b.dataset.tittab;if(key==='contributions'){root.querySelectorAll('.subtabs .sub').forEach(x=>x.classList.toggle('active',x===b));root.querySelectorAll('.titpane').forEach(x=>x.classList.toggle('active',x===pane));load()}else{pane.classList.remove('active');b.classList.add('active')}});
 $('#tcReload').onclick=load;
 $('#tcCreate').onclick=create;
 $('#tcSelect').onchange=e=>{current=e.target.value;render()};
 $('#tcPending').onclick=async e=>{const b=e.target.closest('button[data-id]');if(b)await pay(b.dataset.id)};
 $('#tcPaid').onclick=async e=>{const b=e.target.closest('button[data-undo]');if(b)await undo(b.dataset.undo)};
}
async function load(){
 if(busy)return;busy=true;status('Cargando registros…');
 try{
 const a=api();if(!a)throw Error('Inicia sesión en App Docente');
 const [s,c]=await Promise.all([a.select('students','select=id,name,list_number,active&shift=eq.Vespertino&group_name=eq.3A&order=list_number.asc'),a.select('titular_contributions','select=id,title,amount,created_at&order=created_at.desc')]);
 students=(s||[]).filter(x=>x.active!==false);campaigns=c||[];
 if(!campaigns.some(x=>x.id===current))current=campaigns[0]?.id||'';
 payments=current?await a.select('titular_contribution_payments','select=student_id,paid_at&contribution_id=eq.'+encodeURIComponent(current)):[];
 render();status('');
 }catch(e){status('No se pudo cargar: '+(e.message||e))}
 finally{busy=false}
}
function render(){
 const sel=$('#tcSelect');if(!sel)return;sel.innerHTML=campaigns.length?campaigns.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.title)+' · $'+Number(c.amount).toFixed(2)+'</option>').join(''):'<option value="">Sin registros todavía</option>';sel.value=current;
 const c=campaigns.find(x=>x.id===current),paid=new Set(payments.map(x=>x.student_id)),pending=students.filter(x=>!paid.has(x.id)),done=students.filter(x=>paid.has(x.id));
 $('#tcSummary').textContent=c?'Recibidos: '+done.length+' de '+students.length+' · Total recaudado: $'+(done.length*Number(c.amount)).toFixed(2)+' · Pendientes: '+pending.length:'Crea una cooperación para comenzar.';
 $('#tcPending').innerHTML=c?(pending.map(x=>'<button type="button" class="secondary" data-id="'+esc(x.id)+'" style="padding:12px">'+esc(x.list_number||'')+'. '+esc(x.name)+'</button>').join('')||'<p>Todos han aportado.</p>'):'<p>No hay cooperación seleccionada.</p>';
 $('#tcPaidHeading').textContent='Aportaciones recibidas ('+done.length+')';
 $('#tcPaid').innerHTML=done.map(x=>'<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px;border-bottom:1px solid #ddd"><span>'+esc(x.list_number||'')+'. '+esc(x.name)+' · Pagado</span><button type="button" class="secondary" data-undo="'+esc(x.id)+'">Corregir</button></div>').join('')||'<p>Sin aportaciones todavía.</p>';
}
async function create(){
 if(busy)return;const title=$('#tcTitle').value.trim(),amount=Number($('#tcAmount').value);
 if(!title||!Number.isFinite(amount)||amount<=0){status('Escribe un concepto y un monto válido.');return}
 busy=true;$('#tcCreate').disabled=true;
 try{const a=api();await a.rest('titular_contributions',{method:'POST',body:{title,amount},prefer:'return=representation'});$('#tcTitle').value='';busy=false;await load();status('Cooperación creada.')}catch(e){status('No se pudo crear: '+e.message)}finally{busy=false;$('#tcCreate').disabled=false}
}
async function pay(id){
 if(busy||!current)return;busy=true;
 try{await api().rest('titular_contribution_payments',{method:'POST',body:{contribution_id:current,student_id:id},prefer:'return=minimal'});payments.push({student_id:id,paid_at:new Date().toISOString()});render();status('Aportación registrada.')}catch(e){status('No se pudo guardar: '+e.message)}finally{busy=false}
}
async function undo(id){
 if(busy||!current||!confirm('¿Quitar la aportación registrada para este alumno?'))return;busy=true;
 try{await api().remove('titular_contribution_payments','contribution_id=eq.'+encodeURIComponent(current)+'&student_id=eq.'+encodeURIComponent(id));payments=payments.filter(x=>x.student_id!==id);render();status('Registro corregido.')}catch(e){status('No se pudo corregir: '+e.message)}finally{busy=false}
}
function init(){build();if($('#contributionsStandalone'))load()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();