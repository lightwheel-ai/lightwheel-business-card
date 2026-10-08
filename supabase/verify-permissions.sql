-- Run in SQL Editor as project owner. Everything, including test users, is rolled back.
begin;
create temporary table card_checks(test text, passed boolean);
grant select, insert on card_checks to authenticated;
select set_config('card_test.user_id',gen_random_uuid()::text,true);
select set_config('card_test.owner_id',(select id::text from auth.users where lower(email)='18906819866@163.com' and email_confirmed_at is not null),true);
insert into auth.users(id,email,email_confirmed_at)
values(current_setting('card_test.user_id')::uuid,'card-permission-test@example.invalid',now());
insert into card_checks values ('anonymous cannot read records',not has_table_privilege('anon','public.card_records','select'));
select set_config('request.jwt.claim.sub',current_setting('card_test.user_id'),true);
set local role authenticated;
insert into card_checks select 'new user is not manager',not (public.card_access()->>'manager')::boolean;
select public.card_request_access('Temporary permission test');
insert into card_checks select 'pending user sees no records',not exists(select 1 from public.card_records);
insert into card_checks select 'pending cannot see source images',not exists(select 1 from storage.objects where bucket_id='card-sources');
do $$ begin
  perform public.card_delete(gen_random_uuid(),1);
  raise exception 'FAILED: pending delete allowed';
exception when insufficient_privilege then insert into card_checks values('pending cannot delete',true); end $$;
do $$ begin
  perform public.card_save('{"name":"Temporary test"}'::jsonb);
  raise exception 'FAILED: pending write allowed';
exception when insufficient_privilege then insert into card_checks values('pending cannot save',true); end $$;
do $$ begin
  perform public.card_review_access(current_setting('card_test.user_id')::uuid,'approved');
  raise exception 'FAILED: self approval allowed';
exception when insufficient_privilege then insert into card_checks values('cannot approve self',true); end $$;
select set_config('request.jwt.claim.sub',current_setting('card_test.owner_id'),true);
select public.card_review_access(current_setting('card_test.user_id')::uuid,'approved');
select set_config('request.jwt.claim.sub',current_setting('card_test.user_id'),true);
insert into card_checks select 'approved user is manager',(public.card_access()->>'manager')::boolean;
select set_config('card_test.record_id',(public.card_save('{"name":"Temporary permission test","needs_review":true}'::jsonb,'import')).id::text,true);
select public.card_save('{"name":"Edited temporary test"}'::jsonb,'edit',current_setting('card_test.record_id')::uuid,1);
insert into card_checks select 'save and edit append history',count(*)=2 from public.card_events where record_id=current_setting('card_test.record_id')::uuid;
do $$ begin
  perform public.card_save('{"name":"stale"}'::jsonb,'edit',current_setting('card_test.record_id')::uuid,1);
  raise exception 'FAILED: stale update allowed';
exception when serialization_failure then insert into card_checks values('stale edits rejected',true); end $$;
insert into storage.objects(bucket_id,name) values('card-sources',current_setting('card_test.record_id')||'/source.png');
insert into card_checks select 'manager can access source image',exists(select 1 from storage.objects where bucket_id='card-sources' and name=current_setting('card_test.record_id')||'/source.png');
select public.card_delete(current_setting('card_test.record_id')::uuid,2);
insert into card_checks select 'deleted record hidden',not exists(select 1 from public.card_records where id=current_setting('card_test.record_id')::uuid);
insert into card_checks select 'deleted history hidden',not exists(select 1 from public.card_events where record_id=current_setting('card_test.record_id')::uuid);
insert into card_checks select 'deleted source hidden',not exists(select 1 from storage.objects where bucket_id='card-sources' and name=current_setting('card_test.record_id')||'/source.png');
do $$ begin
  perform public.card_save('{"name":"deleted"}'::jsonb,'edit',current_setting('card_test.record_id')::uuid,3);
  raise exception 'FAILED: deleted update allowed';
exception when serialization_failure then insert into card_checks values('deleted cannot be edited',true); end $$;
select public.card_restore(current_setting('card_test.record_id')::uuid);
insert into card_checks select 'restore preserves history',count(*)=2 from public.card_events where record_id=current_setting('card_test.record_id')::uuid;
insert into card_checks select 'restored source visible',exists(select 1 from storage.objects where bucket_id='card-sources' and name=current_setting('card_test.record_id')||'/source.png');
select set_config('request.jwt.claim.sub',current_setting('card_test.owner_id'),true);
select public.card_review_access(current_setting('card_test.user_id')::uuid,'revoked');
select set_config('request.jwt.claim.sub',current_setting('card_test.user_id'),true);
insert into card_checks select 'revoked user cannot read',not exists(select 1 from public.card_records);
insert into card_checks select 'revoked cannot view images',not exists(select 1 from storage.objects where bucket_id='card-sources');
do $$ begin
  perform public.card_restore(current_setting('card_test.record_id')::uuid);
  raise exception 'FAILED: revoked restore allowed';
exception when insufficient_privilege then insert into card_checks values('revoked cannot restore',true); end $$;
do $$ begin
  perform public.card_save('{"name":"revoked"}'::jsonb);
  raise exception 'FAILED: revoked write allowed';
exception when insufficient_privilege then insert into card_checks values('revoked cannot save',true); end $$;
select count(*) as checks, bool_and(passed) as all_passed,
  string_agg(test, ', ') filter (where not passed) as failed_checks from card_checks;
rollback;
