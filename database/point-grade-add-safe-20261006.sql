
create table public.point_grade_add_requests (
 request_id uuid primary key, student_id text not null, period_id uuid not null,
 amount numeric not null, source text not null, result jsonb not null, created_at timestamptz not null default now()
);
alter table public.point_grade_add_requests enable row level security;
revoke all on public.point_grade_add_requests from public, anon, authenticated;
create function public.points_add_grade_internal(p_student_id text,p_period_id uuid,p_amount numeric,p_request_id uuid,p_source text,p_actor uuid)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare old public.point_grade_add_requests%rowtype; used numeric; result jsonb;
begin
 if p_request_id is null or p_amount is null or p_amount::text in ('NaN','Infinity','-Infinity') or round(p_amount,2)<=0 then raise exception 'Cantidad inválida'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 select * into old from public.point_grade_add_requests where request_id=p_request_id;
 if found then
  if old.student_id<>p_student_id or old.period_id<>p_period_id or old.amount<>round(p_amount,2) or old.source<>p_source then raise exception 'La solicitud ya tiene otros datos'; end if;
  return old.result;
 end if;
 perform 1 from public.methodologies where id=(select methodology_id from public.point_periods where id=p_period_id) for update;
 select greatest(0,coalesce(-sum(amount),0)) into used from public.point_transactions where student_id=p_student_id and period_id=p_period_id and transaction_type in ('grade_use','grade_refund');
 result:=public.points_set_grade_use_internal(p_student_id,p_period_id,used+round(p_amount,2),p_source,p_actor);
 insert into public.point_grade_add_requests(request_id,student_id,period_id,amount,source,result) values(p_request_id,p_student_id,p_period_id,round(p_amount,2),p_source,result);
 return result;
end $$;
revoke all on function public.points_add_grade_internal(text,uuid,numeric,uuid,text,uuid) from public,anon,authenticated;
create function public.teacher_add_grade_points(p_student_id text,p_period_id uuid,p_amount numeric,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
begin
 if auth.uid() is null or not public.is_teacher() then raise exception 'No autorizado';end if;
 return public.points_add_grade_internal(p_student_id,p_period_id,p_amount,p_request_id,'teacher',auth.uid());
end $$;
revoke all on function public.teacher_add_grade_points(text,uuid,numeric,uuid) from public,anon;
grant execute on function public.teacher_add_grade_points(text,uuid,numeric,uuid) to authenticated;
create function public.portal_add_grade_points(p_token text,p_period_id uuid,p_amount numeric,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare sid text; r text;
begin
 select x.student_id,x.role into sid,r from public.portal_session_info(p_token) x;
 if sid is null or r<>'student' then raise exception 'Sesión inválida';end if;
 return public.points_add_grade_internal(sid,p_period_id,p_amount,p_request_id,'student',null);
end $$;
revoke all on function public.portal_add_grade_points(text,uuid,numeric,uuid) from public;
grant execute on function public.portal_add_grade_points(text,uuid,numeric,uuid) to anon,authenticated;
