/* Calculadora privada de efectivo apartado para la editorial. No modifica pagos ni saldos. */
(function(){
  'use strict';

  const STORAGE_KEY='bookEditorialCashCalculatorV1';
  const DENOMINATIONS=[
    {value:500,label:'Billetes de $500',kind:'Billetes'},
    {value:200,label:'Billetes de $200',kind:'Billetes'},
    {value:100,label:'Billetes de $100',kind:'Billetes'},
    {value:50,label:'Billetes de $50',kind:'Billetes'},
    {value:20,label:'Billetes de $20',kind:'Billetes'},
    {value:10,label:'Monedas de $10',kind:'Monedas'},
    {value:5,label:'Monedas de $5',kind:'Monedas'},
    {value:2,label:'Monedas de $2',kind:'Monedas'},
    {value:1,label:'Monedas de $1',kind:'Monedas'},
    {value:0.5,label:'Monedas de $0.50',kind:'Monedas'}
  ];

  const money=value=>Number(value||0).toLocaleString('es-MX',{style:'currency',currency:'MXN',minimumFractionDigits:2});
  const byId=id=>document.getElementById(id);

  function readSaved(){
    try{
      const value=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');
      return value&&typeof value==='object'?value:{};
    }catch(_){return {}}
  }

  function currentCounts(){
    const counts={};
    document.querySelectorAll('[data-editorial-denomination]').forEach(input=>{
      const raw=Math.floor(Number(input.value)||0);
      counts[input.dataset.editorialDenomination]=Math.max(0,raw);
    });
    return counts;
  }

  function totals(counts=currentCounts()){
    return DENOMINATIONS.reduce((result,item)=>{
      const subtotal=(Number(counts[String(item.value)])||0)*item.value;
      result.total+=subtotal;
      if(item.kind==='Billetes')result.bills+=subtotal;
      else result.coins+=subtotal;
      return result;
    },{bills:0,coins:0,total:0});
  }

  function updateTotals(){
    const counts=currentCounts();
    DENOMINATIONS.forEach(item=>{
      const subtotal=byId('bookEditorialSubtotal-'+String(item.value).replace('.','_'));
      if(subtotal)subtotal.textContent=money((counts[String(item.value)]||0)*item.value);
    });
    const result=totals(counts);
    byId('bookEditorialBillsTotal').textContent=money(result.bills);
    byId('bookEditorialCoinsTotal').textContent=money(result.coins);
    byId('bookEditorialCashTotal').textContent=money(result.total);
    localStorage.setItem(STORAGE_KEY,JSON.stringify(counts));
  }

  function denominationRows(kind,counts){
    return DENOMINATIONS.filter(item=>item.kind===kind).map(item=>{
      const key=String(item.value);
      const quantity=Math.max(0,Math.floor(Number(counts[key])||0));
      const subtotalId='bookEditorialSubtotal-'+key.replace('.','_');
      return '<label class="book-editorial-calc-row">'+
        '<span><b>'+item.label+'</b><small>'+money(item.value)+' × cantidad</small></span>'+
        '<input type="number" min="0" step="1" inputmode="numeric" pattern="[0-9]*" value="'+quantity+'" data-editorial-denomination="'+key+'" aria-label="Cantidad de '+item.label.toLowerCase()+'">'+
        '<strong id="'+subtotalId+'">'+money(quantity*item.value)+'</strong>'+
      '</label>';
    }).join('');
  }

  function createInterface(){
    if(byId('bookEditorialCalculatorDialog'))return;
    const style=document.createElement('style');
    style.id='book-editorial-calculator-styles-v82460';
    style.textContent=`
      #bookEditorialCalculatorDialog{width:min(680px,calc(100% - 24px));max-height:92vh;border:0;border-radius:20px;padding:0;box-shadow:0 18px 70px #0007}
      #bookEditorialCalculatorDialog::backdrop{background:#0008}
      #bookEditorialCalculatorDialog .dialogbody{padding:18px;overflow:auto}
      .book-editorial-total{margin:4px 0 18px;padding:20px;border-radius:18px;background:linear-gradient(135deg,#fff1a8,#f5c400);color:#2a2200;text-align:center;border:1px solid #d4aa00}
      .book-editorial-total span{display:block;font-weight:800;font-size:.9rem}
      .book-editorial-total b{display:block;margin-top:4px;font-size:clamp(2rem,9vw,3rem);line-height:1;font-variant-numeric:tabular-nums}
      .book-editorial-calc-section{margin-top:16px}
      .book-editorial-calc-section h3{margin:0 0 8px}
      .book-editorial-calc-grid{display:grid;gap:8px}
      .book-editorial-calc-row{display:grid!important;grid-template-columns:minmax(0,1fr) 92px minmax(96px,120px);gap:10px;align-items:center;padding:10px 12px;border:1px solid rgba(0,0,0,.12);border-radius:14px;background:#fff}
      .book-editorial-calc-row span{min-width:0}
      .book-editorial-calc-row small{display:block;margin-top:2px;opacity:.62;font-weight:500}
      .book-editorial-calc-row input{width:100%;box-sizing:border-box;text-align:center;font-size:1.1rem;font-weight:900;margin:0}
      .book-editorial-calc-row strong{text-align:right;font-variant-numeric:tabular-nums}
      .book-editorial-summary{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px}
      .book-editorial-summary div{padding:12px;border-radius:14px;background:#f4f4f4;text-align:center}
      .book-editorial-summary span{display:block;font-size:.78rem;opacity:.7}
      .book-editorial-summary b{display:block;margin-top:3px;font-size:1.25rem;font-variant-numeric:tabular-nums}
      @media(max-width:520px){
        .book-editorial-calc-row{grid-template-columns:minmax(0,1fr) 76px;gap:8px}
        .book-editorial-calc-row strong{grid-column:1/-1;text-align:right;padding-top:2px;border-top:1px dashed rgba(0,0,0,.12)}
      }
    `;
    document.head.appendChild(style);

    const counts=readSaved();
    const dialog=document.createElement('dialog');
    dialog.id='bookEditorialCalculatorDialog';
    dialog.innerHTML=`
      <div class="dialoghead"><h2>🧮 Calculadora editorial</h2><button id="bookEditorialCalculatorClose" type="button" aria-label="Cerrar">×</button></div>
      <div class="dialogbody">
        <p class="hint">Escribe cuántos billetes y monedas apartaste. El total se calcula al momento y se conserva en este dispositivo.</p>
        <div class="book-editorial-total"><span>TOTAL APARTADO PARA LA EDITORIAL</span><b id="bookEditorialCashTotal">$0.00</b></div>
        <section class="book-editorial-calc-section"><h3>Billetes</h3><div class="book-editorial-calc-grid">${denominationRows('Billetes',counts)}</div></section>
        <section class="book-editorial-calc-section"><h3>Monedas</h3><div class="book-editorial-calc-grid">${denominationRows('Monedas',counts)}</div></section>
        <div class="book-editorial-summary"><div><span>Subtotal en billetes</span><b id="bookEditorialBillsTotal">$0.00</b></div><div><span>Subtotal en monedas</span><b id="bookEditorialCoinsTotal">$0.00</b></div></div>
        <div class="actions" style="margin-top:16px"><button id="bookEditorialCalculatorClear" class="secondary" type="button">Poner en cero</button><button id="bookEditorialCalculatorDone" class="primary" type="button">Listo</button></div>
        <p class="hint">Esta calculadora no registra pagos, no cambia saldos y no modifica el historial de alumnos.</p>
      </div>`;
    document.body.appendChild(dialog);

    dialog.addEventListener('input',event=>{
      if(!event.target.matches('[data-editorial-denomination]'))return;
      if(Number(event.target.value)<0)event.target.value='0';
      updateTotals();
    });
    byId('bookEditorialCalculatorClose').addEventListener('click',()=>dialog.close());
    byId('bookEditorialCalculatorDone').addEventListener('click',()=>dialog.close());
    byId('bookEditorialCalculatorClear').addEventListener('click',()=>{
      if(!confirm('¿Poner en cero todas las cantidades de la calculadora editorial?'))return;
      dialog.querySelectorAll('[data-editorial-denomination]').forEach(input=>input.value='0');
      updateTotals();
    });
    updateTotals();
  }

  function openCalculator(){
    createInterface();
    updateTotals();
    const dialog=byId('bookEditorialCalculatorDialog');
    if(dialog&&!dialog.open)dialog.showModal();
    setTimeout(()=>dialog?.querySelector('[data-editorial-denomination]')?.focus(),50);
  }

  const openButton=byId('bookEditorialCalculatorOpen');
  if(openButton)openButton.addEventListener('click',openCalculator);

  window.BookEditorialCalculator={totals};
})();
