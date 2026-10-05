alter table public.point_transactions add column if not exists award_batch_id uuid;
create unique index if not exists point_transactions_award_batch_student on public.point_transactions(created_by,award_batch_id,student_id) where award_batch_id is not null;
create or replace function public.teacher_award_points_batch(p_shift text,p_group text,p_student_ids text[],p_amount numeric,p_reason text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare uid uuid:=auth.uid(); ids text[]; previous_ids text[]; cnt int; v_amount numeric:=round(p_amount,2);
begin
 if uid is null or not public.is_teacher() then raise exception 'No autorizado'; end if;
 if p_request_id is null or p_amount is null or p_amount::text in ('NaN','Infinity','-Infinity') or v_amount<=0 then raise exception 'Indica una cantidad mayor que cero'; end if;
 if nullif(trim(p_reason),'') is null then raise exception 'Escribe el motivo'; end if;
 select array_agg(distinct x order by x) into ids from unnest(p_student_ids) x where nullif(trim(x),'') is not null;
 if coalesce(cardinality(ids),0)=0 then raise exception 'Selecciona al menos un alumno'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text||p_request_id::text,0));
 select array_agg(student_id order by student_id) into previous_ids from public.point_transactions where created_by=uid and award_batch_id=p_request_id;
 if previous_ids is not null then
  if previous_ids<>ids or exists(select 1 from public.point_transactions where created_by=uid and award_batch_id=p_request_id and (point_transactions.amount<>v_amount or reason is distinct from trim(p_reason))) then raise exception 'Esta solicitud ya se utilizó con otros datos'; end if;
  return jsonb_build_object('ok',true,'count',cardinality(ids),'amount_each',v_amount,'already_saved',true);
 end if;
 perform 1 from public.students where id=any(ids) for share;
 select count(*) into cnt from public.students s where s.id=any(ids) and s.active=true and s.id<>'00001'
   and lower(trim(coalesce(s.shift,'')))=lower(trim(coalesce(p_shift,'')))
   and public.points_norm_group(s.group_name)=public.points_norm_group(p_group);
 if cnt<>cardinality(ids) then raise exception 'Los alumnos deben estar activos y pertenecer al turno y grupo seleccionado'; end if;
 insert into public.point_transactions(student_id,amount,transaction_type,reason,source,created_by,award_batch_id)
 select x,v_amount,'award',trim(p_reason),'teacher',uid,p_request_id from unnest(ids) x;
 return jsonb_build_object('ok',true,'count',cnt,'amount_each',v_amount,'already_saved',false);
end $$;
revoke all on function public.teacher_award_points_batch(text,text,text[],numeric,text,uuid) from public,anon;
grant execute on function public.teacher_award_points_batch(text,text,text[],numeric,text,uuid) to authenticated;