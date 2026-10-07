CREATE OR REPLACE FUNCTION public.points_set_grade_use_internal(p_student_id text, p_period_id uuid, p_target_amount numeric, p_source text, p_created_by uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare p public.point_periods%rowtype; st public.students%rowtype; m public.methodologies%rowtype; rec jsonb; old_used numeric:=0; available_before numeric:=0; delta numeric:=0; base_grade numeric; manual_extra numeric:=0; max_use numeric:=0; new_final numeric; new_rounded integer; newdata jsonb; choice_value text; has_donation boolean;
begin
  select * into p from public.point_periods where id=p_period_id; if p.id is null then raise exception 'Periodo no encontrado'; end if;
  if p_source='teacher' then
    if auth.uid() is null or not public.is_teacher() or p_created_by is distinct from auth.uid() then raise exception 'No autorizado';end if;
    if p.closed_at is not null then raise exception 'El periodo está cerrado definitivamente';end if;
  elsif p.closed_at is not null or now()<p.opens_at or now()>=p.closes_at then raise exception 'El periodo de puntos no está abierto';end if;
  select * into st from public.students where id=p_student_id and active=true; if st.id is null then raise exception 'Alumno no encontrado'; end if;
  if p_student_id<>'00001' and (lower(trim(coalesce(st.shift,'')))<>lower(trim(coalesce(p.shift,''))) or public.points_norm_group(st.group_name)<>public.points_norm_group(p.group_name)) then raise exception 'El alumno no pertenece al grupo de este periodo'; end if;
  if p_target_amount is null or p_target_amount<0 then raise exception 'Cantidad inválida'; end if;
  select * into m from public.methodologies where id=p.methodology_id for update; if m.id is null then raise exception 'Metodología no encontrada'; end if;
  if m.closed then raise exception 'El mes está cerrado. Reábrelo antes de modificar puntos';end if;
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
$function$;

CREATE OR REPLACE FUNCTION public.teacher_donate_points(p_donor_id text, p_period_id uuid, p_recipient_id text, p_amount numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  donor public.students%rowtype;
  recipient public.students%rowtype;
  p public.point_periods%rowtype;
  bal numeric;
  has_use boolean;
begin
  if auth.uid() is null or not public.is_teacher() then
    raise exception 'No autorizado';
  end if;

  if p_amount is null or p_amount <= 0 then raise exception 'Cantidad inválida'; end if;
  if p_donor_id = p_recipient_id then raise exception 'Un alumno no puede donarse a sí mismo'; end if;

  select * into p from public.point_periods where id=p_period_id;
  if p.id is null then raise exception 'Periodo no encontrado'; end if;
  -- Only this authenticated teacher endpoint ignores the student schedule.
  if p.closed_at is not null then raise exception 'El periodo está cerrado definitivamente';end if;
  if exists(select 1 from public.methodologies m where m.id=p.methodology_id and m.closed) then raise exception 'El mes está cerrado. Reábrelo antes de modificar puntos';end if;

  select * into donor from public.students where id=p_donor_id and active=true;
  select * into recipient from public.students where id=p_recipient_id and active=true;

  if donor.id is null or recipient.id is null then raise exception 'Alumno no encontrado'; end if;

  if lower(trim(coalesce(donor.shift,'')))<>lower(trim(coalesce(recipient.shift,'')))
     or public.points_norm_group(donor.group_name)<>public.points_norm_group(recipient.group_name)
     or public.points_norm_group(donor.group_name)<>public.points_norm_group(p.group_name) then
    raise exception 'La donación solo puede ser dentro del mismo grupo';
  end if;

  bal := public.points_balance(p_donor_id);
  if p_amount > bal + 0.0001 then raise exception 'Saldo insuficiente'; end if;

  insert into public.point_transactions(
    student_id,amount,transaction_type,reason,period_id,
    counterpart_student_id,source,created_by
  ) values(
    donor.id,-round(p_amount,2),'donation_out','Donación registrada por docente',
    p.id,recipient.id,'teacher',auth.uid()
  );

  insert into public.point_transactions(
    student_id,amount,transaction_type,reason,period_id,
    counterpart_student_id,source,created_by
  ) values(
    recipient.id,round(p_amount,2),'donation_in','Donación recibida',
    p.id,donor.id,'teacher',auth.uid()
  );

  select exists(
    select 1 from public.point_transactions
    where student_id=donor.id and period_id=p.id
      and transaction_type='grade_use'
  ) into has_use;

  insert into public.point_period_choices(period_id,student_id,choice,decided_at,updated_at)
  values(p.id,donor.id,case when has_use then 'mixed' else 'donated' end,now(),now())
  on conflict(period_id,student_id) do update set
    choice=excluded.choice, updated_at=now();

  return jsonb_build_object(
    'ok',true,
    'donor_balance',public.points_balance(donor.id),
    'recipient_id',recipient.id,
    'recipient_name',recipient.name
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.teacher_point_period_activity(p_period_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare detail jsonb; m public.methodologies%rowtype;
begin
 if auth.uid() is null or not public.is_teacher() then raise exception 'No autorizado';end if;
 detail:=public.teacher_point_period_detail(p_period_id);
 select mm.* into m from public.methodologies mm join public.point_periods pp on pp.methodology_id=mm.id where pp.id=p_period_id;
 return detail||jsonb_build_object(
 'teacher_can_operate',m.id is not null and not m.closed and not exists(select 1 from public.point_periods p where p.id=p_period_id and p.closed_at is not null),
 'grade_records',coalesce(m.data->'gradeRecords','{}'::jsonb),
 'transactions',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'student_id',t.student_id,'student_name',s.name,'amount',t.amount,'type',t.transaction_type,'reason',t.reason,'counterpart_id',t.counterpart_student_id,'counterpart_name',c.name,'source',t.source,'created_at',t.created_at) order by t.created_at desc,t.id)
 from (select * from public.point_transactions where period_id=p_period_id order by created_at desc,id limit 500)t
 left join public.students s on s.id=t.student_id left join public.students c on c.id=t.counterpart_student_id),'[]'::jsonb),
 'summary',(select jsonb_build_object('donations',count(*) filter(where transaction_type='donation_out'),'points_donated',coalesce(-sum(amount) filter(where transaction_type='donation_out'),0),'uses',count(*) filter(where transaction_type='grade_use'),'points_used',coalesce(-sum(amount) filter(where transaction_type in ('grade_use','grade_refund')),0),'movements',count(*)) from public.point_transactions where period_id=p_period_id));
end $function$;
revoke all on function public.points_set_grade_use_internal(text,uuid,numeric,text,uuid) from public,anon,authenticated;
