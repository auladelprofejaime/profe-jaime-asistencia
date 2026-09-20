// App Docente v8.23.24 · Gestión de docentes de Mérito
(function(){
  const $m=s=>document.querySelector(s);
  let staffCache=[];

  async function rpc(name,args={}){
    if(!window.ProfeSupabase)throw new Error('Supabase no está disponible.');
    return await window.ProfeSupabase.rpc(name,args);
  }

  function normalizeCode(v){return String(v||'').replace(/\D+/g,'').slice(0,6)}

  async function refreshTeacherFolioSummary(){
    const box=$m('#meritTeacherFolioSummary');if(!box)return;
    try{
      const d=await rpc('teacher_merit_placeholder_summary',{});
      box.textContent=`${Number(d.available||0)} disponibles · ${Number(d.assigned||0)} activados`;
    }catch(e){box.textContent='No se pudo cargar'}
  }

  async function findTeacherFolio(){
    const input=$m('#meritTeacherFolioScan'),code=normalizeCode(input?.value);
    const result=$m('#meritTeacherFolioResult'),status=$m('#meritTeacherFolioStatus');
    if(status)status.textContent='';
    result?.classList.remove('hidden');
    if(!/^\d{6}$/.test(code)){
      status.textContent='Escanea o escribe un ID válido, por ejemplo 700002.';
      return;
    }
    try{
      const d=await rpc('teacher_merit_lookup_staff_code',{p_staff_code:code});
      if(!d?.ok){status.textContent='No se encontró ese ID.';return}
      $m('#meritTeacherFolioCode').value=d.staff_code||code;
      if(d.assigned){
        $m('#meritTeacherFolioActivate').disabled=true;
        status.textContent=d.profile_complete
          ?`Este ID ya pertenece a ${d.display_name||'un docente'}.`
          :'Este ID ya fue activado y está pendiente de que el docente complete sus datos.';
      }else{
        $m('#meritTeacherFolioActivate').disabled=false;
        status.textContent='ID disponible. Pulsa Activar participación.';
      }
    }catch(e){status.textContent='No se pudo consultar el ID: '+(e.message||e)}
  }

  async function activateTeacherFolio(){
    const code=normalizeCode($m('#meritTeacherFolioCode')?.value);
    const status=$m('#meritTeacherFolioStatus'),btn=$m('#meritTeacherFolioActivate');
    btn.disabled=true;status.textContent='Activando…';
    try{
      const d=await rpc('teacher_merit_activate_staff_code',{p_staff_code:code});
      if(!d?.ok){
        if(d?.reason==='already_activated')throw new Error('Este ID ya fue activado.');
        throw new Error(d?.reason||'No se pudo activar.');
      }
      status.textContent=`✓ ID ${code} activado. El docente deberá completar sus datos y cambiar su NIP en su app.`;
      await refreshTeacherFolioSummary();
      setTimeout(()=>{
        $m('#meritTeacherFolioScan').value='';
        $m('#meritTeacherFolioResult')?.classList.add('hidden');
        $m('#meritTeacherFolioScan')?.focus();
      },900);
    }catch(e){status.textContent='No se pudo activar: '+(e.message||e);btn.disabled=false}
  }

  async function resetStaffPin(id,name){
    if(!confirm(`¿Generar un NIP temporal nuevo para ${name}?\n\nSolo se cerrarán las sesiones de este docente. Su nombre, asignatura e historial se conservarán.`))return;
    try{
      const d=await rpc('teacher_merit_reset_staff_pin',{p_staff_id:id});
      if(!d?.ok)throw new Error(d?.reason||'No se pudo generar.');
      const box=$m('#meritActivationBox'),code=$m('#meritActivationCode');
      if(code)code.textContent=d.temporary_pin;
      if(box){
        const hint=box.querySelector('.hint');
        if(hint)hint.textContent=`NIP temporal para ${d.display_name} · ID ${d.staff_code}`;
        box.classList.remove('hidden');
        box.scrollIntoView({behavior:'smooth',block:'center'});
      }
      alert(`NIP temporal de ${d.display_name}: ${d.temporary_pin}\n\nAl ingresar deberá cambiar únicamente su NIP.`);
      await loadAndDecorateStaff();
    }catch(e){alert('No se pudo generar el NIP temporal: '+(e.message||e))}
  }

  async function loadAndDecorateStaff(){
    try{
      const rows=await rpc('teacher_merit_staff',{});
      staffCache=Array.isArray(rows)?rows:[];
      decorateStaffTable();
    }catch(e){console.warn('merit reset pin',e)}
  }

  function decorateStaffTable(){
    const root=$m('#meritStaffList');if(!root)return;
    root.querySelectorAll('tbody tr').forEach(tr=>{
      const id=tr.querySelector('.meritActive')?.dataset.id||tr.querySelector('.meritEditStaffBtn')?.dataset.id;
      if(!id)return;
      const st=staffCache.find(x=>String(x.id)===String(id));
      if(!st)return;
      tr.querySelectorAll('.meritCode').forEach(b=>b.remove());
      const first=tr.children[0];
      if(first&&st.staff_code&&!first.querySelector('.merit-staff-id')){
        const small=document.createElement('div');
        small.className='hint merit-staff-id';
        small.textContent='ID '+st.staff_code;
        first.appendChild(small);
      }
      const action=tr.children[tr.children.length-1];
      if(action&&st.staff_code&&st.active&&!action.querySelector('.meritResetPin')){
        const b=document.createElement('button');
        b.type='button';b.className='secondary meritResetPin';
        b.textContent='Generar NIP temporal';
        b.onclick=()=>resetStaffPin(st.id,st.display_name);
        action.querySelector('.merit-inline-actions')?.prepend(b) || action.prepend(b);
      }
    });
  }

  function code39Svg(text){
    const patterns={'0':'nnnwwnwnn','1':'wnnwnnnnw','2':'nnwwnnnnw','3':'wnwwnnnnn','4':'nnnwwnnnw','5':'wnnwwnnnn','6':'nnwwwnnnn','7':'nnnwnnwnw','8':'wnnwnnwnn','9':'nnwwnnwnn','*':'nwnnwnwnn'};
    const value='*'+text+'*';let x=10,bars='',wide=3,narrow=1.2,h=54;
    for(const ch of value){const p=patterns[ch];if(!p)continue;for(let i=0;i<p.length;i++){const w=p[i]==='w'?wide:narrow;if(i%2===0)bars+=`<rect x="${x.toFixed(2)}" y="2" width="${w}" height="${h}" fill="#111"/>`;x+=w}x+=narrow}
    return `<svg viewBox="0 0 ${x+10} 70" width="100%" height="86" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">${bars}<text x="${(x+10)/2}" y="67" text-anchor="middle" font-family="Arial,sans-serif" font-size="8">${text}</text></svg>`;
  }

  function barcode39Pattern(text){
    const patterns={'0':'nnnwwnwnn','1':'wnnwnnnnw','2':'nnwwnnnnw','3':'wnwwnnnnn','4':'nnnwwnnnw','5':'wnnwwnnnn','6':'nnwwwnnnn','7':'nnnwnnwnw','8':'wnnwnnwnn','9':'nnwwnnwnn','*':'nwnnwnwnn'};
    return {patterns,value:'*'+text+'*'};
  }

  function drawCode39Pdf(doc,text,x,y,width,height){
    const {patterns,value}=barcode39Pattern(text);
    const units=[];
    for(const ch of value){
      const p=patterns[ch];if(!p)continue;
      for(let i=0;i<p.length;i++)units.push({bar:i%2===0,wide:p[i]==='w'});
      units.push({bar:false,wide:false});
    }
    const totalUnits=units.reduce((s,u)=>s+(u.wide?3:1),0);
    const unit=width/totalUnits;
    let xx=x;
    doc.setFillColor(20,20,20);
    for(const u of units){
      const w=unit*(u.wide?3:1);
      if(u.bar)doc.rect(xx,y,w,height,'F');
      xx+=w;
    }
  }

  async function imageToDataUrl(url){
    const r=await fetch(url,{cache:'no-store'});
    if(!r.ok)throw new Error('No se pudo cargar el logo de Mérito.');
    const blob=await r.blob();
    return await new Promise((resolve,reject)=>{
      const fr=new FileReader();
      fr.onload=()=>resolve(fr.result);
      fr.onerror=()=>reject(new Error('No se pudo preparar el logo.'));
      fr.readAsDataURL(blob);
    });
  }

  function ensureMeritPdfViewer(){
    let dlg=$m('#meritAccessPdfDialog');
    if(dlg)return dlg;
    const style=document.createElement('style');
    style.id='merit-access-pdf-style';
    style.textContent=`
      #meritAccessPdfDialog{width:min(1100px,calc(100% - 20px));height:min(92vh,900px);padding:0;border:0;border-radius:18px;overflow:hidden;box-shadow:0 20px 70px #0008}
      #meritAccessPdfDialog::backdrop{background:#0009}
      #meritAccessPdfDialog .pdfbar{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:12px 14px;background:#fff;border-bottom:1px solid #ddd}
      #meritAccessPdfDialog .pdfbar h3{margin:0;font-size:1rem}
      #meritAccessPdfDialog .pdfactions{display:flex;gap:8px;flex-wrap:wrap}
      #meritAccessPdfDialog iframe{display:block;width:100%;height:calc(100% - 68px);border:0;background:#eee}
      @media(max-width:620px){#meritAccessPdfDialog{width:100%;height:100%;max-width:none;max-height:none;border-radius:0}#meritAccessPdfDialog .pdfactions{width:100%;display:grid;grid-template-columns:1fr 1fr 1fr}#meritAccessPdfDialog .pdfactions button{padding:9px 6px}}
    `;
    document.head.appendChild(style);
    dlg=document.createElement('dialog');
    dlg.id='meritAccessPdfDialog';
    dlg.innerHTML=`<div class="pdfbar"><h3>PDF · Accesos docentes</h3><div class="pdfactions"><button id="meritPdfShare" type="button" class="primary">Compartir PDF</button><button id="meritPdfDownload" type="button" class="secondary">Descargar PDF</button><button id="meritPdfClose" type="button" class="secondary">Cerrar</button></div></div><iframe id="meritPdfFrame" title="Vista previa del PDF"></iframe>`;
    document.body.appendChild(dlg);
    return dlg;
  }

  function openMeritPdfViewer(blob,fileName){
    const dlg=ensureMeritPdfViewer();
    const frame=$m('#meritPdfFrame');
    const url=URL.createObjectURL(blob);
    frame.src=url;
    dlg.dataset.pdfUrl=url;
    dlg.dataset.fileName=fileName;
    dlg._pdfBlob=blob;

    $m('#meritPdfClose').onclick=()=>{
      try{URL.revokeObjectURL(dlg.dataset.pdfUrl||'')}catch(_){}
      frame.src='about:blank';
      dlg._pdfBlob=null;
      dlg.close();
    };
    $m('#meritPdfDownload').onclick=()=>{
      const a=document.createElement('a');
      a.href=dlg.dataset.pdfUrl;
      a.download=dlg.dataset.fileName||fileName;
      document.body.appendChild(a);a.click();a.remove();
    };
    $m('#meritPdfShare').onclick=async()=>{
      const currentBlob=dlg._pdfBlob;
      const name=dlg.dataset.fileName||fileName;
      if(!currentBlob)return;
      try{
        const file=new File([currentBlob],name,{type:'application/pdf'});
        if(navigator.share && (!navigator.canShare || navigator.canShare({files:[file]}))){
          await navigator.share({title:'Mérito Gabino A. Palma · Accesos docentes',files:[file]});
        }else{
          const a=document.createElement('a');a.href=dlg.dataset.pdfUrl;a.download=name;document.body.appendChild(a);a.click();a.remove();
          alert('Este dispositivo no permite compartir archivos directamente desde la app. El PDF se descargó para que puedas enviarlo desde Archivos.');
        }
      }catch(e){
        if(e?.name!=='AbortError')alert('No se pudo compartir el PDF: '+(e.message||e));
      }
    };
    if(!dlg.open)dlg.showModal();
  }

  async function buildTeacherAccessPdf(credentials){
    const jsPDF=window.jspdf?.jsPDF;
    if(!jsPDF)throw new Error('El generador PDF no está disponible. Actualiza la app e inténtalo de nuevo.');
    const doc=new jsPDF({orientation:'portrait',unit:'pt',format:'letter',compress:true});
    const pageW=612,pageH=792,half=396,margin=24,cardX=24,cardW=564,cardH=348;
    let logo=null;
    const meritDocentesQr='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKQAAACkAQAAAAAxzrjsAAABiElEQVR4nNWXMYotSQwEQ8Pzs27w7n+sd4OsE8QaPcbCLgMDMv5vp2gZiVBHpbJH/vvcr/8pwp9RnZlz5p473DvMzFnQxWgaahKSaLqiSyICNE3Ihu4LgJOD4/R4fqvwk+5tzslten6t8NN8QxOIujTfcSD/KlzIZ6NfVZICzfO6w4MhBANpYYkzSpvvEwwb/Y6M89DF5xRyuuAPWNIkFkiz1O8XlHN770PFZ8qGP7zIyAxAPhkcN3wS2wdgI6ElO5xBJa1tRbKmm2iTQixd8TOkNo1NGpAVHl6Qc3u8AS7PueIP1Rp4Voau9IuYpI81xOLKd3tRPvAu73qZ9HRnDtBnu0lD1vi1MdWGSht2ODPFJNLkG7kl/1U1tm1kaV8o8FxhSpZ4+ILRcij07ce74pPjOOEW4M3nEHb2hWoIPJ5jVub7YiDXS05Lz/mtwk95xxBtNO7cixdMOHhPD3CHu5e2C+8euVOapVxNoqJtIDv8fs+3j/mIS/kB4Un/7ZPPXPGd+cv+s/4BrlRM55srItIAAAAASUVORK5CYII=';
    try{logo=await imageToDataUrl(new URL('logo-merito-gabino-a-palma.jpeg',location.href).href)}catch(_){}

    function card(item,slot){
      const y0=pageH-half*(slot+1),cardY=y0+24;
      const code=String(item.staff_code||''),pin=String(item.pin||'');
      doc.setDrawColor(215,177,30);doc.setLineWidth(1.4);
      doc.roundedRect(cardX,cardY,cardW,cardH,12,12,'S');

      if(logo)doc.addImage(logo,'JPEG',cardX+18,cardY+18,54,54,undefined,'FAST');
      const tx=cardX+(logo?84:22);
      doc.setTextColor(128,104,0);doc.setFont('helvetica','bold');doc.setFontSize(9);
      doc.text('MÉRITO GABINO A. PALMA',tx,cardY+31);
      doc.setTextColor(25,25,25);doc.setFontSize(18);
      doc.text('Acceso docente',tx,cardY+54);
      doc.setTextColor(110,110,110);doc.setFontSize(8.5);
      doc.text('Una app de Aula del Profe Jaime',tx,cardY+70);

      doc.setTextColor(20,20,20);doc.setFontSize(17);doc.setFont('helvetica','bold');
      doc.text(code,cardX+cardW-18,cardY+43,{align:'right'});

      const bw=63,bh=16,bx=cardX+(cardW-bw)/2,by=cardY+103;
      drawCode39Pdf(doc,code,bx,by,bw,bh);
      doc.setFont('helvetica','normal');doc.setFontSize(6.5);doc.setTextColor(30,30,30);
      doc.text(code,cardX+cardW/2,by+25,{align:'center'});

      const gap=18,boxW=(cardW-58-gap)/2,boxY=cardY+142,boxH=54;
      [['ID DOCENTE',code],['NIP INICIAL',pin]].forEach((v,j)=>{
        const xx=cardX+20+j*(boxW+gap);
        doc.setDrawColor(215,177,30);doc.roundedRect(xx,boxY,boxW,boxH,8,8,'S');
        doc.setTextColor(128,104,0);doc.setFont('helvetica','bold');doc.setFontSize(7.5);
        doc.text(v[0],xx+boxW/2,boxY+18,{align:'center'});
        doc.setTextColor(20,20,20);doc.setFontSize(16);
        doc.text(v[1],xx+boxW/2,boxY+41,{align:'center'});
      });

      const noteX=cardX+20,noteY=cardY+217,noteW=cardW-40,noteH=59;
      doc.setFillColor(255,248,215);doc.roundedRect(noteX,noteY,noteW,noteH,8,8,'F');
      doc.setTextColor(25,25,25);doc.setFont('helvetica','bold');doc.setFontSize(8.5);
      doc.text('Acceso de prueba a Mérito Docentes.',noteX+12,noteY+19);
      doc.setFont('helvetica','normal');doc.setFontSize(8);
      const msg='Ingresa con este ID y NIP. Si confirmas tu participación, el Profr. Jaime activará tu ID y la app te pedirá completar tus datos y elegir un NIP personal.';
      doc.text(doc.splitTextToSize(msg,noteW-108),noteX+12,noteY+34,{lineHeightFactor:1.15});
      const qrSize=46,qrX=noteX+noteW-58,qrY=noteY+4;
      doc.addImage(meritDocentesQr,'PNG',qrX,qrY,qrSize,qrSize,undefined,'FAST');
      doc.setTextColor(45,45,45);doc.setFont('helvetica','bold');doc.setFontSize(5.8);
      doc.text('Escanea para ingresar',qrX+qrSize/2,noteY+56,{align:'center'});

      doc.setTextColor(105,105,105);doc.setFont('helvetica','bold');doc.setFontSize(7.5);
      doc.text('Aula del Profe Jaime · Creado por Profesor Jaime Armando',cardX+cardW/2,cardY+327,{align:'center'});
    }

    credentials.forEach((item,i)=>{
      if(i>0 && i%2===0)doc.addPage('letter','portrait');
      card(item,i%2);
      if(i%2===0 && i<credentials.length-1){
        doc.setDrawColor(145,145,145);doc.setLineDashPattern([4,4],0);
        doc.line(20,half,592,half);doc.setLineDashPattern([],0);
      }
    });
    return doc.output('blob');
  }

  async function printTeacherFolios(){
    let credentials=[];
    try{credentials=await rpc('teacher_merit_print_credentials',{})}
    catch(e){alert('No se pudieron cargar las hojas de acceso: '+(e.message||e));return}
    if(!Array.isArray(credentials)||!credentials.length){alert('No hay credenciales iniciales disponibles para generar el PDF.');return}
    const btn=$m('#meritPrintTeacherFolios');
    const old=btn?.textContent;if(btn){btn.disabled=true;btn.textContent='Generando PDF…'}
    try{
      const blob=await buildTeacherAccessPdf(credentials);
      openMeritPdfViewer(blob,'Merito_Gabino_A_Palma_Accesos_Docentes.pdf');
    }catch(e){alert('No se pudo generar el PDF: '+(e.message||e))}
    finally{if(btn){btn.disabled=false;btn.textContent=old||'Generar PDF · 69 accesos'}}
  }

  function resetFolioForm(){
    $m('#meritTeacherFolioResult')?.classList.add('hidden');
    if($m('#meritTeacherFolioScan'))$m('#meritTeacherFolioScan').value='';
    setTimeout(()=>$m('#meritTeacherFolioScan')?.focus(),20);
  }

  function wire(){
    $m('#meritTeacherFolioFind')?.addEventListener('click',findTeacherFolio);
    $m('#meritTeacherFolioActivate')?.addEventListener('click',activateTeacherFolio);
    $m('#meritTeacherFolioCancel')?.addEventListener('click',resetFolioForm);
    $m('#meritPrintTeacherFolios')?.addEventListener('click',printTeacherFolios);
    $m('#meritTeacherFolioScan')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();findTeacherFolio()}});
    document.querySelectorAll('.meritNav[data-merit-pane="staff"]').forEach(b=>b.addEventListener('click',()=>setTimeout(()=>{refreshTeacherFolioSummary();loadAndDecorateStaff();$m('#meritTeacherFolioScan')?.focus()},120)));
    const list=$m('#meritStaffList');
    if(list)new MutationObserver(()=>setTimeout(decorateStaffTable,20)).observe(list,{childList:true,subtree:true});
    refreshTeacherFolioSummary();
    setTimeout(loadAndDecorateStaff,900);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
})();