/* One shared status read, memory-only cache, no PIN generation or persistence. */
(function(){
 'use strict';
 const TTL=15000;
 let snapshot=null,expires=0,pending=null,revision=0,renderVersion=0;
 const client=window.ProfeSupabase;
 if(!client)return;
 const baseRpc=client.rpc.bind(client);
 function clear(){snapshot=null;expires=0;pending=null;revision++;}
 async function statuses(){
   if(snapshot&&Date.now()<expires)return snapshot;
   if(pending)return pending;
   const ticket=revision;
   const work=baseRpc('teacher_portal_status',{}).then(rows=>{
     if(!Array.isArray(rows))throw new Error('El servidor no devolvió los estados de acceso.');
     if(ticket===revision){snapshot=rows;expires=Date.now()+TTL;}
     return rows;
   });
   pending=work;
   try{return await work}finally{if(pending===work)pending=null;}
 }
 client.rpc=async function(name,args={}){
   if(name==='teacher_portal_status')return statuses();
   if(/teacher_.*(?:portal.*(?:pin|access)|reset_portal_pin)/.test(name)){
     clear();try{return await baseRpc(name,args)}finally{clear();}
   }
   return baseRpc(name,args);
 };
 function merge(studentId,role,local,remote){
   const st=remote.find(x=>String(x.student_id)===String(studentId));
   if(!st)return local;
   return {...(local||{}),id:`${studentId}|${role}`,studentId,role,
     mustChange:!!st[`${role}_must_change`],activated:!!st[`${role}_active`],
     lockedUntil:st[`${role}_locked_until`]?new Date(st[`${role}_locked_until`]).getTime():0};
 }
 getPortalAuthRecord=async function(studentId,role){
   const local=await req(store('portalAuth').get(`${studentId}|${role}`));
   if(!supabaseReady)return local;
   try{return merge(studentId,role,local,await statuses())}catch(_){return local;}
 };
 getStudentPortalStates=async function(studentId){
   const [sa,pa]=await Promise.all([getPortalAuthRecord(studentId,'student'),getPortalAuthRecord(studentId,'parent')]);
   return {student:sa,parent:pa,studentState:portalAuthState(sa),parentState:portalAuthState(pa)};
 };
 function pinCell(a){return portalStatePill(a)+(a?.mustChange?(a.tempPinReveal?`<div class="pin-mini"><b>PIN: ${safe(a.tempPinReveal)}</b></div>`:'<small class="pin-not-cached">PIN vigente no disponible para mostrar</small>'):'');}
 renderPortalAccessReport=async function(){
   const wrap=document.getElementById('portalAccessTableWrap'),sum=document.getElementById('portalAccessSummary');if(!wrap||!sum)return;
   const ticket=++renderVersion,group=document.getElementById('portalAccessGroupFilter')?.value||'22',search=low(document.getElementById('portalAccessSearch')?.value||'');
   wrap.setAttribute('aria-busy','true');
   try{
     const [students,localRecords]=await Promise.all([all('students'),all('portalAuth')]);
     if(ticket!==renderVersion)return;
     const list=students.filter(s=>s.active!==false&&sameShift(s.shift,'Matutino')).filter(s=>group==='__ALL__'||sameGroup(s.group,group)).filter(s=>!search||low(s.name).includes(search)||low(s.id).includes(search)).sort(compareStudentsForList);
     if(!list.length){wrap.innerHTML='<div class="empty">No hay alumnos que coincidan con el grupo o búsqueda.</div>';sum.innerHTML='';return;}
     if(!snapshot||Date.now()>=expires){sum.innerHTML='<p class="hint" role="status">Consultando estados de acceso…</p>';wrap.innerHTML='<div class="empty">Cargando '+list.length+' alumnos. Los PIN existentes no se modificarán.</div>';}
     let remote=[],failed=false;
     if(supabaseReady){try{remote=await statuses()}catch(_){failed=true;}}
     if(ticket!==renderVersion)return;
     const local=new Map(localRecords.map(r=>[String(r.id),r]));
     const counts={studentActive:0,studentPending:0,parentActive:0,parentPending:0};
     const rows=list.map(s=>{
       const sa=merge(s.id,'student',local.get(`${s.id}|student`),remote),pa=merge(s.id,'parent',local.get(`${s.id}|parent`),remote);
       if(portalAuthState(sa).key==='active')counts.studentActive++;else counts.studentPending++;
       if(portalAuthState(pa).key==='active')counts.parentActive++;else counts.parentPending++;
       return `<tr><td><b>${safe(studentListDisplayName(s))}</b><small>Grupo ${safe(s.group||'')} · ID ${safe(s.id)}</small></td><td>${pinCell(sa)}</td><td>${pinCell(pa)}</td><td><div class="actions"><button class="secondary mini" type="button" data-pin-individual="${safe(s.id)}">${!sa&&!pa?'Generar PIN individual':'Administrar PIN'}</button><button class="secondary mini" type="button" data-pin-print="${safe(s.id)}">Imprimir hoja</button></div></td></tr>`;
     });
     sum.innerHTML=(failed?'<p class="hint" role="status">No se pudo consultar el servidor. Se muestran datos locales; pulsa Actualizar estados para verificar su vigencia.</p>':!supabaseReady?'<p class="hint">Datos locales: conecta tu sesión de profesor para verificar su vigencia.</p>':'')+`<div class="access-summary-box"><small>Alumnos activados</small><b>${counts.studentActive}</b></div><div class="access-summary-box"><small>Alumnos pendientes</small><b>${counts.studentPending}</b></div><div class="access-summary-box"><small>Familias activadas</small><b>${counts.parentActive}</b></div><div class="access-summary-box"><small>Familias pendientes</small><b>${counts.parentPending}</b></div>`;
     wrap.innerHTML=`<table class="access-table"><thead><tr><th>Alumno</th><th>Acceso alumno</th><th>Acceso familia</th><th>Acciones</th></tr></thead><tbody>${rows.join('')}</tbody></table>`;
     wrap.querySelectorAll('[data-pin-individual]').forEach(b=>b.onclick=()=>generateIndividualPortalPins(b.dataset.pinIndividual));
     wrap.querySelectorAll('[data-pin-print]').forEach(b=>b.onclick=()=>printIndividualPortalAccess(b.dataset.pinPrint));
   }catch(e){if(ticket===renderVersion){sum.innerHTML='';wrap.innerHTML='<div class="empty">No se pudo cargar el listado: '+safe(e.message||e)+'</div>';}}
   finally{if(ticket===renderVersion)wrap.setAttribute('aria-busy','false');}
 };
 document.getElementById('refreshPortalAccessReport')?.addEventListener('click',()=>clear(),true);
 document.getElementById('teacherLogoutBtn')?.addEventListener('click',clear,true);
 const originalLogout=client.logout;
 if(typeof originalLogout==='function')client.logout=async function(){clear();return originalLogout.apply(this,arguments);};
 window.PortalAccessFast={clear};
})();

(function(){const s=document.createElement('script');s.src='seguimiento-3a-riesgo-trimestral-v1.js?v=20261022';document.head.appendChild(s)})();
