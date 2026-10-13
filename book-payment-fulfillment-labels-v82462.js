/* Keep physical book status separate from payment status. No payment mutations. */
(function(){
 'use strict';
 const q=s=>document.querySelector(s);
 const cash=n=>Number(n||0).toLocaleString('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:2});
 function payment(row){
   const paid=Number(row.paid||0),pending=Math.max(0,280-paid);
   return {paid,pending,label:pending===0?'🟢 Liquidado':paid>0?'🟡 Pago en proceso · Debe '+cash(pending):'⚪ Pendiente de pago · Debe '+cash(pending)};
 }
 function book(row){return row.fulfillment_status==='requested'?'🔵 Libro solicitado':row.fulfillment_status==='delivered'?'✅ Libro entregado':row.fulfillment_status==='external'?'📘 Adquirido por cuenta propia':'';}
 function find(id){
   const pay=(bookPayDashboard?.students||[]).find(r=>String(r.id)===String(id));
   const ful=(bookFulfillmentDashboard?.students||[]).find(r=>String(r.id)===String(id));
   return pay||ful?{...ful,...pay,fulfillment_status:ful?.fulfillment_status??pay?.fulfillment_status}:null;
 }
 function label(row){return row.fulfillment_status==='external'?book(row):[book(row),payment(row).label].filter(Boolean).join(' · ');}
 const style=document.createElement('style');
 style.textContent='.book-debt-status{display:block!important;color:#975900!important;font-weight:800!important;margin-top:6px}.book-payment-separate{display:block;margin-top:6px}.book-request-debt-hint{background:#fff6d8;border:1px solid #e7c77c;border-radius:12px;padding:12px;margin:12px 0}';
 document.head.appendChild(style);
 const originalRoster=renderBookPaymentRoster;
 renderBookPaymentRoster=function(){
   const result=originalRoster.apply(this,arguments);
   document.querySelectorAll('#payRoster .book-roster-row').forEach(el=>{
     const id=el.querySelector('[data-pay-student]')?.dataset.payStudent,row=find(id);if(!row)return;
     const pill=el.querySelector('.book-state-pill');
     if(pill){pill.textContent='';const physical=book(row);if(physical){const b=document.createElement('span');b.textContent=physical;pill.appendChild(b);}if(row.fulfillment_status!=='external'){const p=document.createElement('span');p.className='book-payment-separate'+(payment(row).pending>0?' book-debt-status':'');p.textContent=payment(row).label;pill.appendChild(p);}}
     const action=el.querySelector('.book-row-action');
     if(action&&!row.fulfillment_status&&payment(row).pending>0){
       const button=document.createElement('button');button.type='button';button.className='secondary book-mini-action';button.textContent='Solicitar con saldo pendiente';button.dataset.bookRequestWithDebt=id;
       button.onclick=()=>{window.BookManualStatus.open(id);const select=q('#bookManualStatus');if(select){select.value='requested';select.dispatchEvent(new Event('change',{bubbles:true}));}};
       action.querySelector('small')?.remove();action.appendChild(button);
     }
   });return result;
 };
 const originalManagement=renderBookManagement;
 renderBookManagement=function(){const result=originalManagement.apply(this,arguments);document.querySelectorAll('#bookManageList .list-row').forEach(el=>{const id=el.querySelector('[data-book-manual-status]')?.dataset.bookManualStatus,row=find(id);if(!row)return;const line=el.querySelector('span small');if(line)line.textContent='Grupo '+row.group_name+' · '+label(row);});return result;};
 bookFulfillmentStateLabel=label;
 function decorateStudent(id){
   const row=find(id);if(!row)return;
   const target=q('#payStudentCard .section > div:last-child');if(!target)return;
   target.querySelector('[data-book-physical-state]')?.remove();
   const status=target.querySelector('b');if(status&&row.fulfillment_status!=='external')status.textContent=payment(row).label;
   if(book(row)){const p=document.createElement('p');p.dataset.bookPhysicalState='1';p.textContent=book(row);target.appendChild(p);}
 }
 const originalLoad=loadBookPaymentStudent;
 loadBookPaymentStudent=async function(id=q('#payStudent')?.value){const result=await originalLoad.apply(this,arguments);decorateStudent(id);return result;};
 const originalLocal=renderBookPaymentStudentLocal;
 renderBookPaymentStudentLocal=function(id){const result=originalLocal.apply(this,arguments);decorateStudent(id);return result;};
 function updateDialog(){
   const d=q('#bookManualStatusDialog');if(!d)return;
   const id=q('#bookManualStudent')?.textContent.match(/ID\s+(\S+)/)?.[1],row=find(id);if(!row)return;
   let hint=q('#bookRequestDebtHint');if(!hint){hint=document.createElement('p');hint.id='bookRequestDebtHint';hint.className='book-request-debt-hint';q('#bookManualStudent').after(hint);}
   const p=payment(row);
   hint.textContent='Pagado: '+cash(p.paid)+' · Pendiente: '+cash(p.pending)+'. Cambiar a solicitado o entregado NO liquida el libro ni registra un pago.';
 }
 // The existing status dialog is reused; observe only its student header to avoid feedback loops.
 const connect=new MutationObserver(()=>{const header=q('#bookManualStudent');if(header){connect.disconnect();new MutationObserver(updateDialog).observe(header,{childList:true,characterData:true,subtree:true});updateDialog();}});
 connect.observe(document.body,{childList:true});
 window.BookPaymentFulfillmentLabels={payment,label};
 if(bookPayDashboard)renderBookPaymentRoster();
})();
