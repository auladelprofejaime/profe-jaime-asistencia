create or replace function public.teacher_methodology_report_points(p_methodology_id text)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare m public.methodologies; result jsonb;
begin
 if auth.uid() is null or not public.is_teacher() then raise exception 'Solo docentes autorizados'; end if;
 select * into m from public.methodologies where id=p_methodology_id;
 if not found then raise exception 'Metodología no encontrada'; end if;
 select coalesce(jsonb_object_agg(s.id,jsonb_build_object(
 'grade',m.data->'gradeRecords'->s.id,
 'available',public.points_balance(s.id),
 'donated',coalesce(t.donated,0),'received',coalesce(t.received,0))), '{}'::jsonb)
 into result from public.students s
 left join lateral (
 select -sum(amount) filter(where transaction_type='donation_out') donated,
 sum(amount) filter(where transaction_type='donation_in') received
 from public.point_transactions tx where tx.student_id=s.id and tx.period_id in
 (select p.id from public.point_periods p where p.methodology_id=m.id)
 ) t on true
 where lower(trim(s.shift))=lower(trim(m.shift))
 and public.points_norm_group(s.group_name)=public.points_norm_group(m.group_name);
 return jsonb_build_object('methodology_id',m.id,'students',result,'generated_at',now());
end $$;
revoke all on function public.teacher_methodology_report_points(text) from public,anon;
grant execute on function public.teacher_methodology_report_points(text) to authenticated;