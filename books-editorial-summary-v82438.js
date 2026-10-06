/* Separate physical delivery counts from historical editorial commitments. */
(function(){
 const original=renderEditorialFinance;
 renderEditorialFinance=function(){
  const result=original.apply(this,arguments);
  const ful=bookFulfillmentDashboard||offlineRpcGet('teacher_book_fulfillment_dashboard',{})||{};
  const rows=ful.students||[],delivered=rows.length?rows.filter(r=>r.fulfillment_status==='delivered').length:Number(ful.delivered_count||0);
  const historical=rows.length?rows.filter(r=>['requested','delivered'].includes(r.fulfillment_status)).length:Number(ful.requested_count||0);
  const pending=rows.length?rows.filter(r=>r.fulfillment_status==='requested').length:Math.max(0,historical-delivered);
  const ready=rows.length?rows.filter(r=>r.payment_status==='paid'&&!r.fulfillment_status).length:Number(ful.liquidated_unrequested_count||0);
  const paid=Number(ful.editorial_paid||0),unit=EDITORIAL_UNIT_COST;
  const balance=Math.max(0,Number(ful.editorial_balance??(historical*unit-paid))||0);
  const set=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value};
  set('bookEditorialRequested',pending);
  set('bookEditorialRequestedTotal',historical);
  set('bookEditorialPendingValue',money(pending*unit));
  set('bookEditorialDue',money(ready*unit));
  set('bookEditorialBalance',money(balance));
  set('bookEditorialNewOrderCount',ready+' libro(s) liquidado(s) aún sin solicitar × '+money(unit));
  const detail=document.getElementById('bookEditorialOrderExplanation');
  if(detail)detail.innerHTML='Pedidos registrados: <b>'+historical+' libros × '+money(unit)+' = <span class="private-value">'+money(historical*unit)+'</span></b>. Pagos registrados: <b class="private-value">'+money(paid)+'</b>. Saldo pendiente: <b class="private-value">'+money(balance)+'</b>.<br>El valor de los '+pending+' libros pendientes de entrega no es un cobro adicional: ya forma parte de los pedidos registrados. El nuevo pedido por solicitar incluye únicamente libros liquidados que todavía no se han pedido.';
  setPrivateVisibility('#bookEditorialDialog',privateVisible('#bookEditorialDialog'));
  return result;
 };
})();
