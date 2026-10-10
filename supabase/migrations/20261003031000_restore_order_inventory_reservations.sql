-- Recover an omitted historical inventory reservation table for fresh local databases.
-- This is additive. Preserve existing reservations, statuses and constraints in hosted databases.
create table if not exists public.order_inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  order_item_id uuid not null unique references public.order_items(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  location_id uuid not null references public.inventory_locations(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  status text not null default 'active'
    check (status in ('active', 'consumed', 'released', 'expired')),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists order_inventory_reservations_order_idx
  on public.order_inventory_reservations(order_id);
create index if not exists order_inventory_reservations_location_idx
  on public.order_inventory_reservations(location_id);
create index if not exists order_inventory_reservations_variant_idx
  on public.order_inventory_reservations(variant_id, status);
create index if not exists order_inventory_reservations_expiry_idx
  on public.order_inventory_reservations(status, expires_at) where status = 'active';

alter table public.order_inventory_reservations enable row level security;
revoke all on public.order_inventory_reservations from public, anon, authenticated;
-- Checkout reservations are managed by trusted server-side paths, not browser clients.
