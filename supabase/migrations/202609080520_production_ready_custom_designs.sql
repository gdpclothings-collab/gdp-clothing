-- Store the exact customer-approved render on the existing custom design row.
-- Keeping this data on custom_designs preserves its existing ownership/RLS model.
alter table public.custom_designs
  add column if not exists design_path text,
  add column if not exists render_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists production_files jsonb not null default '{}'::jsonb,
  add column if not exists customer_mockup_path text,
  add column if not exists render_status text not null default 'draft',
  add column if not exists locked_hash text,
  add column if not exists customer_approved_at timestamptz,
  add column if not exists preflight jsonb not null default '{}'::jsonb;

alter table public.custom_designs
  drop constraint if exists custom_designs_render_status_check;

alter table public.custom_designs
  add constraint custom_designs_render_status_check
  check (render_status in ('draft', 'rendering', 'ready', 'failed', 'locked'));

alter table public.custom_designs
  drop constraint if exists custom_designs_locked_render_check;

alter table public.custom_designs
  add constraint custom_designs_locked_render_check
  check (
    render_status not in ('ready', 'locked')
    or (
      customer_approved_at is not null
      and locked_hash ~ '^[0-9a-f]{64}$'
      and jsonb_typeof(production_files) = 'object'
      and production_files <> '{}'::jsonb
    )
  );

create index if not exists custom_designs_render_status_idx
  on public.custom_designs (render_status, created_at desc);

comment on column public.custom_designs.render_snapshot is
  'Immutable customer-approved editor state used to produce the locked artwork.';
comment on column public.custom_designs.production_files is
  'Private customer-uploads storage paths plus dimensions and DPI for each printed side.';
comment on column public.custom_designs.locked_hash is
  'SHA-256 digest of the approved render snapshot.';
