-- GDP Clothing: retain all public RPC call contracts while removing privileged
-- SECURITY DEFINER implementations from the exposed public API schema.
-- Privileged implementations are moved IN PLACE into existing unexposed private schema.
-- The new public RPCs are SECURITY INVOKER forwarding shims. Caller identity/JWT
-- continues through to the original code; no payments, orders or data are migrated.
-- Six draft/edit administrative functions additionally require strict JWT AAL2.
-- The customer policy-acceptance lookup intentionally requires login, NOT admin/MFA.
-- One transaction: if any assertion fails, no changes are committed.

begin;

do $rpc_preflight$
declare
  v_sig text;
  v_id oid;
begin
  foreach v_sig in array array[
    'public.activate_admin_draft_atomic(uuid)',
    'public.has_my_current_registration_policy_acceptances()',
    'public.issue_admin_invoice_from_draft(uuid)',
    'public.issue_admin_order_invoice(uuid)',
    'public.reserve_admin_invoice_number(uuid)',
    'public.save_admin_draft_atomic(uuid,jsonb,jsonb)',
    'public.save_admin_invoice_document_meta(uuid,jsonb)',
    'public.save_admin_invoice_draft_complete(uuid,jsonb,jsonb,jsonb)',
    'public.save_admin_invoice_layout_dates(uuid,jsonb,date)'
  ] loop
    v_id := to_regprocedure(v_sig);
    if v_id is null then
      raise exception 'RPC hardening preflight: missing %', v_sig;
    end if;
    if not (select prosecdef from pg_proc where oid=v_id)
       or not has_function_privilege('authenticated',v_id,'EXECUTE')
       or not has_function_privilege('service_role',v_id,'EXECUTE')
       or has_function_privilege('anon',v_id,'EXECUTE')
       or not exists (select 1 from pg_proc where oid=v_id and 'search_path=""' = any(proconfig)) then
      raise exception 'RPC hardening preflight: unexpected security state for %', v_sig;
    end if;
    if to_regprocedure(replace(v_sig, 'public.', 'private.')) is not null then
      raise exception 'RPC hardening preflight: private implementation already exists for %', v_sig;
    end if;
  end loop;
  if not has_schema_privilege('authenticated','private','USAGE')
     or not has_schema_privilege('service_role','private','USAGE') then
    raise exception 'RPC hardening preflight: existing private schema usage not available';
  end if;
end
$rpc_preflight$;

-- Move the actual functions without dropping or recreating their OIDs. This
-- preserves implementation, owner, SECDEF, current ACLs and dependency identity.
alter function public.activate_admin_draft_atomic(uuid) set schema private;
alter function public.has_my_current_registration_policy_acceptances() set schema private;
alter function public.issue_admin_invoice_from_draft(uuid) set schema private;
alter function public.issue_admin_order_invoice(uuid) set schema private;
alter function public.reserve_admin_invoice_number(uuid) set schema private;
alter function public.save_admin_draft_atomic(uuid,jsonb,jsonb) set schema private;
alter function public.save_admin_invoice_document_meta(uuid,jsonb) set schema private;
alter function public.save_admin_invoice_draft_complete(uuid,jsonb,jsonb,jsonb) set schema private;
alter function public.save_admin_invoice_layout_dates(uuid,jsonb,date) set schema private;

-- Tighten six administrative draft/edit mutations that previously accepted
-- admin at AAL1 during the original MFA enrollment grace period. Real AAL2 is
-- now always required, matching official invoice issuance.
do $rpc_stepup$
declare
  v_sig text;
  v_original text;
  v_patched text;
  v_before constant text := 'if auth.uid() is null or not public.is_admin() then';
  v_after constant text := 'if auth.uid() is null or not public.is_admin() or not public.is_admin_step_up_authorized() or coalesce(auth.jwt()->>''aal'',''aal1'') <> ''aal2'' then';
begin
  foreach v_sig in array array[
    'private.activate_admin_draft_atomic(uuid)',
    'private.reserve_admin_invoice_number(uuid)',
    'private.save_admin_draft_atomic(uuid,jsonb,jsonb)',
    'private.save_admin_invoice_document_meta(uuid,jsonb)',
    'private.save_admin_invoice_draft_complete(uuid,jsonb,jsonb,jsonb)',
    'private.save_admin_invoice_layout_dates(uuid,jsonb,date)'
  ] loop
    select pg_get_functiondef(to_regprocedure(v_sig)) into v_original;
    v_patched := replace(v_original, v_before, v_after);
    if v_original is null or v_patched = v_original then
      raise exception 'RPC hardening: cannot identify original admin guard in %', v_sig;
    end if;
    execute v_patched;
  end loop;
end
$rpc_stepup$;

-- Use the same public names, parameter names and return types, preserving the
-- supabase.rpc() contract and the existing admin invoice/draft call graph.
-- SECURITY INVOKER here only forwards: privileged table writes still occur
-- inside the tightly guarded private SECURITY DEFINER implementations.
create function public.activate_admin_draft_atomic(p_id uuid)
returns public.orders
language sql
volatile
security invoker
set search_path = ''
as $rpc_facade$
  select private.activate_admin_draft_atomic(p_id);
$rpc_facade$;
revoke all on function public.activate_admin_draft_atomic(uuid) from public, anon;
grant execute on function public.activate_admin_draft_atomic(uuid) to authenticated, service_role;
revoke all on function private.activate_admin_draft_atomic(uuid) from public, anon;
grant execute on function private.activate_admin_draft_atomic(uuid) to authenticated, service_role;

create function public.has_my_current_registration_policy_acceptances()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $rpc_facade$
  select private.has_my_current_registration_policy_acceptances();
$rpc_facade$;
revoke all on function public.has_my_current_registration_policy_acceptances() from public, anon;
grant execute on function public.has_my_current_registration_policy_acceptances() to authenticated, service_role;
revoke all on function private.has_my_current_registration_policy_acceptances() from public, anon;
grant execute on function private.has_my_current_registration_policy_acceptances() to authenticated, service_role;

create function public.issue_admin_invoice_from_draft(p_order_id uuid)
returns public.gdp_invoices
language sql
volatile
security invoker
set search_path = ''
as $rpc_facade$
  select private.issue_admin_invoice_from_draft(p_order_id);
$rpc_facade$;
revoke all on function public.issue_admin_invoice_from_draft(uuid) from public, anon;
grant execute on function public.issue_admin_invoice_from_draft(uuid) to authenticated, service_role;
revoke all on function private.issue_admin_invoice_from_draft(uuid) from public, anon;
grant execute on function private.issue_admin_invoice_from_draft(uuid) to authenticated, service_role;

create function public.issue_admin_order_invoice(p_order_id uuid)
returns public.gdp_invoices
language sql
volatile
security invoker
set search_path = ''
as $rpc_facade$
  select private.issue_admin_order_invoice(p_order_id);
$rpc_facade$;
revoke all on function public.issue_admin_order_invoice(uuid) from public, anon;
grant execute on function public.issue_admin_order_invoice(uuid) to authenticated, service_role;
revoke all on function private.issue_admin_order_invoice(uuid) from public, anon;
grant execute on function private.issue_admin_order_invoice(uuid) to authenticated, service_role;

create function public.reserve_admin_invoice_number(p_order_id uuid)
returns text
language sql
volatile
security invoker
set search_path = ''
as $rpc_facade$
  select private.reserve_admin_invoice_number(p_order_id);
$rpc_facade$;
revoke all on function public.reserve_admin_invoice_number(uuid) from public, anon;
grant execute on function public.reserve_admin_invoice_number(uuid) to authenticated, service_role;
revoke all on function private.reserve_admin_invoice_number(uuid) from public, anon;
grant execute on function private.reserve_admin_invoice_number(uuid) to authenticated, service_role;

create function public.save_admin_draft_atomic(p_id uuid, p_order jsonb, p_items jsonb)
returns uuid
language sql
volatile
security invoker
set search_path = ''
as $rpc_facade$
  select private.save_admin_draft_atomic(p_id,p_order,p_items);
$rpc_facade$;
revoke all on function public.save_admin_draft_atomic(uuid,jsonb,jsonb) from public, anon;
grant execute on function public.save_admin_draft_atomic(uuid,jsonb,jsonb) to authenticated, service_role;
revoke all on function private.save_admin_draft_atomic(uuid,jsonb,jsonb) from public, anon;
grant execute on function private.save_admin_draft_atomic(uuid,jsonb,jsonb) to authenticated, service_role;

create function public.save_admin_invoice_document_meta(p_order_id uuid, p_meta jsonb)
returns void
language sql
volatile
security invoker
set search_path = ''
as $rpc_facade$
  select private.save_admin_invoice_document_meta(p_order_id,p_meta);
$rpc_facade$;
revoke all on function public.save_admin_invoice_document_meta(uuid,jsonb) from public, anon;
grant execute on function public.save_admin_invoice_document_meta(uuid,jsonb) to authenticated, service_role;
revoke all on function private.save_admin_invoice_document_meta(uuid,jsonb) from public, anon;
grant execute on function private.save_admin_invoice_document_meta(uuid,jsonb) to authenticated, service_role;

create function public.save_admin_invoice_draft_complete(p_id uuid, p_order jsonb, p_items jsonb, p_meta jsonb)
returns uuid
language sql
volatile
security invoker
set search_path = ''
as $rpc_facade$
  select private.save_admin_invoice_draft_complete(p_id,p_order,p_items,p_meta);
$rpc_facade$;
revoke all on function public.save_admin_invoice_draft_complete(uuid,jsonb,jsonb,jsonb) from public, anon;
grant execute on function public.save_admin_invoice_draft_complete(uuid,jsonb,jsonb,jsonb) to authenticated, service_role;
revoke all on function private.save_admin_invoice_draft_complete(uuid,jsonb,jsonb,jsonb) from public, anon;
grant execute on function private.save_admin_invoice_draft_complete(uuid,jsonb,jsonb,jsonb) to authenticated, service_role;

create function public.save_admin_invoice_layout_dates(p_order_id uuid, p_meta jsonb, p_due_date date)
returns void
language sql
volatile
security invoker
set search_path = ''
as $rpc_facade$
  select private.save_admin_invoice_layout_dates(p_order_id,p_meta,p_due_date);
$rpc_facade$;
revoke all on function public.save_admin_invoice_layout_dates(uuid,jsonb,date) from public, anon;
grant execute on function public.save_admin_invoice_layout_dates(uuid,jsonb,date) to authenticated, service_role;
revoke all on function private.save_admin_invoice_layout_dates(uuid,jsonb,date) from public, anon;
grant execute on function private.save_admin_invoice_layout_dates(uuid,jsonb,date) to authenticated, service_role;


-- Fail closed if any wrapper or original implementation has unexpected access
-- or an elevated public SECURITY DEFINER surface.
do $rpc_verify$
declare
  v_sig text;
  v_public oid;
  v_private oid;
begin
  foreach v_sig in array array[
    'public.activate_admin_draft_atomic(uuid)',
    'public.has_my_current_registration_policy_acceptances()',
    'public.issue_admin_invoice_from_draft(uuid)',
    'public.issue_admin_order_invoice(uuid)',
    'public.reserve_admin_invoice_number(uuid)',
    'public.save_admin_draft_atomic(uuid,jsonb,jsonb)',
    'public.save_admin_invoice_document_meta(uuid,jsonb)',
    'public.save_admin_invoice_draft_complete(uuid,jsonb,jsonb,jsonb)',
    'public.save_admin_invoice_layout_dates(uuid,jsonb,date)'
  ] loop
    v_public := to_regprocedure(v_sig);
    v_private := to_regprocedure(replace(v_sig,'public.','private.'));
    if v_public is null or v_private is null then
      raise exception 'RPC hardening verification: missing pair for %', v_sig;
    end if;
    if (select prosecdef from pg_proc where oid=v_public)
       or not (select prosecdef from pg_proc where oid=v_private)
       or has_function_privilege('anon',v_public,'EXECUTE')
       or has_function_privilege('anon',v_private,'EXECUTE')
       or not has_function_privilege('authenticated',v_public,'EXECUTE')
       or not has_function_privilege('authenticated',v_private,'EXECUTE')
       or not has_function_privilege('service_role',v_public,'EXECUTE')
       or not has_function_privilege('service_role',v_private,'EXECUTE')
       or not exists (select 1 from pg_proc where oid=v_private and 'search_path=""'=any(proconfig)) then
      raise exception 'RPC hardening verification: permission/definer mismatch in %', v_sig;
    end if;
  end loop;
end
$rpc_verify$;

notify pgrst, 'reload schema';
commit;
