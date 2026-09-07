begin;

-- GDP Clothing Security & Compliance Center
-- Additive governance metadata plus live read-only database posture checks.

create table if not exists public.security_compliance_controls (
  control_key text primary key,
  category text not null,
  title text not null,
  description text not null default '',
  priority text not null default 'medium'
    check (priority in ('critical', 'high', 'medium', 'low')),
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'verified', 'not_applicable')),
  evidence text not null default '',
  remediation text not null default '',
  owner_label text not null default 'Store owner',
  reviewed_at timestamptz,
  reviewed_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.security_compliance_controls enable row level security;

drop policy if exists security_compliance_controls_admin_select on public.security_compliance_controls;
create policy security_compliance_controls_admin_select
  on public.security_compliance_controls
  for select
  to authenticated
  using ((select public.is_admin()));

drop policy if exists security_compliance_controls_admin_insert on public.security_compliance_controls;
create policy security_compliance_controls_admin_insert
  on public.security_compliance_controls
  for insert
  to authenticated
  with check ((select public.is_admin()));

drop policy if exists security_compliance_controls_admin_update on public.security_compliance_controls;
create policy security_compliance_controls_admin_update
  on public.security_compliance_controls
  for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists security_compliance_controls_admin_delete on public.security_compliance_controls;
create policy security_compliance_controls_admin_delete
  on public.security_compliance_controls
  for delete
  to authenticated
  using ((select public.is_admin()));

grant select, insert, update, delete on public.security_compliance_controls to authenticated;
revoke all on public.security_compliance_controls from anon;

insert into public.security_compliance_controls
  (control_key, category, title, description, priority, status, evidence, remediation, owner_label)
values
  ('supabase_leaked_password_protection','Identity & access','Leaked-password protection','Block passwords known to have appeared in public breach corpuses.','critical','open','Supabase Security Advisor reported leaked-password protection disabled on 2026-09-07.','Enable leaked-password protection in Supabase Auth password security settings and retest account creation/reset flows.','Store owner'),
  ('admin_mfa','Identity & access','Admin multi-factor authentication','Require stronger authentication for owner and administrative accounts.','critical','open','','Enroll every GDP Clothing admin in MFA and enforce an elevated assurance level for sensitive administrative actions.','Store owner'),
  ('github_private_repository','Development security','Private production source repository','Keep production implementation details and operational configuration out of public source unless intentionally open-source.','high','open','GitHub reported gdpclothings-collab/gdp-clothing as public during the 2026-09-07 security baseline review.','Change the production repository to private after confirming Cloudflare deployment access remains connected.','Store owner'),
  ('github_security_scanning','Development security','Dependency and code security scanning','Continuously detect vulnerable dependencies and common code-level security issues.','high','open','Build and quality workflows exist; dedicated dependency/code security scanning still requires verification.','Enable dependency alerts, secret scanning/push protection where available, and automated code/security checks.','Development'),
  ('secret_management','Development security','Server-side secret management','Keep Stripe secrets, Supabase service-role credentials, webhook secrets, and other privileged credentials out of browser bundles and source control.','critical','in_progress','.env.example currently documents frontend-safe Supabase values and explicitly warns against VITE_* secret exposure.','Verify Cloudflare/Supabase runtime secrets, rotate any exposed credential, and periodically scan repository history.','Development'),
  ('cloudflare_waf','Edge protection','Cloudflare WAF baseline','Protect public routes with managed web-application firewall rules appropriate for an ecommerce storefront.','high','open','','Enable and review managed WAF rules, challenge behavior, exclusions, and false-positive handling.','Store owner'),
  ('cloudflare_rate_limiting','Edge protection','Rate limiting and abuse controls','Limit automated abuse against authentication, checkout, contact, upload, and other sensitive endpoints.','high','open','Database-side checkout rate limiting exists; Cloudflare edge enforcement still requires verification.','Add route-specific Cloudflare rate limits and bot controls for authentication, checkout, contact, and upload surfaces.','Development'),
  ('security_headers','Edge protection','Browser security headers','Reduce XSS, clickjacking, MIME confusion, and transport downgrade risk with restrictive response headers.','high','open','','Verify HSTS, CSP, frame-ancestors, Referrer-Policy, Permissions-Policy, and nosniff behavior on production responses.','Development'),
  ('payment_pci_scope','Payments','PCI DSS scope minimization','Ensure raw cardholder data is handled by Stripe-hosted or Stripe-controlled payment components rather than GDP Clothing infrastructure.','critical','in_progress','Stripe.js is installed in the GDP Clothing application; hosted payment flow and card-data boundaries require verification.','Confirm no PAN/CVV data is logged, persisted, proxied, or sent to Supabase/Cloudflare application storage; document the applicable PCI SAQ.','Store owner'),
  ('privacy_policy','Privacy','Customer privacy notice','Publish a clear privacy notice covering collection, purposes, service providers, access/correction, retention, and contact information.','critical','open','','Review the storefront privacy policy against current GDP Clothing data flows and Canadian privacy requirements.','Store owner'),
  ('customer_artwork_retention','Privacy','Customer artwork and photo retention','Define how long uploaded customer artwork/photos are retained and how deletion requests are handled.','high','open','Customer upload storage is owner-scoped at the database policy layer.','Set a documented retention period, deletion workflow, order-hold exceptions, and purge verification process.','Store owner'),
  ('backup_restore_test','Resilience','Backup and restore verification','Maintain recoverable production data and periodically prove restoration works.','high','open','','Document Supabase backup coverage and perform a controlled restore/recovery test on a non-production environment.','Development'),
  ('incident_response','Incident response','Security incident and breach procedure','Use a documented process to identify, contain, investigate, notify, recover, and preserve evidence after a security incident.','critical','open','','Create an incident severity model, contact tree, evidence checklist, notification decision process, and post-incident review.','Store owner'),
  ('quarterly_access_review','Identity & access','Quarterly privileged-access review','Regularly confirm who can access GitHub, Cloudflare, Supabase, Stripe, and GDP Clothing administration.','high','open','','Review privileged users quarterly and immediately remove access when it is no longer required.','Store owner')
on conflict (control_key) do update
set category=excluded.category,title=excluded.title,description=excluded.description,priority=excluded.priority,remediation=excluded.remediation,owner_label=excluded.owner_label,updated_at=now();

revoke execute on function public.log_order_activity() from public, anon, authenticated;

create or replace function public.security_compliance_snapshot()
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_public_tables integer := 0;
  v_rls_enabled integer := 0;
  v_rls_missing integer := 0;
  v_anon_definer integer := 0;
  v_customer_upload_policies integer := 0;
  v_public_views integer := 0;
  v_checkout_private boolean := false;
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select count(*)::integer,
         count(*) filter (where c.relrowsecurity)::integer,
         count(*) filter (where not c.relrowsecurity)::integer
  into v_public_tables, v_rls_enabled, v_rls_missing
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r','p');

  select count(*)::integer
  into v_anon_definer
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname='public'
    and p.prosecdef
    and has_function_privilege('anon', p.oid, 'EXECUTE');

  select count(distinct pol.cmd)::integer
  into v_customer_upload_policies
  from pg_policies pol
  where pol.schemaname='storage'
    and pol.tablename='objects'
    and pol.policyname like 'customer_uploads_owner_%'
    and pol.cmd in ('SELECT','INSERT','UPDATE','DELETE');

  select count(*)::integer
  into v_public_views
  from pg_views
  where schemaname='public';

  select c.relrowsecurity
    and not exists (
      select 1 from pg_policies pol
      where pol.schemaname='public'
        and pol.tablename='checkout_rate_limits'
    )
    and not has_function_privilege(
      'anon',
      'public.consume_checkout_rate_limit(text,integer,integer)',
      'EXECUTE'
    )
  into v_checkout_private
  from pg_class c
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public'
    and c.relname='checkout_rate_limits'
    and c.relkind in ('r','p')
  limit 1;

  return jsonb_build_object(
    'checked_at', now(),
    'public_table_count', v_public_tables,
    'rls_enabled_count', v_rls_enabled,
    'rls_missing_count', v_rls_missing,
    'anon_security_definer_count', v_anon_definer,
    'customer_upload_policy_count', v_customer_upload_policies,
    'checkout_rate_limit_private', coalesce(v_checkout_private,false),
    'public_view_count', v_public_views
  );
end;
$$;

revoke all on function public.security_compliance_snapshot() from public, anon;
grant execute on function public.security_compliance_snapshot() to authenticated;

commit;
