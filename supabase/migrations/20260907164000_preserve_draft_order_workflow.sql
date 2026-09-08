-- Draft orders are intentionally outside the paid production workflow.

do $migration$
declare
  definition text;
  previous_condition constant text :=
    'if new.status not in (''cancelled'', ''refunded'', ''partially_refunded'', ''completed'') then';
  corrected_condition constant text :=
    'if new.status not in (''draft'', ''cancelled'', ''refunded'', ''partially_refunded'', ''completed'') then';
begin
  select pg_get_functiondef('public.validate_order_workflow()'::regprocedure)
  into definition;

  if position(previous_condition in definition) = 0 then
    raise exception 'Expected validate_order_workflow condition was not found';
  end if;

  execute replace(definition, previous_condition, corrected_condition);
end
$migration$;
