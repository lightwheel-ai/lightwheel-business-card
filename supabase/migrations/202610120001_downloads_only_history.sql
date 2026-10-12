begin;

create or replace function public.card_save(
  fields jsonb, event_action text default 'edit', record_id uuid default null,
  expected_version integer default null
) returns public.card_records
language plpgsql security definer set search_path = '' as $$
declare saved public.card_records;
begin
  if not card_private.is_manager() then raise exception 'Manager approval required' using errcode='42501'; end if;
  if event_action not in ('import','edit','pdf','png','create') then raise exception 'Invalid action'; end if;
  if jsonb_typeof(fields) <> 'object' or fields is null then raise exception 'Invalid fields'; end if;
  if record_id is null then
    insert into public.card_records(name,title,phone,email,template,source,needs_review,created_by,updated_by)
      values(coalesce(fields->>'name',''),coalesce(fields->>'title',''),coalesce(fields->>'phone',''),
        coalesce(fields->>'email',''),coalesce(fields->>'template','chinese'),
        coalesce(fields->>'source','manual'),coalesce((fields->>'needs_review')::boolean,true),auth.uid(),auth.uid())
      returning * into saved;
  else
    update public.card_records r set name=coalesce(fields->>'name',''),title=coalesce(fields->>'title',''),
      phone=coalesce(fields->>'phone',''),email=coalesce(fields->>'email',''),
      template=coalesce(fields->>'template',r.template),
      needs_review=coalesce((fields->>'needs_review')::boolean,r.needs_review),
      version=r.version+1,updated_at=now(),updated_by=auth.uid()
      where r.id=record_id and r.version=expected_version returning * into saved;
    if not found then raise exception 'Record changed. Reload before saving.' using errcode='40001'; end if;
  end if;
  if event_action in ('pdf','png') then
    insert into public.card_events(record_id,actor_id,action,snapshot)
      values(saved.id,auth.uid(),event_action,to_jsonb(saved));
  end if;
  return saved;
end;
$$;

commit;
