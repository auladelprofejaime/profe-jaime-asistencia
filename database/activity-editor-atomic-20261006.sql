
create or replace function public.teacher_update_activity_atomic(p_activity jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare aid text:=p_activity->>'id'; gs text[]; sh text:=p_activity->>'shift'; mode text:=p_activity->>'evaluationMode'; a public.activities%rowtype; d jsonb;
begin
 if auth.uid() is null or not public.is_teacher() then raise exception 'No autorizado';end if;
 if coalesce(aid,'')='' or coalesce(trim(p_activity->>'name'),'')='' then raise exception 'Actividad incompleta';end if;
 if lower(trim(sh)) not in ('matutino','vespertino') or mode not in ('delivery','numeric') then raise exception 'Turno o evaluación inválidos';end if;
 if nullif(p_activity->>'date','') is null or nullif(p_activity->>'dueDate','') is null then raise exception 'Selecciona las fechas';end if;
 select array_agg(distinct trim(g) order by trim(g)) into gs from jsonb_array_elements_text(p_activity->'groups') g where trim(g)<>'';
 if coalesce(cardinality(gs),0)=0 or exists(select 1 from unnest(gs) g where not exists(select 1 from students s where s.active=true and lower(trim(s.shift))=lower(trim(sh)) and s.group_name=g)) then raise exception 'Selecciona grupos válidos del turno';end if;
 perform pg_advisory_xact_lock(hashtextextended(aid,0));
 select * into a from activities where id=aid for update;
 if not found then raise exception 'Actividad no encontrada';end if;
 if exists(select 1 from activity_records where activity_id=aid) and (mode is distinct from a.evaluation_type or lower(trim(sh)) is distinct from lower(trim(a.shift))) then raise exception 'No se puede cambiar turno o evaluación mientras existan registros';end if;
 d:=coalesce(a.data,'{}')||jsonb_build_object('id',aid,'name',trim(p_activity->>'name'),'shift',sh,'group',gs[1],'groups',to_jsonb(gs),'date',p_activity->>'date','dueDate',p_activity->>'dueDate','week',p_activity->>'week','type',p_activity->>'type','evaluationMode',mode,'updated',now());
 update activities set title=trim(p_activity->>'name'),shift=sh,group_name=gs[1],activity_date=(p_activity->>'date')::date,due_date=(p_activity->>'dueDate')::date,evaluation_type=mode,data=d,updated_at=now() where id=aid;
 delete from activity_groups where activity_id=aid and not (group_name=any(gs));
 insert into activity_groups(activity_id,group_name) select aid,g from unnest(gs) g on conflict do nothing;
 if mode='delivery' then
  insert into activity_records(activity_id,student_id,delivered,delivery_date,data)
  select aid,s.id,false,now(),jsonb_build_object('key',aid||'|'||s.id,'activityId',aid,'studentId',s.id,'status','no','timestamp',now()) from students s where s.active and s.id<>'00001' and lower(trim(s.shift))=lower(trim(sh)) and s.group_name=any(gs)
  on conflict(activity_id,student_id) do nothing;
 end if;
 return jsonb_build_object('ok',true,'activity',d,'records',coalesce((select jsonb_agg(to_jsonb(r)) from activity_records r where r.activity_id=aid),'[]'::jsonb));
end $$;
revoke all on function public.teacher_update_activity_atomic(jsonb) from public,anon;
grant execute on function public.teacher_update_activity_atomic(jsonb) to authenticated;


create or replace function public.teacher_get_activity_editor(p_activity_id text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare a public.activities%rowtype; gs jsonb;
begin
 if auth.uid() is null or not public.is_teacher() then raise exception 'No autorizado';end if;
 select * into a from activities where id=p_activity_id;if not found then raise exception 'Actividad no encontrada';end if;
 select jsonb_agg(g order by g) into gs from (
  select group_name g from activity_groups where activity_id=a.id
  union select jsonb_array_elements_text(coalesce(a.data->'groups','[]'::jsonb))
  union select a.group_name
 ) q where coalesce(g,'')<>'';
 return jsonb_build_object('ok',true,'has_records',exists(select 1 from activity_records where activity_id=a.id),'activity',coalesce(a.data,'{}'::jsonb)||jsonb_build_object('id',a.id,'name',a.title,'date',a.activity_date,'dueDate',a.due_date,'shift',a.shift,'group',a.group_name,'groups',coalesce(gs,'[]'::jsonb),'evaluationMode',a.evaluation_type,'closed',a.closed));
end $$;
revoke all on function public.teacher_get_activity_editor(text) from public,anon;
grant execute on function public.teacher_get_activity_editor(text) to authenticated;
