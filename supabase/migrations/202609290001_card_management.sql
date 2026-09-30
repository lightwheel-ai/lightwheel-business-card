-- Apply as the project owner. No personal card data is seeded here.
-- PUBLIC/anon cannot read records; all mutations are checked RPCs.
begin;
create schema if not exists card_private;
revoke all on schema card_private from public, anon, authenticated;
grant usage on schema card_private to authenticated;

create table public.card_admin_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  reason text not null check (char_length(reason) between 1 and 1000),
  status text not null default 'pending' check (status in ('pending','approved','rejected','revoked')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id)
);
create table public.card_records (
  id uuid primary key default gen_random_uuid(),
  name text not null default '' check (char_length(name) <= 160),
  title text not null default '' check (char_length(title) <= 240),
  phone text not null default '' check (char_length(phone) <= 100),
  email text not null default '' check (char_length(email) <= 254),
  template text not null default 'chinese' check (template in ('chinese','english')),
  source text not null default 'manual' check (char_length(source) <= 500),
  needs_review boolean not null default true,
  version integer not null default 1,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.card_events (
  id bigint generated always as identity primary key,
  record_id uuid not null references public.card_records(id),
  actor_id uuid not null references auth.users(id),
  action text not null check (action in ('import','edit','pdf','png','create')),
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);
create index card_records_updated_idx on public.card_records(updated_at desc);
create index card_events_record_idx on public.card_events(record_id,created_at desc);
alter table public.card_admin_requests enable row level security;
alter table public.card_records enable row level security;
alter table public.card_events enable row level security;
revoke all on public.card_admin_requests, public.card_records, public.card_events from public,anon,authenticated;
grant select on public.card_admin_requests, public.card_records, public.card_events to authenticated;

-- Read the verified identity from Auth, never user-editable metadata or a client email.
create function card_private.verified_email() returns text
language sql stable security definer set search_path = '' as $$
  select lower(u.email) from auth.users u
  where u.id=auth.uid() and u.email_confirmed_at is not null
    and (u.banned_until is null or u.banned_until < now());
$$;
create function card_private.is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(card_private.verified_email()='18906819866@163.com',false);
$$;
create function card_private.is_manager() returns boolean
language sql stable security definer set search_path = '' as $$
  select card_private.is_owner() or exists (
    select 1 from public.card_admin_requests r
    where r.user_id=auth.uid() and r.status='approved'
      and r.email=card_private.verified_email()
  );
$$;
revoke all on function card_private.verified_email(),card_private.is_owner(),card_private.is_manager() from public,anon;
grant execute on function card_private.is_owner(),card_private.is_manager() to authenticated;

create policy requests_read on public.card_admin_requests for select to authenticated
  using (user_id=(select auth.uid()) or (select card_private.is_owner()));
create policy records_read on public.card_records for select to authenticated
  using ((select card_private.is_manager()));
create policy events_read on public.card_events for select to authenticated
  using ((select card_private.is_manager()));

create function public.card_access() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('owner',card_private.is_owner(),'manager',card_private.is_manager());
$$;
create function public.card_request_access(request_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare verified text:=card_private.verified_email();
begin
  if verified is null then raise exception 'Verified email required' using errcode='42501'; end if;
  if char_length(trim(request_reason)) not between 1 and 1000 then raise exception 'Invalid reason'; end if;
  insert into public.card_admin_requests(user_id,email,reason)
    values(auth.uid(),verified,trim(request_reason))
    on conflict(user_id) do update set email=excluded.email,reason=excluded.reason,
      status='pending',requested_at=now(),reviewed_at=null,reviewed_by=null
    where card_admin_requests.status='rejected';
  -- Revoked users cannot re-enable themselves; the owner must explicitly approve again.
end;
$$;
create function public.card_review_access(target_user uuid,decision text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not card_private.is_owner() then raise exception 'Owner only' using errcode='42501'; end if;
  if decision not in ('approved','rejected','revoked') then raise exception 'Invalid decision'; end if;
  update public.card_admin_requests set status=decision,reviewed_at=now(),reviewed_by=auth.uid()
    where user_id=target_user;
  if not found then raise exception 'Request not found'; end if;
end;
$$;

create function public.card_save(
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
  insert into public.card_events(record_id,actor_id,action,snapshot)
    values(saved.id,auth.uid(),event_action,to_jsonb(saved));
  return saved;
end;
$$;
revoke all on function public.card_access(),public.card_request_access(text),public.card_review_access(uuid,text),public.card_save(jsonb,text,uuid,integer) from public,anon;
grant execute on function public.card_access(),public.card_request_access(text),public.card_review_access(uuid,text),public.card_save(jsonb,text,uuid,integer) to authenticated;
commit;
