-- Preserve the deployed function and its authorization/concurrency checks.
do $migration$
declare definition text;
begin
  definition := pg_get_functiondef('public.card_save(jsonb,text,uuid,integer)'::regprocedure);
  if position('if event_action in (''edit'',''pdf'',''png'') then' in definition) > 0 then
    return;
  end if;
  if position('if event_action in (''pdf'',''png'') then' in definition) = 0 then
    raise exception 'Save rule changed; inspect before modifying';
  end if;
  execute replace(definition, 'if event_action in (''pdf'',''png'') then', 'if event_action in (''edit'',''pdf'',''png'') then');
end;
$migration$;
