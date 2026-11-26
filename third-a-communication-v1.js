(()=>{
'use strict';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let students=[],selectedType='',selectedDetail='',message='',busy=false;
const types=[
 ['observacion','Observación'],
 ['anotacion','Anotación'],
 ['reglamento','Incumplimiento de reglamento'],
 ['retardo','Retardo'],
 ['falta','Falta'],
 ['celular','Retiro de celular'],
 ['otra','Otra incidencia']
];
const quick={
 observacion:['Se distrajo constantemente durante la clase.','No realizó el trabajo indicado durante la sesión.','Interrumpió de manera recurrente el desarrollo de la clase.','No siguió las indicaciones proporcionadas durante la sesión.'],
 anotacion:['Recibió una anotación por su conducta durante la clase.','Recibió una anotación por no atender las indicaciones.','Recibió una anotación derivada de una situación ocurrida durante la jornada escolar.'],
 reglamento:['Incumplió una indicación establecida en el reglamento escolar.','Utilizó el celular sin autorización.','No cumplió con las indicaciones de presentación o uniforme.','Presentó una conducta contraria a los acuerdos de convivencia del grupo.'],
 retardo:['Ingresó al salón después del horario de inicio de la clase.'],
 falta:['No se presentó a clases el día de hoy.'],
 celular:['Se retiró el teléfono celular durante la jornada por uso no autorizado.'],
 otra:[]
};
function fixed(type,detail){
 const intro='Buen día.';
 let fact='';
 if(type==='retardo') fact='Te informo que el día de hoy se registró un retardo, ya que ingresaste al salón después del horario de inicio de la clase.';
 else if(type==='falta') fact='Te informo que el día de hoy se registró una falta de asistencia.';
 else if(type==='celular') fact='Te informo que el día de hoy se retiró tu teléfono celular debido a su uso no autorizado durante la jornada escolar.';
 else fact='Te informo que el día de hoy se registró la siguiente situación: '+detail;
 return [intro,fact,'Este aviso tiene la finalidad de mantenerte informado sobre tu seguimiento escolar.','Agradezco tu atención.','Profe Jaime'].join('\n\n');
}
function clean(t){return String(t||'').replace(/\r\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim()}
function status(t){const e=$('#com3aStatus');if(e)e.textContent=t||''}
function student(){return students.find(s=>s.id===$('#com3aStudent')?.value)}
function renderQuick(){
 const box=$('#com3aQuick'),custom=$('#com3aCustomWrap'); if(!box)return;
 const arr=quick[selectedType]||[];
 box.innerHTML=arr.map((x,i)=>'<button type="button" class="com3a-chip '+(selectedDetail===x?'active':'')+'" data-detail="'+i+'">'+esc(x)+'</button>').join('');
 custom.hidden=selectedType!=='otra';
 if(selectedType==='retardo'||selectedType==='falta'||selectedType==='celular'){
   selectedDetail=arr[0]||'';
   message=fixed(selectedType,selectedDetail); $('#com3aPreview').value=message; status('Mensaje listo.');
 }
 updateActions();
}
function updateActions(){
 const s=student(),ready=!!(s&&selectedType&&(selectedDetail||selectedType==='otra')&&message.trim());
 $('#com3aGemini').disabled=busy||!s||!selectedType||(!selectedDetail&&selectedType!=='otra');
 $('#com3aGmail').disabled=!ready||!s?.institutional_email;
 const email=$('#com3aEmail');if(email)email.textContent=s?.institutional_email||'Sin correo institucional registrado';
}
async function generate(){
 const s=student();if(!s||!selectedType)return;
 if(selectedType==='otra')selectedDetail=$('#com3aCustom').value.trim();
 if(!selectedDetail)return status('Selecciona una frase o escribe brevemente qué ocurrió.');
 if(['retardo','falta','celular'].includes(selectedType)){message=fixed(selectedType,selectedDetail);$('#com3aPreview').value=message;status('Mensaje listo.');updateActions();return}
 busy=true;updateActions();status('Redactando…');
 try{
   const token=await window.ProfeSupabase?.token();if(!token)throw Error('Inicia sesión de profesor.');
   const r=await fetch(window.ProfeSupabase.URL+'/functions/v1/third-a-communication-draft',{
     method:'POST',
     headers:{apikey:window.ProfeSupabase.KEY,Authorization:'Bearer '+token,'Content-Type':'application/json'},
     body:JSON.stringify({type:selectedType,detail:selectedDetail}),
     signal:AbortSignal.timeout(35000)
   });
   const out=await r.json();if(!r.ok)throw Error(out.message||'No se pudo redactar.');
   message=clean(out.message);$('#com3aPreview').value=message;status('Mensaje listo.');
 }catch(e){message=fixed(selectedType,selectedDetail);$('#com3aPreview').value=message;status('Gemini no respondió; preparé el mensaje con la plantilla de respaldo.');}
 finally{busy=false;updateActions()}
}
function openGmail(){
 const s=student();if(!s?.institutional_email)return status('Este alumno no tiene correo institucional registrado.');
 message=clean($('#com3aPreview').value);if(!message)return;
 const subject='Seguimiento escolar · '+s.name;
 const url='https://mail.google.com/mail/?view=cm&fs=1&to='+encodeURIComponent(s.institutional_email)+'&su='+encodeURIComponent(subject)+'&body='+encodeURIComponent(message);
 window.open(url,'_blank','noopener');
 status('Abriendo Gmail con destinatario, asunto y mensaje preparados.');
}
function resetMessage(){message='';$('#com3aPreview').value='';status('');updateActions()}
function selectType(type,button){
 selectedType=type;selectedDetail='';message='';
 document.querySelectorAll('[data-com3a-type]').forEach(b=>b.classList.toggle('active',b===button));
 $('#com3aCustom').value='';$('#com3aPreview').value='';
 renderQuick();
}
function build(){
 const root=$('#contributionsStandalone');if(!root)return;
 root.innerHTML=`
 <style>
 #contributions-3a .com3a-head{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap}
 #contributions-3a .com3a-types,#contributions-3a .com3a-quick,#contributions-3a .com3a-actions{display:flex;flex-wrap:wrap;gap:10px}
 #contributions-3a .com3a-type,#contributions-3a .com3a-chip{border:1px solid #d8d8d8;background:#fff;border-radius:14px;padding:12px 14px;font-weight:700;cursor:pointer}
 #contributions-3a .com3a-type.active,#contributions-3a .com3a-chip.active{outline:3px solid rgba(27,108,255,.22);border-color:#1b6cff}
 #contributions-3a .com3a-type{min-height:54px;flex:1 1 170px}
 #contributions-3a .com3a-chip{text-align:left}
 #contributions-3a textarea{width:100%;min-height:210px;line-height:1.65;white-space:pre-wrap}
 #contributions-3a .com3a-send{min-height:56px;flex:1 1 180px;font-size:1rem;font-weight:800}
 #contributions-3a .com3a-email{font-size:.9rem;word-break:break-all}
 @media(max-width:620px){#contributions-3a .com3a-type{flex-basis:45%}#contributions-3a .com3a-send{flex-basis:100%}}
 </style>
 <div class="card">
  <div class="com3a-head"><div><span class="eyebrow">3.º A · VESPERTINO</span><h2>Comunicación rápida</h2><p class="hint">Selecciona al alumno, toca la situación y abre Gmail. El mensaje siempre queda separado por párrafos.</p></div><button id="com3aReload" type="button" class="secondary">Actualizar</button></div>
  <label>Alumno<select id="com3aStudent"><option value="">Cargando…</option></select></label>
  <div class="com3a-email" id="com3aEmail"></div>
 </div>
 <div class="card">
  <h3>1. ¿Qué ocurrió?</h3>
  <div class="com3a-types">${types.map(([v,l])=>'<button type="button" class="com3a-type" data-com3a-type="'+v+'">'+esc(l)+'</button>').join('')}</div>
  <div id="com3aQuick" class="com3a-quick" style="margin-top:14px"></div>
  <label id="com3aCustomWrap" hidden style="margin-top:14px">Describe brevemente qué ocurrió<textarea id="com3aCustom" rows="3" maxlength="700" placeholder="Escribe sólo los hechos. Gemini acomodará la redacción."></textarea></label>
  <div style="margin-top:14px"><button id="com3aGemini" type="button" class="primary" disabled>Preparar mensaje</button></div>
 </div>
 <div class="card">
  <h3>2. Mensaje listo</h3>
  <textarea id="com3aPreview" placeholder="Aquí aparecerá el mensaje. Puedes modificarlo antes de abrir Gmail."></textarea>
  <div class="com3a-actions" style="margin-top:14px">
   <button id="com3aGmail" type="button" class="secondary com3a-send" disabled>Gmail</button>
  </div>
  <p id="com3aStatus" class="message" aria-live="polite"></p>
 </div>`;
 root.querySelectorAll('[data-com3a-type]').forEach(b=>b.addEventListener('click',()=>selectType(b.dataset.com3aType,b)));
 $('#com3aQuick').addEventListener('click',e=>{const b=e.target.closest('[data-detail]');if(!b)return;selectedDetail=(quick[selectedType]||[])[Number(b.dataset.detail)]||'';message='';$('#com3aPreview').value='';renderQuick();if(['retardo','falta','celular'].includes(selectedType))generate();});
 $('#com3aCustom').addEventListener('input',()=>{selectedDetail=$('#com3aCustom').value.trim();resetMessage()});
 $('#com3aPreview').addEventListener('input',()=>{message=clean($('#com3aPreview').value);updateActions()});
 $('#com3aStudent').addEventListener('change',()=>{resetMessage();updateActions()});
 $('#com3aGemini').addEventListener('click',generate);
 status(ok?'Mensaje copiado. Regresa a Gmail y pégalo.':'No se pudo copiar automáticamente; selecciona el texto del recuadro.');});
 $('#com3aGmail').addEventListener('click',openGmail);
 $('#com3aReload').addEventListener('click',load);
}
async function load(){
 status('Cargando alumnos…');
 try{
  if(!window.ProfeSupabase)throw Error('Inicia sesión en App Docente.');
  const rows=await window.ProfeSupabase.select('students','select=id,name,list_number,institutional_email,active&shift=eq.Vespertino&group_name=eq.3A&active=eq.true&order=list_number.asc');
  students=Array.isArray(rows)?rows:[];
  const sel=$('#com3aStudent');sel.innerHTML='<option value="">Selecciona un alumno</option>'+students.map(s=>'<option value="'+esc(s.id)+'">'+esc((s.list_number?String(s.list_number)+'. ':'')+s.name)+'</option>').join('');
  status(students.length?'':'No se encontraron alumnos activos de 3.º A.');
  updateActions();
 }catch(e){status('No se pudieron cargar los alumnos: '+(e.message||e))}
}
function init(){build();load()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();