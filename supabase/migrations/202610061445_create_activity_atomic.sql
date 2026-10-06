create or replace function public.teacher_create_activity_atomic(p_activity jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare aid text:=p_activity->>'id'; gs text[]; sh text:=p_activity->>'shift'; existing jsonb; a public.activities%rowtype;
begin
 if auth.uid() is null or not public.is_teacher() then raise exception 'No autorizado'; end if;
 if coalesce(aid,'')='' or length(aid)>128 or coalesce(trim(p_activity->>'name'),'')='' then raise exception 'Actividad incompleta'; end if;
 if lower(trim(sh)) not in ('matutino','vespertino') or p_activity->>'evaluationMode' not in ('delivery','numeric') then raise exception 'Turno o evaluación inválidos'; end if;
 if nullif(p_activity->>'date','') is null or nullif(p_activity->>'dueDate','') is null then raise exception 'Selecciona las fechas'; end if;
 select array_agg(distinct trim(g)) into gs from jsonb_array_elements_text(p_activity->'groups') g where trim(g)<>'';
 if coalesce(cardinality(gs),0)=0 or exists(select 1 from unnest(gs) g where not exists(select 1 from students s where s.active=true and lower(trim(s.shift))=lower(trim(sh)) and s.group_name=g)) then raise exception 'Selecciona grupos válidos del turno'; end if;
 perform pg_advisory_xact_lock(hashtextextended(aid,0));
 select data into existing from activities where id=aid;
 if found and (existing->>'name' is distinct from p_activity->>'name' or existing->>'date' is distinct from p_activity->>'date' or existing->>'dueDate' is distinct from p_activity->>'dueDate' or existing->>'evaluationMode' is distinct from p_activity->>'evaluationMode' or existing->'groups' is distinct from p_activity->'groups') then raise exception 'El identificador ya pertenece a otra actividad'; end if;
 insert into activities(id,group_name,shift,title,activity_date,due_date,evaluation_type,max_score,visible_to_students,closed,data)
 values(aid,gs[1],sh,trim(p_activity->>'name'),(p_activity->>'date')::date,(p_activity->>'dueDate')::date,p_activity->>'evaluationMode',10,true,false,p_activity||jsonb_build_object('group',gs[1]))
 on conflict(id) do nothing;
 insert into activity_groups(activity_id,group_name) select aid,g from unnest(gs) g on conflict do nothing;
 if p_activity->>'evaluationMode'='delivery' then
 insert into activity_records(activity_id,student_id,delivered,delivery_date,data)
 select aid,s.id,false,now(),jsonb_build_object('key',aid||'|'||s.id,'activityId',aid,'studentId',s.id,'status','no','timestamp',now())
 from students s where s.active=true and s.id<>'00001' and lower(trim(s.shift))=lower(trim(sh)) and s.group_name=any(gs)
 on conflict(activity_id,student_id) do nothing;
 end if;
 select * into a from activities where id=aid;
 return jsonb_build_object('ok',true,'activity',a.data,'records',coalesce((select jsonb_agg(to_jsonb(r)) from activity_records r where r.activity_id=aid),'[]'::jsonb));
end $$;
revoke all on function public.teacher_create_activity_atomic(jsonb) from public,anon;
grant execute on function public.teacher_create_activity_atomic(jsonb) to authenticated;