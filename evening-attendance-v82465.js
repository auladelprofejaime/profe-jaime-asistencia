/* Vespertino attendance bridge v8.24.65: isolated from matutino. */
(function(){
'use strict';
const groups=['1C','3A','3B','3C'];
const $=id=>document.getElementById(id);
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let pupils=[],records=new Map(),busy=false;
const dateLocal=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
function notice(t){$('eveningNotice').textContent=t}
function render(){
 const list=$('eveningRows');if(!list)return;
 const present=pupils.filter(p=>records.get(p.id)==='Presente').length;
 const late=pupils.filter(p=>records.get(p.id)==='Retardo').length;
 $('eveningCounts').textContent=pupils.length+' alumnos · '+present+' presentes · '+late+' retardos · '+(pupils.length-present-late)+' sin asistencia registrada';
 list.innerHTML=pupils.map(p=>'<div class="row" style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px;border-bottom:1px solid #ddd"><span>'+escapeHTML(p.list_number)+'. '+escapeHTML(p.name)+' <small>('+escapeHTML(p.id)+')</small></span><select data-evening-id="'+escapeHTML(p.id)+'" aria-label="Asistencia de '+escapeHTML(p.name)+'"><option value="">Sin registrar</option><option value="Presente">Presente</option><option value="Retardo">Retardo</option><option value="Falta">Falta</option></select></div>').join('');
 list.querySelectorAll('select[data-evening-id]').forEach(el=>{el.value=records.get(el.dataset.eveningId)||'';el.addEventListener('change',()=>save(el.dataset.eveningId,el.value,el))});
}
async function load(){
 if(busy)return;busy=true;notice('Cargando alumnos desde Supabase…');
 try{
  const api=window.ProfeSupabase;if(!api)throw Error('No se encontró la conexión con Supabase');
  const g=$('eveningGroup').value,d=$('eveningDate').value;
  const data=await api.select('students','select=id,name,list_number,group_name,shift,active&shift=eq.Vespertino&group_name=eq.'+encodeURIComponent(g)+'&active=eq.true&order=list_number.asc');
  pupils=(data||[]).filter(p=>p.shift==='Vespertino'&&p.group_name===g);
  const ids=pupils.map(p=>p.id);
  const all=ids.length?await api.select('attendance','select=student_id,status&attendance_date=eq.'+d+'&student_id=in.('+ids.map(encodeURIComponent).join(',')+')'):[];
  records=new Map((all||[]).map(x=>[x.student_id,x.status]));render();
  notice('Grupo '+g+' cargado desde Supabase: '+pupils.length+' alumnos.');
 }catch(e){notice('Error al cargar: '+e.message)}finally{busy=false}
}
async function save(id,status,el){
 el.disabled=true;notice('Guardando asistencia…');
 try{
  if(!status){el.value=records.get(id)||'';notice('Selecciona Presente, Retardo o Falta para registrar.');return}
  await window.ProfeSupabase.upsert('attendance',{student_id:id,attendance_date:$('eveningDate').value,status},'student_id,attendance_date');
  records.set(id,status);render();notice('Asistencia guardada y confirmada en Supabase.');
 }catch(e){el.value=records.get(id)||'';notice('No se guardó: '+e.message)}finally{el.disabled=false}
}
function init(){
 const host=$('attendance');if(!host||$('eveningPanel'))return;
 const panel=document.createElement('div');panel.id='eveningPanel';panel.className='card';panel.style.cssText='margin:12px 0;border:2px solid #b99718;padding:14px';
 panel.innerHTML='<h2>Asistencia vespertina · La Salle</h2><div style="display:flex;gap:10px;flex-wrap:wrap"><label>Grupo <select id="eveningGroup">'+groups.map(g=>'<option>'+g+'</option>').join('')+'</select></label><label>Fecha <input id="eveningDate" type="date"></label><button id="eveningRefresh" type="button">Cargar alumnos</button></div><p id="eveningNotice" role="status"></p><strong id="eveningCounts"></strong><div id="eveningRows"></div>';
 host.insertBefore(panel,host.firstChild);$('eveningDate').value=dateLocal();
 $('eveningGroup').addEventListener('change',load);$('eveningDate').addEventListener('change',load);$('eveningRefresh').addEventListener('click',load);
 const shift=$('attShift');
 function sync(){
  const isEvening=shift&&/vespertino/i.test(shift.value||shift.options[shift.selectedIndex]?.text||'');
  panel.style.display=isEvening?'':'none';
  if(isEvening){Array.from(host.children).forEach(x=>{if(x!==panel){if(x.dataset.eveningOldDisplay===undefined)x.dataset.eveningOldDisplay=x.style.display;x.style.display='none'}});load()}
  else Array.from(host.children).forEach(x=>{if(x!==panel&&x.dataset.eveningOldDisplay!==undefined){x.style.display=x.dataset.eveningOldDisplay;delete x.dataset.eveningOldDisplay}});
 }
 if(shift){shift.addEventListener('change',()=>setTimeout(sync,50));setTimeout(sync,1300)}
 else {panel.style.display='';load()}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();