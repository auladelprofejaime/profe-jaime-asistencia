/* Incidencias en Escáner de actividades: ruta independiente sin registrar entregas por accidente. */
(()=>{
'use strict';
const $=s=>document.querySelector(s);
function morning(){return /^matutino$/i.test(String($('#actShift')?.value||'').trim())}
function incidentMode(){return $('#incidentScanMode')?.value==='incidents'&&morning()}
function refresh(){
 const select=$('#incidentScanMode'),box=$('#incidentScannerPanel');if(!select)return;
 const visible=morning();box.hidden=!visible;
 if(!visible)select.value='delivery';
 const active=incidentMode();
 const input=$('#actScan'),button=$('#actRegister');
 if(active){
  if(input){input.disabled=false;input.placeholder='Escanea el gafete o escribe la matrícula'}
  if(button){button.disabled=false;button.textContent='Buscar alumno y registrar incidencia'}
 }else{
  if(input)input.placeholder='Escanea o escribe la matrícula';
  if(button&&button.textContent==='Buscar alumno y registrar incidencia')button.textContent='Registrar entrega';
  if(typeof refreshActivitySelectors==='function')refreshActivitySelectors().catch(console.warn);
 }
}
async function scan(){
 const input=$('#actScan'),sid=String(input?.value||'').trim(),shift=$('#actShift')?.value,group=$('#actGroup')?.value;
 if(!sid){alert('Escanea el gafete o escribe la matrícula del alumno.');input?.focus();return}
 try{
  const student=await studentForSelectedGroup(sid,shift,group);
  if(!student){alert('El alumno no pertenece al grupo seleccionado o la matrícula no existe.');return}
  if(!window.MorningIncidents?.openFor)throw Error('El formulario de incidencias no está disponible.');
  input.value='';
  await window.MorningIncidents.openFor(student.id,student.name||student.id,student.group||group);
 }catch(e){alert('No se pudo abrir el registro: '+(e.message||e))}
 finally{input?.focus()}
}
function init(){
 const input=$('#actScan'),button=$('#actRegister'),shift=$('#actShift'),group=$('#actGroup');
 if(!input||!button||!shift||!group)return;
 if($('#incidentScannerPanel'))return;
 const box=document.createElement('div');box.id='incidentScannerPanel';box.style.cssText='margin:12px 0;padding:12px;border:1px solid #e5d6ae;border-radius:10px;background:#fffaf0';
 box.innerHTML='<label style="display:block;font-weight:700" for="incidentScanMode">¿Qué deseas registrar?</label><select id="incidentScanMode" style="width:100%;margin-top:6px;padding:10px"><option value="delivery">Entrega de actividad</option><option value="incidents">Incidencia de comportamiento</option></select><p style="margin:6px 0 0;font-size:13px">En Incidencias, escanea el gafete o escribe la matrícula; no se marcará ninguna entrega.</p>';
 input.closest('label')?.parentElement?.insertBefore(box,input.closest('label')) || input.parentElement?.parentElement?.prepend(box);
 box.querySelector('select').addEventListener('change',refresh);
 shift.addEventListener('change',()=>setTimeout(refresh,0));group.addEventListener('change',()=>setTimeout(refresh,0));
 input.addEventListener('keydown',e=>{if(incidentMode()&&(e.key==='Enter'||e.key==='NumpadEnter')){e.preventDefault();e.stopImmediatePropagation();scan()}},true);
 button.addEventListener('click',e=>{if(incidentMode()){e.preventDefault();e.stopImmediatePropagation();scan()}},true);
 const observer=new MutationObserver(()=>{if(incidentMode()){input.disabled=false;button.disabled=false;button.textContent='Buscar alumno y registrar incidencia'}});
 observer.observe(button,{attributes:true,attributeFilter:['disabled']});
 refresh();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
