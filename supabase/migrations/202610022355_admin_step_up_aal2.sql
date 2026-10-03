begin;

-- GDP Clothing privileged admin step-up hardening.
-- Keep the existing role-based helper intact for routing/UI decisions, but require
-- an AAL2 session for privileged database access after the one-time MFA setup grace.

create or replace function private.admin_step_up_authorized()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    left join public.admin_mfa_enrollment_state s
      on s.user_id = p.id
    where p.id = auth.uid()
      and p.role = 'admin'
      and (
        coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
        or (
          s.enrolled_at is null
          and s.grace_expires_at is not null
          and s.grace_expires_at > now()
        )
      )
  );
$$;

revoke all on function private.admin_step_up_authorized() from public;
grant execute on function private.admin_step_up_authorized() to anon, authenticated;

create or replace function public.is_admin_step_up_authorized()
returns boolean
language sql
stable
set search_path = 'public', 'private'
as $$
  select private.admin_step_up_authorized();
$$;

revoke all on function public.is_admin_step_up_authorized() from public;
grant execute on function public.is_admin_step_up_authorized() to anon, authenticated;

comment on function public.is_admin_step_up_authorized() is
  'True only for GDP Clothing admins with AAL2 MFA, except during the server-backed first-time MFA enrollment grace period.';

-- Add restrictive step-up gates without replacing the existing permissive
-- ownership/admin policies. Non-admin customers keep their existing access;
-- admin access receives an additional MFA condition.
do $$
declare
  r record;
  v_policy text;
  v_gate constant text := '(not public.is_admin() or public.is_admin_step_up_authorized())';
begin
  for r in
    select distinct tablename, cmd
    from pg_policies
    where schemaname = 'public'
      and cmd <> 'SELECT'
      and (
        coalesce(qual, '') ilike '%is_admin%'
        or coalesce(with_check, '') ilike '%is_admin%'
      )
    order by tablename, cmd
  loop
    v_policy := 'admin_step_up_gate_' || lower(r.cmd);
    execute format('drop policy if exists %I on public.%I', v_policy, r.tablename);

    if r.cmd = 'INSERT' then
      execute format(
        'create policy %I on public.%I as restrictive for insert to public with check (%s)',
        v_policy, r.tablename, v_gate
      );
    elsif r.cmd = 'UPDATE' then
      execute format(
        'create policy %I on public.%I as restrictive for update to public using (%s) with check (%s)',
        v_policy, r.tablename, v_gate, v_gate
      );
    elsif r.cmd = 'DELETE' then
      execute format(
        'create policy %I on public.%I as restrictive for delete to public using (%s)',
        v_policy, r.tablename, v_gate
      );
    elsif r.cmd = 'ALL' then
      execute format(
        'create policy %I on public.%I as restrictive for all to public using (%s) with check (%s)',
        v_policy, r.tablename, v_gate, v_gate
      );
    end if;
  end loop;
end
$$;

-- Sensitive admin reads also require step-up. Customer ownership branches are
-- unchanged because non-admin callers automatically pass the restrictive gate.
do $$
declare
  r record;
  v_gate constant text := '(not public.is_admin() or public.is_admin_step_up_authorized())';
  v_sensitive_tables constant text[] := array[
    'ai_credit_accounts',
    'ai_credit_ledger',
    'app_integrations',
    'artwork_library',
    'checkout_sessions',
    'coupon_redemptions',
    'custom_designs',
    'customer_segment_members',
    'customer_segments',
    'customer_tag_assignments',
    'customer_tags',
    'delivery_settings',
    'design_proofs',
    'dtf_export_audit_log',
    'inventory_adjustments',
    'inventory_levels',
    'inventory_transfer_items',
    'inventory_transfers',
    'landing_page_draft',
    'landing_page_versions',
    'marketing_consents',
    'notification_templates',
    'order_activity_events',
    'order_coupon_reservations',
    'order_inventory_allocations',
    'order_inventory_reservations',
    'order_items',
    'order_status_events',
    'orders',
    'payment_mode_audit_log',
    'policy_acceptances',
    'privacy_requests',
    'product_image_optimization_backup',
    'profiles',
    'proof_versions',
    'refunds',
    'return_items',
    'returns',
    'sales_leads',
    'saved_designs',
    'security_compliance_controls',
    'security_incidents',
    'shipping_packages',
    'staff_assignments',
    'staff_permissions',
    'staff_role_permissions',
    'staff_roles',
    'support_tickets',
    'wishlist_items'
  ];
begin
  for r in
    select distinct tablename
    from pg_policies
    where schemaname = 'public'
      and cmd = 'SELECT'
      and tablename = any(v_sensitive_tables)
      and (
        coalesce(qual, '') ilike '%is_admin%'
        or policyname ilike '%admin%'
      )
    order by tablename
  loop
    execute format(
      'drop policy if exists %I on public.%I',
      'admin_step_up_gate_select', r.tablename
    );
    execute format(
      'create policy %I on public.%I as restrictive for select to public using (%s)',
      'admin_step_up_gate_select', r.tablename, v_gate
    );
  end loop;
end
$$;

-- Direct database functions can expose or mutate privileged data without going
-- through a table policy first. Upgrade every current admin RPC guard to the
-- step-up helper while preserving its existing function body, owner and flags.
do $$
declare
  f record;
  v_definition text;
  v_patched text;
begin
  for f in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.prokind = 'f'
      and n.nspname in ('public', 'private')
      and p.proname not in ('is_admin', 'is_admin_step_up_authorized', 'admin_step_up_authorized')
      and pg_get_functiondef(p.oid) ilike '%is_admin()%'
  loop
    v_definition := pg_get_functiondef(f.oid);
    v_patched := replace(v_definition, 'private.is_admin()', 'public.is_admin_step_up_authorized()');
    v_patched := replace(v_patched, 'public.is_admin()', 'public.is_admin_step_up_authorized()');

    if v_patched = v_definition then
      raise exception 'Could not apply admin step-up guard to function %', f.oid::regprocedure;
    end if;

    execute v_patched;
  end loop;
end
$$;

commit;
