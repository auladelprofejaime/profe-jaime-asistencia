-- Incidencias exclusivas del turno matutino; no modifica entregas ni sesiones.
create table if not exists public.morning_class_incidents (
  id uuid primary key default gen_random_uuid(),
  student_id text not null,
  shift text not null default 'Matutino' check (shift = 'Matutino'),
  group_name text not null,
  incident_code text not null check (incident_code in ('talks','laughs','late','skips','interrupts','instructions','not_working','distracts','disrespect','phone','leaves_seat','no_material')),
  incident_date date not null default (now() at time zone 'America/Mexico_City')::date,
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid()
);
create index if not exists morning_class_incidents_student_date_idx on public.morning_class_incidents(student_id,incident_date);
alter table public.morning_class_incidents enable row level security;
create policy morning_incidents_teacher_select on public.morning_class_incidents for select to authenticated using (public.is_teacher());
create policy morning_incidents_teacher_insert on public.morning_class_incidents for insert to authenticated with check (public.is_teacher() and created_by=(select auth.uid()));
create policy morning_incidents_teacher_delete on public.morning_class_incidents for delete to authenticated using (public.is_teacher() and created_by=(select auth.uid()));
grant select,insert,delete on public.morning_class_incidents to authenticated;