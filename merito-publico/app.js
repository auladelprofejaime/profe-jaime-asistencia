const SUPABASE_URL="https://xqeyyjakmeiaahecfdmc.supabase.co", SUPABASE_KEY="sb_publishable_GY2NGAigumnZw3rIJKU7LA_a2qigAEA";
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let data=null,grade='all';
async function rpc(name,args={}){const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(args)});const t=await r.text();let d;try{d=t?JSON.parse(t):null}catch{d=t}if(!r.ok)throw new Error(t||r.status);return d}
function render(){
 const ranking=$('#ranking'),state=$('#stateBox');ranking.innerHTML='';state.classList.add('hidden');
 $('#periodName').textContent=data?.period||'Sin periodo publicado';
 $('#updated').textContent=data?.published_at?`Última actualización: ${new Date(data.published_at).toLocaleString('es-MX',{dateStyle:'medium',timeStyle:'short'})}`:'';
 if(!data?.ok){state.classList.remove('hidden');state.innerHTML='<div class="empty">No se pudo consultar el avance.</div>';return}
 if(data.state==='frozen'||data.state==='results_in_process'){state.classList.remove('hidden');state.innerHTML='<div class="empty"><h2>Resultados en proceso</h2><p>La clasificación se encuentra en revisión. El resultado oficial se publicará cuando la administración lo determine.</p></div>';return}
 const rows=(data.ranking||[]).filter(x=>grade==='all'||String(x.grade)===grade);
 if(!rows.length){state.classList.remove('hidden');state.innerHTML='<div class="empty"><h2>Aún no hay un corte publicado</h2><p>Vuelve a consultar cuando se publique el siguiente avance semanal.</p></div>';return}
 ranking.innerHTML=rows.map(x=>`<div class="rankrow ${Number(x.position)===1?'top1':''}"><div class="rank">${x.position}.º</div><div class="grp">Grupo ${x.group}</div><div class="score">${x.points} pts</div></div>`).join('');
 if(data.message){state.classList.remove('hidden');state.innerHTML=`<b>Aviso:</b> ${escapeHtml(data.message)}`}
}
$$('#filters button').forEach(b=>b.onclick=()=>{grade=b.dataset.grade;$$('#filters button').forEach(x=>x.classList.toggle('active',x===b));render()});
function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c])}
(async()=>{try{data=await rpc('merit_public_latest');render()}catch(e){data={ok:false};render()}})();
if('serviceWorker'in navigator)navigator.serviceWorker.register('service-worker.js').catch(()=>{});
