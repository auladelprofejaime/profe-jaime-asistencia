create or replace function public.points_apply_pending_donations(p_student_id text,p_period_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare p public.point_periods; m public.methodologies; rec jsonb; tx record;
 pending numeric:=0; donated_used numeric:=0; consume numeric; old_used numeric:=0;
 base numeric; room numeric; amount numeric; src text; uid uuid;
begin
 select * into p from public.point_periods where id=p_period_id;
 if p.id is null or p.closed_at is not null then return jsonb_build_object('applied',0);end if;
 select * into m from public.methodologies where id=p.methodology_id for update;
 rec:=m.data->'gradeRecords'->p_student_id;
 if m.id is null or m.closed or rec is null or rec->>'base' is null then return jsonb_build_object('applied',0);end if;
 -- Attribute grade uses to donations only after they were received.
 for tx in select tt.amount,tt.transaction_type from public.point_transactions tt
 where tt.student_id=p_student_id and tt.period_id=p.id
 and tt.transaction_type in ('donation_in','donation_out','grade_use','grade_refund')
 order by tt.created_at,case tt.transaction_type when 'donation_in' then 0 when 'grade_use' then 1 when 'grade_refund' then 2 else 3 end,tt.id loop
  if tx.transaction_type='donation_in' then pending:=pending+tx.amount;
  elsif tx.transaction_type='grade_use' then
   consume:=least(pending,-tx.amount);pending:=pending-consume;donated_used:=donated_used+consume;old_used:=old_used-tx.amount;
  elsif tx.transaction_type='grade_refund' then
   consume:=least(donated_used,tx.amount);pending:=pending+consume;donated_used:=donated_used-consume;old_used:=old_used-tx.amount;
  elsif tx.transaction_type='donation_out' then pending:=greatest(0,pending+tx.amount);
  end if;
 end loop;
 base:=coalesce((rec->>'base')::numeric,0)+coalesce((rec->>'manualExtra')::numeric,0);
 if exists(select 1 from public.evaluation_final_point_rules where methodology_id=m.id) then base:=greatest(5,public.points_school_round(base));end if;
 room:=greatest(0,10-least(10,base)-greatest(0,old_used));
 amount:=round(least(pending,room,greatest(0,public.points_balance(p_student_id))),2);
 if amount<=0 then return jsonb_build_object('applied',0);end if;
 uid:=auth.uid();src:=case when uid is not null and public.is_teacher() then 'teacher' else 'student' end;
 return public.points_set_grade_use_internal(p_student_id,p.id,greatest(0,old_used)+amount,src,case when src='teacher' then uid else null end)
 ||jsonb_build_object('applied',amount);
end $$;
revoke all on function public.points_apply_pending_donations(text,uuid) from public,anon,authenticated;

create or replace function public.points_auto_apply_received_donation()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 perform public.points_apply_pending_donations(new.student_id,new.period_id);
 return new;
end $$;
revoke all on function public.points_auto_apply_received_donation() from public,anon,authenticated;
create trigger points_auto_apply_received_donation after insert on public.point_transactions
for each row when (new.transaction_type='donation_in')
execute function public.points_auto_apply_received_donation();

create or replace function public.points_apply_donations_on_saved_grades()
returns trigger language plpgsql security definer set search_path=''
as $$
declare x record;
begin
 if pg_trigger_depth()>1 or new.closed or new.data->'gradeRecords' is not distinct from old.data->'gradeRecords' then return new;end if;
 for x in select distinct t.student_id,t.period_id from public.point_transactions t
 join public.point_periods p on p.id=t.period_id where p.methodology_id=new.id
 and t.transaction_type='donation_in' and new.data->'gradeRecords' ? t.student_id
 and (old.data->'gradeRecords'->t.student_id is null
 or new.data->'gradeRecords'->t.student_id->'base' is distinct from old.data->'gradeRecords'->t.student_id->'base'
 or new.data->'gradeRecords'->t.student_id->'manualExtra' is distinct from old.data->'gradeRecords'->t.student_id->'manualExtra') loop
 perform public.points_apply_pending_donations(x.student_id,x.period_id);
 end loop;
 return new;
end $$;
revoke all on function public.points_apply_donations_on_saved_grades() from public,anon,authenticated;
create trigger points_apply_donations_on_saved_grades after update of data on public.methodologies
for each row execute function public.points_apply_donations_on_saved_grades();