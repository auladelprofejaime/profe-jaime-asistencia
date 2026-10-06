CREATE OR REPLACE FUNCTION public.points_set_grade_use_internal(p_student_id text, p_period_id uuid, p_target_amount numeric, p_source text, p_created_by uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare p public.point_periods%rowtype; st public.students%rowtype; m public.methodologies%rowtype; rec jsonb; old_used numeric:=0; available_before numeric:=0; delta numeric:=0; base_grade numeric; manual_extra numeric:=0; max_use numeric:=0; new_final numeric; new_rounded integer; newdata jsonb; choice_value text; has_donation boolean;
begin
  select * into p from public.point_periods where id=p_period_id; if p.id is null then raise exception 'Periodo no encontrado'; end if;
  if p.closed_at is not null or now()<p.opens_at or now()>=p.closes_at then raise exception 'El periodo de puntos no está abierto'; end if;
  select * into st from public.students where id=p_student_id and active=true; if st.id is null then raise exception 'Alumno no encontrado'; end if;
  if p_student_id<>'00001' and (lower(trim(coalesce(st.shift,'')))<>lower(trim(coalesce(p.shift,''))) or public.points_norm_group(st.group_name)<>public.points_norm_group(p.group_name)) then raise exception 'El alumno no pertenece al grupo de este periodo'; end if;
  if p_target_amount is null or p_target_amount<0 then raise exception 'Cantidad inválida'; end if;
  select * into m from public.methodologies where id=p.methodology_id for update; if m.id is null then raise exception 'Metodología no encontrada'; end if;
  rec:=coalesce(m.data->'gradeRecords'->p_student_id,'{}'::jsonb); if rec='{}'::jsonb or rec->>'base' is null then raise exception 'El alumno todavía no tiene una calificación provisional calculada'; end if;
  base_grade:=coalesce((rec->>'base')::numeric,0); manual_extra:=coalesce((rec->>'manualExtra')::numeric,0); max_use:=greatest(0,10-least(10,base_grade+manual_extra));
  if p_target_amount>max_use+0.0001 then raise exception 'No necesitas tantos puntos para llegar a 10'; end if;
  select coalesce(-sum(amount),0) into old_used from public.point_transactions where student_id=p_student_id and period_id=p_period_id and transaction_type in ('grade_use','grade_refund'); old_used:=greatest(0,old_used);
  available_before:=public.points_balance(p_student_id)+old_used; if p_target_amount>available_before+0.0001 then raise exception 'No tienes suficientes puntos disponibles'; end if;
  delta:=round(p_target_amount-old_used,2);
  if delta>0 then insert into public.point_transactions(student_id,amount,transaction_type,reason,period_id,methodology_id,source,created_by) values(p_student_id,-delta,'grade_use','Aplicados a '||coalesce(p.month,'calificación mensual'),p.id,p.methodology_id,p_source,p_created_by);
  elsif delta<0 then insert into public.point_transactions(student_id,amount,transaction_type,reason,period_id,methodology_id,source,created_by) values(p_student_id,abs(delta),'grade_refund','Devolución de puntos de '||coalesce(p.month,'calificación mensual'),p.id,p.methodology_id,p_source,p_created_by); end if;
  new_final:=least(10,greatest(0,base_grade+manual_extra+p_target_amount)); new_rounded:=greatest(5,public.points_school_round(new_final));
  rec:=rec||jsonb_build_object('pointsUsed',round(p_target_amount,2),'finalDecimal',round(new_final,2),'rounded',new_rounded,'monthlyGrade',new_rounded,'obtainedAverage',round(new_final,2),'updated',now());
  newdata:=jsonb_set(coalesce(m.data,'{}'::jsonb),array['gradeRecords',p_student_id],rec,true); update public.methodologies set data=newdata,updated_at=now() where id=m.id;
  select exists(select 1 from public.point_transactions where student_id=p_student_id and period_id=p.id and transaction_type='donation_out') into has_donation;
  choice_value:=case when p_target_amount>0 and has_donation then 'mixed' when p_target_amount>0 then 'used' when has_donation then 'donated' else 'keep' end;
  insert into public.point_period_choices(period_id,student_id,choice,decided_at,updated_at) values(p.id,p_student_id,choice_value,now(),now()) on conflict(period_id,student_id) do update set choice=excluded.choice,updated_at=now();
  return jsonb_build_object('ok',true,'points_used',round(p_target_amount,2),'balance',public.points_balance(p_student_id),'final_decimal',round(new_final,2),'rounded',new_rounded,'monitor_global',p_student_id='00001');
end;
$function$

;
with fixed as (
 select m.id,jsonb_object_agg(e.key,case when coalesce((e.value->>'pointsUsed')::numeric,0)>0 then
 e.value||jsonb_build_object('obtainedAverage',(e.value->>'finalDecimal')::numeric,
 'monthlyGrade',greatest(5,public.points_school_round((e.value->>'finalDecimal')::numeric)),
 'rounded',greatest(5,public.points_school_round((e.value->>'finalDecimal')::numeric)))
 else e.value end) as records
 from public.methodologies m cross join lateral jsonb_each(m.data->'gradeRecords') e
 where not m.closed and jsonb_typeof(m.data->'gradeRecords')='object'
 group by m.id
)
update public.methodologies m set data=jsonb_set(m.data,'{gradeRecords}',f.records),updated_at=now()
from fixed f where m.id=f.id and m.data->'gradeRecords' is distinct from f.records;