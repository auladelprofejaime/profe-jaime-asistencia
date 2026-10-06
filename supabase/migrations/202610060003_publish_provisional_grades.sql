create or replace function public.teacher_publish_provisional_methodology(p_methodology_id text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare m public.methodologies%rowtype;
begin
 if auth.uid() is null or not public.is_teacher() then raise exception 'Acceso exclusivo para docentes'; end if;
 select * into m from public.methodologies where id=p_methodology_id for update;
 if not found then raise exception 'Metodología no encontrada'; end if;
 if m.closed then raise exception 'El mes ya está cerrado'; end if;
 if jsonb_typeof(m.data->'gradeRecords') is distinct from 'object' or m.data->'gradeRecords'='{}'::jsonb then raise exception 'Primero calcula y guarda los promedios'; end if;
 update public.methodologies set data=data||jsonb_build_object('provisionalPublished',true,'provisionalPublishedAt',now(),'updated',now()),updated_at=now() where id=m.id;
 return jsonb_build_object('ok',true,'id',m.id);
end $$;
revoke all on function public.teacher_publish_provisional_methodology(text) from public,anon;
grant execute on function public.teacher_publish_provisional_methodology(text) to authenticated;