-- Admin-only DTF export audit trail. Role enforcement is performed by RLS,
-- so a browser cannot grant itself bypass access by changing UI state.
create table if not exists public.dtf_export_audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  export_type text not null check (export_type in ('watermarked_preview', 'clean_preview', 'production_package')),
  source text not null default 'builder' check (source in ('builder', 'admin_queue')),
  film_width numeric(8,2) not null check (film_width > 0),
  film_length numeric(10,2) not null check (film_length > 0),
  artwork_count integer not null default 0 check (artwork_count >= 0),
  order_id uuid references public.orders(id) on delete set null,
  order_item_id uuid references public.order_items(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.dtf_export_audit_log enable row level security;

create policy dtf_export_audit_admin_select
on public.dtf_export_audit_log for select to authenticated
using ((select public.is_admin()));

create policy dtf_export_audit_admin_insert
on public.dtf_export_audit_log for insert to authenticated
with check (user_id = (select auth.uid()) and (select public.is_admin()));

create index if not exists dtf_export_audit_created_at_idx
on public.dtf_export_audit_log (created_at desc);

update public.store_settings
set dtf_settings = coalesce(dtf_settings, '{}'::jsonb) || jsonb_build_object(
  'adminPreviewBypassEnabled', true,
  'previewDownloadDpi', 72,
  'previewDownloadQuality', 0.85
), updated_at = now()
where id = 1;
