create table if not exists public.product_image_optimization_backup (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  image_index integer not null check (image_index >= 0),
  original_url text not null,
  optimized_url text,
  original_bytes bigint,
  optimized_bytes bigint,
  original_width integer,
  original_height integer,
  optimized_width integer,
  optimized_height integer,
  status text not null default 'prepared' check (status in ('prepared', 'applied', 'reverted')),
  created_at timestamptz not null default now(),
  applied_at timestamptz,
  reverted_at timestamptz,
  unique (product_id, image_index, original_url)
);

alter table public.product_image_optimization_backup enable row level security;

grant select, insert, update on public.product_image_optimization_backup to authenticated;

create policy "product_image_optimization_admin_select"
on public.product_image_optimization_backup
for select
to authenticated
using ((select is_admin()));

create policy "product_image_optimization_admin_insert"
on public.product_image_optimization_backup
for insert
to authenticated
with check ((select is_admin()));

create policy "product_image_optimization_admin_update"
on public.product_image_optimization_backup
for update
to authenticated
using ((select is_admin()))
with check ((select is_admin()));

create index if not exists product_image_optimization_backup_product_idx
  on public.product_image_optimization_backup (product_id, status);
