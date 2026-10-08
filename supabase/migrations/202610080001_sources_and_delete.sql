begin;
alter table public.card_records add column if not exists deleted_at timestamptz;
alter policy records_read on public.card_records using ((select card_private.is_manager()) and deleted_at is null);
alter policy events_read on public.card_events using ((select card_private.is_manager()) and exists (select 1 from public.card_records r where r.id=record_id and r.deleted_at is null));

create or replace function card_private.protect_deleted_card() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.deleted_at is not null and new.deleted_at is not null then
    raise exception 'Record deleted. Reload before saving.' using errcode='40001';
  end if;
  return new;
end;
$$;
create trigger protect_deleted_card before update on public.card_records
  for each row execute function card_private.protect_deleted_card();

create function public.card_delete(record_id uuid, expected_version integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not card_private.is_manager() then raise exception 'Manager only' using errcode='42501'; end if;
  update public.card_records r set deleted_at=now(),version=version+1,updated_by=auth.uid()
    where r.id=record_id and r.version=expected_version and r.deleted_at is null;
  if not found then raise exception 'Record changed. Reload.' using errcode='40001'; end if;
end;
$$;
create function public.card_restore(record_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not card_private.is_manager() then raise exception 'Manager only' using errcode='42501'; end if;
  update public.card_records r set deleted_at=null,version=version+1,updated_by=auth.uid(),updated_at=now()
    where r.id=record_id and r.deleted_at is not null;
  if not found then raise exception 'Deleted record not found'; end if;
end;
$$;
revoke all on function public.card_delete(uuid,integer),public.card_restore(uuid) from public,anon;
grant execute on function public.card_delete(uuid,integer),public.card_restore(uuid) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('card-sources','card-sources',false,20971520,array['image/png'])
on conflict(id) do nothing;
create policy card_sources_read on storage.objects for select to authenticated
using (bucket_id='card-sources' and (select card_private.is_manager()) and exists (
  select 1 from public.card_records r where storage.objects.name=r.id::text||'/source.png' and r.deleted_at is null
));
create policy card_sources_insert on storage.objects for insert to authenticated
with check (bucket_id='card-sources' and (select card_private.is_manager()) and exists (
  select 1 from public.card_records r where storage.objects.name=r.id::text||'/source.png' and r.deleted_at is null
));
commit;
