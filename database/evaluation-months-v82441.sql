-- Authorized monthly separation. No writes to deliveries, grades or point ledgers.
begin;
do $month_setup$
declare before_grades text; after_grades text; source_count int;
begin
 select count(*) into source_count from public.methodologies
 where cycle='2026-2027' and month='Septiembre' and shift='Matutino' and subject='Español' and group_name in ('22','23','24','25','26');
 if source_count<>5 then raise exception 'Expected exactly five September methods';end if;
 select md5(string_agg(data::text,'' order by id)) into before_grades from public.methodologies where month='Septiembre';
 if exists(select 1 from public.methodologies m where m.month='Septiembre' and (m.data->'assignments' ? 'e6bf6c9f-5b5c-4378-b5e4-fa6f21e147aa' or m.data->'assignments' ? 'b86fa32c-b53e-4b41-8484-2a5d3834402d')) then raise exception 'October activity already assigned to September';end if;

 -- Explicit evaluation month takes precedence over physical application date.
 update public.activities a set data=coalesce(a.data,'{}')||jsonb_build_object('evaluationPeriod','2026-09'),updated_at=now()
 where not (coalesce(a.data,'{}') ? 'evaluationPeriod') and exists(
 select 1 from public.methodologies m where m.cycle='2026-2027' and m.month='Septiembre' and m.shift='Matutino' and m.subject='Español' and m.data->'assignments' ? a.id);
 update public.activities set data=coalesce(data,'{}')||jsonb_build_object('evaluationPeriod','2026-10'),updated_at=now()
 where id in ('e6bf6c9f-5b5c-4378-b5e4-fa6f21e147aa','b86fa32c-b53e-4b41-8484-2a5d3834402d') and not (coalesce(data,'{}') ? 'evaluationPeriod');

 insert into public.methodologies(id,cycle,quarter,month,shift,group_name,subject,closed,data)
 select n.id,m.cycle,m.quarter,'Octubre',m.shift,m.group_name,m.subject,false,
 jsonb_build_object('id',n.id,'name','Evaluación octubre','cycle',m.cycle,'quarter',m.quarter,'month','Octubre','shift',m.shift,'group',m.group_name,'subject',m.subject,
 'closed',false,'created',now(),'updated',now(),'criteria',jsonb_build_array(
 jsonb_build_object('id','oct-examen-35','name','Examen mensual','percent',35),
 jsonb_build_object('id','oct-proyecto-30','name','Avance de proyecto integrador','percent',30),
 jsonb_build_object('id','oct-actividades-20','name','Actividades y tareas','percent',20),
 jsonb_build_object('id','oct-lectura-15','name','Taller de lectura','percent',15)),
 'assignments',jsonb_build_object('e6bf6c9f-5b5c-4378-b5e4-fa6f21e147aa','oct-actividades-20','b86fa32c-b53e-4b41-8484-2a5d3834402d','oct-actividades-20'),
 'gradeRecords','{}'::jsonb,'provisionalPublished',false)
 from public.methodologies m cross join lateral (select gen_random_uuid()::text id where m.id is not null) n
 where m.cycle='2026-2027' and m.month='Septiembre' and m.shift='Matutino' and m.subject='Español' and m.group_name in ('22','23','24','25','26')
 and not exists(select 1 from public.methodologies x where x.cycle=m.cycle and x.quarter=m.quarter and x.month='Octubre' and x.shift=m.shift and x.group_name=m.group_name and x.subject=m.subject);

 select md5(string_agg(data::text,'' order by id)) into after_grades from public.methodologies where month='Septiembre';
 if before_grades is distinct from after_grades then raise exception 'September must remain unchanged';end if;
end $month_setup$;
commit;
