create table public.donation_grade_repair_snapshots (
 id uuid primary key default gen_random_uuid(),
 methodology_id text not null,
 previous_data jsonb not null,
 captured_at timestamptz not null default now()
);
alter table public.donation_grade_repair_snapshots enable row level security;
revoke all on public.donation_grade_repair_snapshots from public,anon,authenticated;
insert into public.donation_grade_repair_snapshots(methodology_id,previous_data)
select distinct m.id,m.data from public.methodologies m join public.point_periods p on p.methodology_id=m.id
join public.point_transactions t on t.period_id=p.id and t.transaction_type='donation_in'
where not m.closed and p.closed_at is null;
do $$
declare x record;
begin
 perform set_config('request.jwt.claim.sub','e35c76f1-b60f-440b-8c88-6acd7efc0128',true);
 for x in select distinct t.student_id,t.period_id from public.point_transactions t
 join public.point_periods p on p.id=t.period_id join public.methodologies m on m.id=p.methodology_id
 where t.transaction_type='donation_in' and not m.closed and p.closed_at is null order by t.student_id loop
 perform public.points_apply_pending_donations(x.student_id,x.period_id);
 end loop;
end $$;