(function(){
 'use strict';
 const q=s=>document.querySelector(s),labels={requested:'Libro solicitado · pendiente de entrega',delivered:'Libro entregado',external:'Lo consiguió por fuera'};
 let selected=null,busy=false;
 function dialog(){
  let d=q('#bookManualStatusDialog');if(d)return d;
  d=document.createElement('dialog');d.id='bookManualStatusDialog';d.innerHTML='<div class="dialogbody"><h2>Cambiar estado del libro</h2><p id="bookManualStudent"></p><label>Estado<select id="bookManualStatus"><option value="requested">Libro solicitado · pendiente de entrega</option><option value="delivered">Libro entregado</option><option value="external">Lo consiguió por fuera</option></select></label><label>Motivo<textarea id="bookManualReason" rows="2" maxlength="300" placeholder="Ej. Cambio de ejemplar dañado / Lo compró por su cuenta"></textarea></label><p class="hint">Este cambio no borra ni anula pagos. Si lo consiguió por fuera, se excluye de los libros pendientes de pedir y de liquidar. No cancela pedidos ya enviados a la editorial ni devuelve dinero.</p><div class="actions"><button type="button" class="secondary" id="bookManualCancel">Cancelar</button><button type="button" class="primary" id="bookManualSave">Guardar estado</button></div><p id="bookManualMessage" role="status" aria-live="polite"></p></div>';
  document.body.appendChild(d);
  q('#bookManualCancel').onclick=()=>{if(!busy)d.close()};
  d.addEventListener('cancel',e=>{if(busy)e.preventDefault()});
  q('#bookManualSave').onclick=save;return d;
 }
 function open(id){
  if(busy)return;
  const row=(bookFulfillmentDashboard?.students||[]).find(r=>String(r.id)===String(id));
  if(!row)return alert('Actualiza la lista de libros antes de cambiar el estado.');
  selected={...row};const d=dialog();
  q('#bookManualStudent').textContent=row.name+' · Grupo '+row.group_name+' · ID '+row.id;
  q('#bookManualStatus').value=row.fulfillment_status||'external';q('#bookManualReason').value='';q('#bookManualMessage').textContent='';d.showModal();
 }
 async function save(){
  if(busy||!selected)return;
  const status=q('#bookManualStatus').value,reason=q('#bookManualReason').value.trim(),st=q('#bookManualMessage');
  if(!navigator.onLine||!cloudOnline){st.textContent='Necesitas conexión. El estado no se ha cambiado.';return;}
  if(reason.length<3){st.textContent='Escribe el motivo del cambio.';return;}
  if(!confirm('¿Cambiar el libro de '+selected.name+' (grupo '+selected.group_name+') a “'+labels[status]+'”?\n\nSus pagos se conservarán.'))return;
  busy=true;q('#bookManualSave').disabled=true;q('#bookManualCancel').disabled=true;st.textContent='Guardando…';
  let saved=false;
  try{
   const out=await window.ProfeSupabase.rpc('teacher_book_change_status',{p_student_id:String(selected.id),p_status:status,p_reason:reason,p_expected_status:selected.fulfillment_status||'none'});
   if(!out?.ok)throw Error(({status_changed:'El estado cambió desde que abriste la ventana. Actualiza la lista y vuelve a intentarlo.',reason_required:'Escribe el motivo.',student_not_found:'Alumno no encontrado.',invalid_status:'Estado no válido.'})[out?.reason]||out?.reason||'No se pudo confirmar el cambio.');
   saved=true;st.textContent='Estado guardado. Actualizando los conteos…';
   await loadBookPayments();await loadBookFulfillment();
   if(q('#payStudent')?.value===String(selected.id)){
    await loadBookPaymentStudent(String(selected.id));
    if(status==='external'){const title=q('#payStudentCard .section div:last-child > b');if(title)title.textContent='📘 Adquirido por cuenta propia';}
   }
   dialog().close();alert('Estado actualizado. Los pagos y su historial se conservaron.');
  }catch(e){st.textContent=(saved?'El estado sí se guardó, pero no se pudo refrescar la lista. ':'No se confirmó el cambio. ')+(e.message||e);}
  finally{busy=false;q('#bookManualSave').disabled=false;q('#bookManualCancel').disabled=false;}
 }
 function button(id){const b=document.createElement('button');b.type='button';b.className='secondary book-mini-action';b.textContent='Cambiar estado';b.dataset.bookManualStatus=id;b.onclick=()=>open(id);return b;}
 const roster=renderBookPaymentRoster;
 renderBookPaymentRoster=function(){const result=roster.apply(this,arguments);document.querySelectorAll('#payRoster .book-roster-row').forEach(row=>{const id=row.querySelector('[data-pay-student]')?.dataset.payStudent;if(id&&!row.querySelector('[data-book-manual-status]'))row.querySelector('.book-row-action')?.appendChild(button(id));});return result;};
 const management=renderBookManagement;
 renderBookManagement=function(){const result=management.apply(this,arguments);const group=q('#bookManageGroup')?.value||'__ALL__',rows=(bookFulfillmentDashboard?.students||[]).filter(r=>group==='__ALL__'||String(r.group_name)===group);document.querySelectorAll('#bookManageList .list-row').forEach((el,i)=>{if(rows[i]&&!el.querySelector('[data-book-manual-status]'))el.appendChild(button(rows[i].id));});return result;};
 window.BookManualStatus={open};
 if(typeof bookPayDashboard!=='undefined'&&bookPayDashboard)renderBookPaymentRoster();
})();
