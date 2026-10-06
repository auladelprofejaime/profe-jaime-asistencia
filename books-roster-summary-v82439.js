/* Full roster summary and independent read-only editorial history loading. */
(function(){
 const original=renderEditorialFinance;let history=null,loading=false,lastSummary=null;
 renderEditorialFinance=function(){
  const incoming=bookFulfillmentDashboard||offlineRpcGet('teacher_book_fulfillment_dashboard',{})||{};
  if(Array.isArray(incoming.students))lastSummary=incoming;
  else if(lastSummary)bookFulfillmentDashboard=lastSummary;
  const result=original.apply(this,arguments);
  const ful=bookFulfillmentDashboard||offlineRpcGet('teacher_book_fulfillment_dashboard',{})||{},rows=ful.students;
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v};
  if(Array.isArray(rows)){
   const external=rows.filter(r=>r.fulfillment_status==='external').length;
   const missing=rows.filter(r=>!['external','requested','delivered'].includes(r.fulfillment_status)).length;
   const unpaid=rows.filter(r=>r.fulfillment_status!=='external'&&r.payment_status!=='paid').length;
   set('bookEditorialStudentTotal',rows.length);
   set('bookEditorialRemainingToOrder',missing);
   set('bookEditorialRemainingToPay',unpaid);
   set('bookEditorialExternalCount',external);
   set('bookEditorialRosterExplanation',rows.length+' alumnos = '+Number(document.getElementById('bookEditorialRequestedTotal')?.textContent||0)+' libros ya pedidos + '+missing+' pendientes de pedir + '+external+' adquirido(s) por cuenta propia. Los entregados ya están incluidos en los pedidos.');
  }
  if(Array.isArray(ful.editorial_payments))history=ful.editorial_payments;
  const box=document.getElementById('bookEditorialPaymentHistory');
  if(box){
   box.className='list';
   if(history===null)box.textContent='Consultando el historial guardado…';
   else box.innerHTML=history.length?history.map(p=>'<div class="list-row"><b>Pago a editorial · <span class="private-value">'+money(p.amount)+'</span></b><small>'+safe(new Date(p.paid_at).toLocaleString('es-MX'))+(p.note?' · Nota: '+safe(p.note):'')+'</small></div>').join(''):'<div class="empty">No hay pagos a editorial registrados.</div>';
  }
  setPrivateVisibility('#bookEditorialDialog',privateVisible('#bookEditorialDialog'));
  return result;
 };
 async function refreshEditorial(){
  if(loading)return;loading=true;
  try{
   const out=await ProfeSupabase.rpc('teacher_book_fulfillment_dashboard',{});
   if(!out?.ok)throw new Error('No llegó el resumen de la editorial.');
   bookFulfillmentDashboard=out;renderEditorialFinance();
  }catch(e){
   console.warn('Consulta editorial:',e);
   const msg=document.getElementById('bookEditorialPaymentMessage');if(msg)msg.textContent='No se pudo actualizar el resumen: '+(e.message||e)+'. No se modificó ningún pago.';
   if(history===null){const box=document.getElementById('bookEditorialPaymentHistory');if(box)box.textContent='No se pudo consultar el historial. Pulsa Actualizar resumen para reintentar.';}
  }finally{loading=false}
 }
 window.addEventListener('load',()=>{
  document.getElementById('bookEditorialOpen')?.addEventListener('click',refreshEditorial);
  document.getElementById('bookEditorialRefresh')?.addEventListener('click',refreshEditorial);
 });
})();
