-- Cloud My Designs: keep editor sources apart from immutable print snapshots.
-- Existing custom_designs owner-only RLS policies continue to apply.
alter table public.custom_designs
  add column if not exists studio_draft jsonb;

comment on column public.custom_designs.studio_draft is
  'Owner-scoped Custom Studio V2 editable source draft. Reorders must create new approved production files.';
