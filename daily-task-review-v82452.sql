create table public.daily_task_roster(student_id text primary key, name text not null, list_number integer not null);
create table public.daily_task_settings(id boolean primary key default true check(id), schedule jsonb not null);
create table public.daily_task_boards(id uuid primary key default gen_random_uuid(), board_date date unique not null, photo text not null default '' check(length(photo)<=1500000), created_at timestamptz not null default now());
create table public.daily_tasks(id uuid primary key,board_id uuid not null references public.daily_task_boards(id),subject text not null check(length(subject) between 1 and 100),title text not null check(length(title) between 1 and 1000),variant text not null default '' check(variant in ('','Upper','Inter','Pre','Danza','Música','Teatro')),due_date date not null);
create index daily_tasks_due_idx on public.daily_tasks(due_date);
create table public.daily_task_profiles(student_id text primary key references public.daily_task_roster,english text not null default '' check(english in ('','Upper','Inter','Pre')),art text not null default '' check(art in ('','Danza','Música','Teatro')));
create table public.daily_task_reviews(student_id text references public.daily_task_roster,review_date date not null,results jsonb not null,revision integer not null default 1,updated_at timestamptz not null default now(),primary key(student_id,review_date));
create table public.daily_task_review_audit(id uuid primary key default gen_random_uuid(),student_id text not null,review_date date not null,previous_results jsonb,new_results jsonb not null,created_at timestamptz not null default now());
alter table public.daily_task_roster enable row level security; revoke all on public.daily_task_roster from public,anon,authenticated;
grant select,insert,update on public.daily_task_roster to authenticated;
create policy daily_teacher_only on public.daily_task_roster for all to authenticated using((select auth.uid())='e35c76f1-b60f-440b-8c88-6acd7efc0128'::uuid) with check((select auth.uid())='e35c76f1-b60f-440b-8c88-6acd7efc0128'::uuid);
alter table public.daily_task_settings enable row level security; revoke all on public.daily_task_settings from public,anon,authenticated;
grant select,insert,update on public.daily_task_settings to authenticated;
create policy daily_teacher_only on public.daily_task_settings for all to authenticated using((select auth.uid())='e35c76f1-b60f-440b-8c88-6acd7efc0128'::uuid) with check((select auth.uid())='e35c76f1-b60f-440b-8c88-6acd7efc0128'::uuid);
alter table public.daily_task_boards enable row level security; revoke all on public.daily_task_boards from public,anon,authenticated;
grant select,insert,update on public.daily_task_boards to authenticated;
create policy daily_teacher_only on public.daily_task_boards for all to authenticated using((select auth.uid())='e35c76f1-b60f-440b-8c88-6acd7efc0128'::uuid) with check((select auth.uid())='e35c76f1-b60f-440b-8c88-6acd7efc0128'::uuid);
alter table public.daily_tasks enable row level security; revoke all on public.daily_tasks from public,anon,authenticated;
grant select,insert,update on public.daily_tasks to authenticated;
create policy daily_teacher_only on public.daily_tasks for all to authenticated using((select auth.uid())='e35c76f1-b60f-440b-8c88-6acd7efc0128'::uuid) with check((select auth.uid())='e35c76f1-b60f-440b-8c88-6acd7efc0128'::uuid);
alter table public.daily_task_profiles enable row level security; revoke all on public.daily_task_profiles from public,anon,authenticated;
grant select,insert,update on public.daily_task_profiles to authenticated;
create policy daily_teacher_only on public.daily_task_profiles for all to authenticated using((select auth.uid())='e35c76f1-b60f-440b-8c88-6acd7efc0128'::uuid) with check((select auth.uid())='e35c76f1-b60f-440b-8c88-6acd7efc0128'::uuid);
alter table public.daily_task_reviews enable row level security; revoke all on public.daily_task_reviews from public,anon,authenticated;
grant select,insert,update on public.daily_task_reviews to authenticated;
create policy daily_teacher_only on public.daily_task_reviews for all to authenticated using((select auth.uid())='e35c76f1-b60f-440b-8c88-6acd7efc0128'::uuid) with check((select auth.uid())='e35c76f1-b60f-440b-8c88-6acd7efc0128'::uuid);
alter table public.daily_task_review_audit enable row level security; revoke all on public.daily_task_review_audit from public,anon,authenticated;
grant select,insert,update on public.daily_task_review_audit to authenticated;
create policy daily_teacher_only on public.daily_task_review_audit for all to authenticated using((select auth.uid())='e35c76f1-b60f-440b-8c88-6acd7efc0128'::uuid) with check((select auth.uid())='e35c76f1-b60f-440b-8c88-6acd7efc0128'::uuid);
insert into public.daily_task_roster values ('V182144','ALVAREZ CERON CRISTIAN LEONARDO',1),('V243403','ARROYO VAZQUEZ MIGUEL ALEXANDER',2),('V243358','BECERRIL JIMENEZ JOEL EMILIO',3),('V243172','CAMACHO RANGEL ERNESTO EMILIANO',4),('V212097','CORTES GOMEZ DEIVID',5),('V243378','GALLARDO MIJANGOS HANNIA SAMANTHA',6),('V182047','GOMEZ LOPEZ DIEGO ZADKIEL',7),('V243145','GONZALEZ HERNANDEZ SEBASTIAN',8),('V182105','HERNANDEZ FLORES DIEGO URIEL',9),('V182279','HERNANDEZ MEDRANO JUAN CARLOS',10),('V182087','LOMELI CAZAREZ SHARON AILYM',11),('V222095','LOPEZ SANCHEZ MATILDA',12),('V243062','MANJARREZ ORTEGA TABATHA XARENI',13),('V243160','MARTINEZ OLIVARES EDGAR GAEL',14),('V182262','MERCADO NAVARRETE MATEO',15),('V192090','MONTES DE OCA MUCIÑO EVANDER',16),('V243007','OLVERA PEREZ VALENTINA',17),('V243005','OSORNIO CARLOS DENISSE VALENTINA',18),('V243098','PEREZ BERISTAIN ANDREA NOEMI',19),('V263378','PEREZ GADNER LIA',20),('V192075','RODRIGUEZ CORTES SOPHIE ALEXIA',21),('V243009','ROMERO CASTAÑEDA ALAN SEBASTIAN',22),('V182006','RUIZ GARRIDO VALERIA YUNUE',23),('V182134','SANCHEZ ILESCAS BRANDON ALEXIS',24),('V212235','SANCHEZ RUIZ NATALIA AGLAE',25),('V192105','SANDOVAL GOMEZ MARIA JOSE',26),('V182140','SANTIAGO ROJAS PEDRO IKER',27),('V182066','TEJADA ESCARCEGA LILIAN THAMARA',28),('V243424','TREJO ACEVEDO PAOLA',29),('V243060','VALDIVIA LUNA ARWEN ANDREA',30);
insert into public.daily_task_settings(id,schedule) values(true,'{"days":["Lunes","Martes","Miércoles","Jueves","Viernes"],"times":["14:15–15:00","15:00–15:45","15:45–16:30","16:55–17:40","17:40–18:25","18:40–19:25","19:25–20:10"],"grid":[["FCE","Matemáticas","Español","Inglés","Inglés"],["Inglés","Español","Química","Historia","Química"],["Matemáticas","Artes","Matemáticas","Matemáticas","Matemáticas"],["Informática","Inglés","Inglés","Laboratorio de Química","Artes"],["Historia","Educación Física","Formación Humana","Laboratorio de Química","Artes"],["Formación Humana","Química","Educación Física","Español","FCE"],["Español","Tutoría","Historia","Robótica","Español"]],"titular":["14:00–14:15","20:10–20:20"],"recess":["16:30–16:55","18:25–18:40"]}'::jsonb);
create function public.teacher_daily_task_load(p_date date) returns jsonb language plpgsql security invoker set search_path='' as $$
begin
if auth.uid() is distinct from 'e35c76f1-b60f-440b-8c88-6acd7efc0128'::uuid then raise exception 'Solo el docente titular puede acceder'; end if;
return jsonb_build_object('roster',(select jsonb_agg(r order by r.list_number) from public.daily_task_roster r),'schedule',(select schedule from public.daily_task_settings where id),'tasks',coalesce((select jsonb_agg(t order by t.subject,t.title) from public.daily_tasks t where due_date=p_date),'[]'::jsonb),'reviews',coalesce((select jsonb_agg(r) from public.daily_task_reviews r where review_date=p_date),'[]'::jsonb),'profiles',coalesce((select jsonb_agg(r) from public.daily_task_profiles r),'[]'::jsonb));
end $$;
create function public.teacher_daily_task_save_board(p_date date,p_photo text,p_tasks jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare b uuid; t jsonb;
begin
if auth.uid() is distinct from 'e35c76f1-b60f-440b-8c88-6acd7efc0128'::uuid then raise exception 'Solo el docente titular puede acceder'; end if;
if p_date is null or jsonb_typeof(p_tasks) is distinct from 'array' or jsonb_array_length(p_tasks)>40 then raise exception 'Revisa la fecha y la lista de tareas'; end if;
insert into public.daily_task_boards(board_date,photo) values(p_date,coalesce(p_photo,'')) on conflict(board_date) do nothing;
select id into b from public.daily_task_boards where board_date=p_date for update;
if exists(select 1 from public.daily_task_reviews r cross join lateral jsonb_array_elements(r.results) x where x->>'board_id'=b::text) then raise exception 'Esta foto ya tiene revisiones. No se pueden cambiar sus tareas; el historial está protegido'; end if;
update public.daily_task_boards set photo=coalesce(p_photo,'') where id=b;
delete from public.daily_tasks where board_id=b;
for t in select value from jsonb_array_elements(p_tasks) loop
insert into public.daily_tasks(id,board_id,subject,title,variant,due_date) values((t->>'id')::uuid,b,trim(t->>'subject'),trim(t->>'title'),coalesce(t->>'variant',''),(t->>'due_date')::date);
end loop;
return jsonb_build_object('ok',true,'board_id',b,'count',jsonb_array_length(p_tasks));
end $$;
grant delete on public.daily_tasks to authenticated;
create function public.teacher_daily_task_save_review(p_date date,p_student_id text,p_missing jsonb,p_english text,p_art text,p_expected_revision integer) returns jsonb language plpgsql security invoker set search_path='' as $$
declare before_row public.daily_task_reviews%rowtype; result jsonb; saved public.daily_task_reviews%rowtype;
begin
if auth.uid() is distinct from 'e35c76f1-b60f-440b-8c88-6acd7efc0128'::uuid then raise exception 'Solo el docente titular puede acceder'; end if;
if p_date is null or jsonb_typeof(p_missing) is distinct from 'array' then raise exception 'Datos de revisión inválidos'; end if;
perform 1 from public.daily_task_roster where student_id=p_student_id for update;
if not found then raise exception 'Alumno fuera del listado 3A'; end if;
select * into before_row from public.daily_task_reviews where student_id=p_student_id and review_date=p_date for update;
if coalesce(before_row.revision,0)<>coalesce(p_expected_revision,0) then raise exception 'La revisión cambió en otra ventana. Actualiza antes de corregir'; end if;
insert into public.daily_task_profiles(student_id,english,art) values(p_student_id,coalesce(p_english,''),coalesce(p_art,'')) on conflict(student_id) do update set english=excluded.english,art=excluded.art;
if exists(select 1 from jsonb_array_elements_text(p_missing) x where not exists(select 1 from public.daily_tasks t where t.id::text=x and t.due_date=p_date and (t.variant='' or t.variant in (p_english,p_art)))) then raise exception 'Una tarea faltante no corresponde al alumno o al día'; end if;
select jsonb_agg(jsonb_build_object('task_id',t.id,'board_id',t.board_id,'subject',t.subject,'title',t.title,'variant',t.variant,'due_date',t.due_date,'status',case when t.variant<>'' and t.variant not in (coalesce(p_english,''),coalesce(p_art,'')) then 'unverified' when p_missing ? t.id::text then 'missing' else 'presented' end) order by t.subject,t.title) into result from public.daily_tasks t where t.due_date=p_date and (t.variant='' or t.variant in (p_english,p_art) or (t.variant in ('Upper','Inter','Pre') and coalesce(p_english,'')='') or (t.variant in ('Danza','Música','Teatro') and coalesce(p_art,'')=''));
if result is null then raise exception 'No hay tareas confirmadas para este alumno y esta fecha'; end if;
insert into public.daily_task_reviews(student_id,review_date,results) values(p_student_id,p_date,result) on conflict(student_id,review_date) do update set results=excluded.results,revision=public.daily_task_reviews.revision+1,updated_at=now() returning * into saved;
insert into public.daily_task_review_audit(student_id,review_date,previous_results,new_results) values(p_student_id,p_date,before_row.results,result);
return to_jsonb(saved);
end $$;
revoke all on function public.teacher_daily_task_load(date),public.teacher_daily_task_save_board(date,text,jsonb),public.teacher_daily_task_save_review(date,text,jsonb,text,text,integer) from public,anon;
grant execute on function public.teacher_daily_task_load(date),public.teacher_daily_task_save_board(date,text,jsonb),public.teacher_daily_task_save_review(date,text,jsonb,text,text,integer) to authenticated;
