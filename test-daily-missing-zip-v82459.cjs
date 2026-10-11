const fs=require('fs'),assert=require('assert/strict'),{JSDOM}=require('jsdom');
(async()=>{
 const w=new JSDOM('<input id="dailyDate" value="2026-10-12"><button id="dailyMissingZip"></button><div id="dailyMissingZipResult"></div>',{url:'https://test.invalid',runScripts:'outside-only'}).window;
 w.TextEncoder=TextEncoder;w.Blob=Blob;w.File=File;let blob,calls=0,fail=false;
 w.URL.createObjectURL=b=>{blob=b;return 'blob:test'};w.URL.revokeObjectURL=()=>{};
 w.eval(fs.readFileSync('/tmp/daily-jspdf-qa.js','utf8'));w.eval(fs.readFileSync('daily-missing-zip-v82459.js','utf8'));
 const roster=[{student_id:'1',name:'JOSÉ PÉREZ',list_number:1},{student_id:'2',name:'JOSÉ PÉREZ',list_number:2},{student_id:'3',name:'MARÍA / LÓPEZ',list_number:3},{student_id:'4',name:'SIN REVISAR',list_number:4}];
 const missing={subject:'Matemáticas',title:'Resolver los ejercicios de Mathletics.',due_date:'2026-10-12',status:'missing'};
 const data={roster,reviews:[{student_id:'1',results:[missing,{...missing,title:'Tarea presentada',status:'presented'},{...missing,title:'Nivel desconocido',status:'unverified'}]},{student_id:'2',results:Array.from({length:40},(_,i)=>({...missing,subject:'Español',title:'Tarea '+(i+1)+': Leer el texto y responder las preguntas en el cuaderno.'}))},{student_id:'3',results:[{...missing,status:'presented'}]}]};
 w.DailyTaskReview={data,load:async()=>{calls++;return !fail}};
 assert.equal(w.DailyMissingReports.dateLabel('2026-10-12'),'12/10/2026');
 const before=JSON.stringify(data),files=w.DailyMissingReports.reportFiles(data,'2026-10-12');assert.equal(files.length,2);assert.match(files[0].name,/JOSÉ PÉREZ.pdf$/);assert.match(files[1].name,/JOSÉ PÉREZ \(2\).pdf$/);
 const first=w.DailyMissingReports.generate();await w.DailyMissingReports.generate();await first;assert.equal(calls,1);assert.equal(JSON.stringify(data),before);assert.match(w.document.getElementById('dailyMissingZipResult').textContent,/2 PDFs/);
 fs.writeFileSync('/tmp/daily-missing-qa.zip',Buffer.from(await blob.arrayBuffer()));fs.writeFileSync('/tmp/daily-missing-qa.pdf',Buffer.from(files[0].bytes));fs.writeFileSync('/tmp/daily-missing-long-qa.pdf',Buffer.from(files[1].bytes));
 fail=true;await w.DailyMissingReports.generate();assert.match(w.document.getElementById('dailyMissingZipResult').textContent,/No se generó/);assert.equal(w.document.getElementById('dailyMissingZip').disabled,false);
 fail=false;data.reviews=[];await w.DailyMissingReports.generate();assert.match(w.document.getElementById('dailyMissingZipResult').textContent,/No hay tareas faltantes/);
 w.close();console.log('PASS: missing-only PDFs, due dates, duplicate names, multi-page layout, no writes, fresh query, no false empty ZIP, failure handling, double-click guard.');
})().catch(e=>{console.error(e);process.exitCode=1});
