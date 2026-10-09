window.renderMethodologyPointsIndividualPdf=async function(options={}){
  let data=options.data||window._lastMethodologyCalculation;
  const {methodology:m,activities,rows}=data;
  let timer;
  const details=options.details||await Promise.race([ProfeSupabase.rpc('teacher_methodology_report_points',{p_methodology_id:m.id}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('La consulta de puntos tardó demasiado. Vuelve a intentar.')),15000)})]).finally(()=>clearTimeout(timer));
  if(details?.methodology_id!==m.id)throw new Error('No se pudieron consultar los puntos del reporte.');
  const records=options.records||await all('activityRecords');
  const recordMap=new Map(records.map(r=>[r.key,r]));
  const {jsPDF}=window.jspdf;
  const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
  const subject=m.subject||'Español';
  const teacher='Profr. Jaime Armando Pérez Vázquez';

  rows.forEach((row,rowIndex)=>{
    if(rowIndex>0)doc.addPage();
    const student=row.student;
    const detail=details.students?.[student.id];
    if(!detail?.grade)throw new Error('No hay calificación guardada para '+(student.name||student.id)+'. Guarda los promedios antes de generar el reporte.');
    const g=detail.grade,base=Number(g.base||0)+Number(g.manualExtra||0);
    const initial=FinalGradePoints.normalBase(g);
    const finalGrade=g.monthlyGrade??g.rounded;
    const finalText=finalGrade==null?'PENDIENTE':Number(finalGrade).toFixed(1);

    // Encabezado institucional común
    pdfHeader(doc,'Reporte individual de metodología',subject.toUpperCase());

    // Student and final
    doc.setTextColor(33,27,18);
    doc.setFontSize(12);
    doc.text(doc.splitTextToSize(`Alumno: ${student.name||student.id}`,135)[0],14,39);
    doc.setFontSize(9);
    doc.text(`Grupo: ${m.group}   No. de lista: ${student.number}   Mes evaluado: ${m.month||'Sin definir'}`,14,45);
    doc.setFont('helvetica','bold');
    doc.setFontSize(11);
    doc.text('CALIFICACIÓN FINAL',158,37);
    doc.setFontSize(20);
    if(row.final===null)doc.setTextColor(180,83,9); else doc.setTextColor(22,101,52);
    doc.text(finalText,177,47,{align:'center'});
    doc.setTextColor(33,27,18);

    const cells=[
     ['Calificación inicial',initial.toFixed(1)],
     ['Calificación final',finalText],
     ['Puntos aplicados (propios y donados)',Number(g.pointsUsed||0).toFixed(2)],
     ['Puntos donados a compañeros',Number(detail.donated||0).toFixed(2)],
     ['Puntos recibidos por donación',Number(detail.received||0).toFixed(2)],
     ['Puntos extras disponibles',Number(detail.available||0).toFixed(2)]
    ];
    cells.forEach(([label,value],i)=>{
     const x=12+(i%3)*62,cy=53+Math.floor(i/3)*18;
     doc.setFillColor(249,246,231);doc.rect(x,cy,61,17,'F');
     doc.setTextColor(55,55,55);doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.text(label,x+3,cy+5);
     doc.setFont('helvetica','bold');doc.setFontSize(12);doc.text(value,x+3,cy+13);
    });
    doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor(85,85,85);
    doc.text('Donaciones y uso: esta evaluación. Disponibles: saldo actual al generar el reporte.',14,94);
    doc.text('Promedio sin puntos (incluye extra manual): '+base.toFixed(2)+' · Promedio con puntos: '+Number(g.finalDecimal??g.obtainedAverage??finalGrade).toFixed(2),14,99);
    doc.text('Los puntos recibidos se aplican automáticamente; el excedente queda disponible.',14,104);
    let y=110;
    m.criteria.forEach((criterion,criterionIndex)=>{
      const criterionActivities=activities.filter(a=>m.assignments?.[a.id]===criterion.id&&(!window.StudentEvaluationRange||StudentEvaluationRange.applicable(m,student.id,a)));
      const criterionGrade=row.criterionGrades[criterion.id];
      const weights=window.StudentEvaluationRange?.weights?.(m,student.id,activities);
      const percent=weights?.excluded?.includes(criterion.id)?0:(weights?.active?Number(criterion.percent)*100/weights.active:Number(criterion.percent));
      const contribution=criterionGrade===null?null:criterionGrade*(percent/100);
      const color=criterionColor(criterionIndex);

      if(y>245){
        doc.addPage();
        pdfHeader(doc,'Reporte individual de metodología',subject.toUpperCase());
        y=36;
      }

      doc.setFillColor(...color);
      doc.rect(12,y,186,13,'F');
      doc.setTextColor(255,255,255);
      doc.setFont('helvetica','bold');
      doc.setFontSize(11);
      doc.text(criterion.name,16,y+8);
      doc.text(`${Number(percent).toFixed(0)}%`,155,y+8,{align:'right'});
      doc.text(contribution===null?'Pendiente':contribution.toFixed(2),193,y+8,{align:'right'});
      y+=13;

      if(!criterionActivities.length){
        doc.setFillColor(247,247,247);
        doc.rect(12,y,186,10,'F');
        doc.setTextColor(90,90,90);
        doc.setFont('helvetica','normal');
        doc.setFontSize(9);
        doc.text('Sin actividades asignadas a este criterio.',16,y+6.5);
        y+=10;
      }else{
        criterionActivities.forEach((activity,activityIndex)=>{
          const score=scoreForActivity(activity,student.id,recordMap);
          if(y>268){
            doc.addPage();
            y=18;
          }
          if(activityIndex%2===1)doc.setFillColor(242,242,242);
          else doc.setFillColor(255,255,255);
          doc.rect(12,y,186,10,'F');
          doc.setTextColor(33,33,33);
          doc.setFont('helvetica','normal');
          doc.setFontSize(9.5);
          const activityName=doc.splitTextToSize(activity.name,145);
          doc.text(activityName[0],16,y+6.5);
          doc.setFont('helvetica','bold');
          doc.text(score===null?'—':score.toFixed(1),193,y+6.5,{align:'right'});
          y+=10;
        });
      }
      y+=5;
    });

    if(row.pending.length){
      if(y>255){doc.addPage();y=18}
      doc.setFillColor(255,247,220);
      const pendingLines=doc.splitTextToSize(row.pending.join(', '),176).slice(0,3);
      doc.rect(12,y,186,24,'F');
      doc.setTextColor(150,80,0);
      doc.setFont('helvetica','bold');
      doc.setFontSize(9);
      doc.text('ACTIVIDADES PENDIENTES DE CALIFICAR:',16,y+6);
      doc.setFont('helvetica','normal');
      doc.text(pendingLines,16,y+11);
    }

    doc.setTextColor(90,90,90);
    doc.setFontSize(7.5);
    doc.text(`Metodología: ${m.name}`,14,286);
  });

  pdfFooter(doc);
  if(options.returnDocument)return doc;
  const preview=`<p><b>Materia:</b> ${safe(subject)} · <b>Mes:</b> ${safe(m.month||'Sin definir')}</p>
  <p><b>Docente:</b> ${safe(teacher)}</p>
  <p>Se generó un solo archivo con <b>${rows.length} reportes</b>, con calificación inicial y final, puntos aplicados, donaciones y saldo disponible.</p>`;
  printContent(
    'Reportes individuales de metodología',
    preview,
    pdfBlob(doc),
    `reportes_individuales_${m.group}_${(m.month||m.name).replace(/[^a-z0-9]+/gi,'_')}.pdf`
  );
};
