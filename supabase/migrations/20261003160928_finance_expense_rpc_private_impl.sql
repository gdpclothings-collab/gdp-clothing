begin;

alter function public.create_admin_finance_expense(date,text,text,text,numeric,numeric,numeric,numeric,boolean,text,text,text)
  rename to finance_create_expense_impl;
alter function public.finance_create_expense_impl(date,text,text,text,numeric,numeric,numeric,numeric,boolean,text,text,text)
  set schema private;

alter function public.correct_admin_finance_expense(uuid,date,text,text,text,numeric,numeric,numeric,numeric,boolean,text,text,text,text)
  rename to finance_correct_expense_impl;
alter function public.finance_correct_expense_impl(uuid,date,text,text,text,numeric,numeric,numeric,numeric,boolean,text,text,text,text)
  set schema private;

alter function public.void_admin_finance_expense(uuid,text)
  rename to finance_void_expense_impl;
alter function public.finance_void_expense_impl(uuid,text)
  set schema private;

alter function public.get_admin_expense_controls(date,date,integer)
  rename to finance_get_expense_controls_impl;
alter function public.finance_get_expense_controls_impl(date,date,integer)
  set schema private;

alter function public.update_admin_expense_tax(uuid,numeric,numeric,boolean)
  rename to finance_update_expense_tax_impl;
alter function public.finance_update_expense_tax_impl(uuid,numeric,numeric,boolean)
  set schema private;

revoke all on function private.finance_create_expense_impl(date,text,text,text,numeric,numeric,numeric,numeric,boolean,text,text,text) from public, anon;
revoke all on function private.finance_correct_expense_impl(uuid,date,text,text,text,numeric,numeric,numeric,numeric,boolean,text,text,text,text) from public, anon;
revoke all on function private.finance_void_expense_impl(uuid,text) from public, anon;
revoke all on function private.finance_get_expense_controls_impl(date,date,integer) from public, anon;
revoke all on function private.finance_update_expense_tax_impl(uuid,numeric,numeric,boolean) from public, anon;

grant usage on schema private to authenticated, service_role;
grant execute on function private.finance_create_expense_impl(date,text,text,text,numeric,numeric,numeric,numeric,boolean,text,text,text) to authenticated, service_role;
grant execute on function private.finance_correct_expense_impl(uuid,date,text,text,text,numeric,numeric,numeric,numeric,boolean,text,text,text,text) to authenticated, service_role;
grant execute on function private.finance_void_expense_impl(uuid,text) to authenticated, service_role;
grant execute on function private.finance_get_expense_controls_impl(date,date,integer) to authenticated, service_role;
grant execute on function private.finance_update_expense_tax_impl(uuid,numeric,numeric,boolean) to authenticated, service_role;

create function public.create_admin_finance_expense(
  p_occurred_on date,p_vendor text,p_category text,p_description text,p_amount numeric,
  p_tax numeric default 0,p_gst_hst_tax numeric default null,p_pst_tax numeric default null,
  p_itc_eligible boolean default false,p_payment_method text default null,
  p_receipt_reference text default null,p_notes text default null
)
returns jsonb
language sql
security invoker
set search_path = pg_catalog, public, private
as $$
  select private.finance_create_expense_impl(
    p_occurred_on,p_vendor,p_category,p_description,p_amount,p_tax,
    p_gst_hst_tax,p_pst_tax,p_itc_eligible,p_payment_method,p_receipt_reference,p_notes
  );
$$;

create function public.correct_admin_finance_expense(
  p_expense_id uuid,p_occurred_on date,p_vendor text,p_category text,p_description text,
  p_amount numeric,p_tax numeric default 0,p_gst_hst_tax numeric default null,
  p_pst_tax numeric default null,p_itc_eligible boolean default false,
  p_payment_method text default null,p_receipt_reference text default null,
  p_notes text default null,p_reason text default null
)
returns jsonb
language sql
security invoker
set search_path = pg_catalog, public, private
as $$
  select private.finance_correct_expense_impl(
    p_expense_id,p_occurred_on,p_vendor,p_category,p_description,p_amount,p_tax,
    p_gst_hst_tax,p_pst_tax,p_itc_eligible,p_payment_method,p_receipt_reference,p_notes,p_reason
  );
$$;

create function public.void_admin_finance_expense(p_expense_id uuid,p_reason text)
returns jsonb
language sql
security invoker
set search_path = pg_catalog, public, private
as $$ select private.finance_void_expense_impl(p_expense_id,p_reason); $$;

create function public.get_admin_expense_controls(p_from date default null,p_to date default null,p_limit integer default 500)
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog, public, private
as $$ select private.finance_get_expense_controls_impl(p_from,p_to,p_limit); $$;

create function public.update_admin_expense_tax(p_expense_id uuid,p_gst_hst_tax numeric,p_pst_tax numeric,p_itc_eligible boolean default false)
returns public.finance_expenses
language sql
security invoker
set search_path = pg_catalog, public, private
as $$ select private.finance_update_expense_tax_impl(p_expense_id,p_gst_hst_tax,p_pst_tax,p_itc_eligible); $$;

revoke all on function public.create_admin_finance_expense(date,text,text,text,numeric,numeric,numeric,numeric,boolean,text,text,text) from public,anon;
revoke all on function public.correct_admin_finance_expense(uuid,date,text,text,text,numeric,numeric,numeric,numeric,boolean,text,text,text,text) from public,anon;
revoke all on function public.void_admin_finance_expense(uuid,text) from public,anon;
revoke all on function public.get_admin_expense_controls(date,date,integer) from public,anon;
revoke all on function public.update_admin_expense_tax(uuid,numeric,numeric,boolean) from public,anon;

grant execute on function public.create_admin_finance_expense(date,text,text,text,numeric,numeric,numeric,numeric,boolean,text,text,text) to authenticated,service_role;
grant execute on function public.correct_admin_finance_expense(uuid,date,text,text,text,numeric,numeric,numeric,numeric,boolean,text,text,text,text) to authenticated,service_role;
grant execute on function public.void_admin_finance_expense(uuid,text) to authenticated,service_role;
grant execute on function public.get_admin_expense_controls(date,date,integer) to authenticated,service_role;
grant execute on function public.update_admin_expense_tax(uuid,numeric,numeric,boolean) to authenticated,service_role;

commit;
