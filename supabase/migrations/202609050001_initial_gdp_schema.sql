-- GDP Clothing - Supabase foundation
-- One-time replacement for the former Base44 backend.
-- Safe to apply to a NEW Supabase project.

begin;

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- Helpers
-- ------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ------------------------------------------------------------
-- Auth profile
-- ------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'customer'
    check (role in ('customer', 'staff', 'admin')),
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(coalesce(new.email, ''), '@', 1)
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

-- ------------------------------------------------------------
-- Catalog
-- ------------------------------------------------------------

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  type text,
  category text,
  vendor text not null default 'GDP Clothing',
  barcode text,
  cost_per_item numeric(12,2) check (cost_per_item is null or cost_per_item >= 0),
  track_inventory boolean not null default true,
  requires_shipping boolean not null default true,
  taxable boolean not null default true,
  weight numeric(12,3) check (weight is null or weight >= 0),
  weight_unit text not null default 'g'
    check (weight_unit in ('g','kg','oz','lb')),
  price numeric(12,2) not null check (price >= 0),
  compare_at_price numeric(12,2) check (compare_at_price is null or compare_at_price >= 0),
  images text[] not null default '{}',
  colors text[] not null default '{}',
  sizes text[] not null default '{}',
  tags text[] not null default '{}',
  fulfillment_mode text not null default 'in_house'
    check (fulfillment_mode in ('in_house','pod','dropship','hybrid','manual')),
  pod_provider text,
  status text not null default 'draft'
    check (status in ('draft','active','archived')),
  featured boolean not null default false,
  best_seller boolean not null default false,
  new_arrival boolean not null default false,
  custom_designable boolean not null default false,
  customization jsonb not null default '{}'::jsonb,
  material text,
  seo jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text,
  sku text unique,
  pod_sku text,
  stock integer not null default 0 check (stock >= 0),
  price numeric(12,2) check (price is null or price >= 0),
  color text,
  size text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists product_variants_product_id_idx
  on public.product_variants(product_id);
create index if not exists products_status_idx
  on public.products(status);
create index if not exists products_category_idx
  on public.products(category);

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  image text,
  tagline text,
  seasonal boolean not null default false,
  sort_order text not null default 'manual'
    check (sort_order in (
      'manual','best_selling','alpha_asc','alpha_desc',
      'price_asc','price_desc','newest'
    )),
  status text not null default 'active'
    check (status in ('active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.collection_products (
  collection_id uuid not null references public.collections(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  position integer not null default 0,
  primary key (collection_id, product_id)
);

-- ------------------------------------------------------------
-- Orders
-- ------------------------------------------------------------

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  customer_email text not null,
  customer_name text,
  customer_phone text,
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  discount numeric(12,2) not null default 0 check (discount >= 0),
  shipping numeric(12,2) not null default 0 check (shipping >= 0),
  tax numeric(12,2) not null default 0 check (tax >= 0),
  total numeric(12,2) not null check (total >= 0),
  status text not null default 'pending_payment'
    check (status in (
      'draft','pending_payment','paid','payment_failed',
      'artwork_needed','design_in_progress','proof_ready',
      'awaiting_approval','revision_requested','approved',
      'production_queue','printing','quality_control','packing',
      'ready_for_pickup','shipped','out_for_delivery','delivered',
      'completed','cancelled','refunded','partially_refunded'
    )),
  fulfillment_status text,
  shipping_address jsonb not null default '{}'::jsonb,
  billing_address jsonb not null default '{}'::jsonb,
  shipping_method text,
  payment_status text not null default 'pending'
    check (payment_status in ('pending','paid','failed','refunded','partially_refunded')),
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  tracking_number text,
  carrier text,
  notes text,
  discount_code text,
  is_guest boolean not null default false,
  need_by_date date,
  priority text not null default 'standard'
    check (priority in ('standard','rush','due_soon')),
  production_checklist jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_user_id_idx on public.orders(user_id);
create index if not exists orders_customer_email_idx on public.orders(lower(customer_email));
create index if not exists orders_status_idx on public.orders(status);
create index if not exists orders_created_at_idx on public.orders(created_at desc);

-- ------------------------------------------------------------
-- Custom design workflow
-- ------------------------------------------------------------

create table if not exists public.custom_designs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  name text,
  design_style text,
  photos text[] not null default '{}',
  personalization jsonb not null default '{}'::jsonb,
  placement text not null default 'front'
    check (placement in (
      'front','front_back','back','left_chest',
      'large_front','large_back','sleeve'
    )),
  color text,
  size text,
  preview_url text,
  photo_assets jsonb not null default '[]'::jsonb,
  occasion text,
  recipient_type text,
  design_mood text,
  story text,
  design_intensity integer not null default 3 check (design_intensity between 1 and 5),
  garment_tier text not null default 'classic'
    check (garment_tier in ('classic','premium_vintage','oversized')),
  need_by_date date,
  priority text not null default 'standard'
    check (priority in ('standard','rush')),
  proof_required boolean not null default true,
  revision_allowance integer not null default 2 check (revision_allowance >= 0),
  primary_photo_index integer not null default 0 check (primary_photo_index >= 0),
  customer_confirmed_rights boolean not null default false,
  approval_policy_acknowledged boolean not null default false,
  additional_garments jsonb not null default '[]'::jsonb,
  status text not null default 'draft'
    check (status in ('draft','saved','in_cart','ordered','in_production')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists custom_designs_user_id_idx
  on public.custom_designs(user_id);
create index if not exists custom_designs_order_id_idx
  on public.custom_designs(order_id);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  custom_design_id uuid references public.custom_designs(id) on delete set null,
  name text not null,
  image text,
  variant text,
  size text,
  color text,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  fulfillment_mode text,
  is_custom boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists order_items_order_id_idx on public.order_items(order_id);

create table if not exists public.design_proofs (
  id uuid primary key default gen_random_uuid(),
  custom_design_id uuid not null references public.custom_designs(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  order_item_id uuid references public.order_items(id) on delete set null,
  current_version integer not null default 0 check (current_version >= 0),
  status text not null default 'pending'
    check (status in (
      'pending','in_progress','ready','sent','awaiting_approval',
      'revision_requested','revised','approved','rejected'
    )),
  customer_comments text[] not null default '{}',
  admin_comments text[] not null default '{}',
  approved_at timestamptz,
  revision_count integer not null default 0 check (revision_count >= 0),
  max_revisions integer not null default 2 check (max_revisions >= 0),
  revision_pins jsonb not null default '[]'::jsonb,
  approved_by uuid references auth.users(id) on delete set null,
  approval_acknowledged boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.proof_versions (
  id uuid primary key default gen_random_uuid(),
  proof_id uuid not null references public.design_proofs(id) on delete cascade,
  version integer not null check (version > 0),
  url text not null,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (proof_id, version)
);

-- ------------------------------------------------------------
-- Commerce support
-- ------------------------------------------------------------

create table if not exists public.discounts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  type text not null default 'percentage'
    check (type in ('percentage','fixed','free_shipping')),
  value numeric(12,2) not null check (value >= 0),
  applies_to text not null default 'all'
    check (applies_to in ('all','collection','product','customer')),
  applies_to_id uuid,
  min_purchase numeric(12,2) check (min_purchase is null or min_purchase >= 0),
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  usage_count integer not null default 0 check (usage_count >= 0),
  usage_limit integer check (usage_limit is null or usage_limit >= 0),
  qty_tier_2 numeric(5,2) not null default 20,
  qty_tier_3 numeric(5,2) not null default 25,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  product_name text,
  customer_name text not null,
  customer_email text,
  rating integer not null check (rating between 1 and 5),
  title text,
  body text,
  images text[] not null default '{}',
  verified boolean not null default false,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reviews_product_id_idx on public.reviews(product_id);

create table if not exists public.wishlist_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table if not exists public.saved_designs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  custom_design_id uuid not null references public.custom_designs(id) on delete cascade,
  name text,
  preview_url text,
  created_at timestamptz not null default now(),
  unique (user_id, custom_design_id)
);

create table if not exists public.store_settings (
  id smallint primary key default 1 check (id = 1),
  logo text,
  store_name text not null default 'GDP Clothing',
  slogan text not null default 'Design Your Dream, Wear Your Vision!',
  primary_color text,
  currency text not null default 'CAD',
  timezone text not null default 'America/Regina',
  order_prefix text not null default 'GDP',
  low_stock_threshold integer not null default 5 check (low_stock_threshold >= 0),
  contact_email text,
  phone text,
  address text,
  facebook text,
  instagram text,
  tiktok text,
  youtube text,
  footer_text text,
  updated_at timestamptz not null default now()
);

insert into public.store_settings (id)
values (1)
on conflict (id) do nothing;

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  subject text not null,
  message text not null,
  customer_email text not null,
  customer_name text,
  order_id uuid references public.orders(id) on delete set null,
  status text not null default 'open'
    check (status in ('open','in_progress','resolved','closed')),
  priority text not null default 'normal'
    check (priority in ('low','normal','high','urgent')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_status_events (
  id bigint generated by default as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  from_status text,
  to_status text not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists order_status_events_order_id_idx
  on public.order_status_events(order_id, created_at desc);

-- ------------------------------------------------------------
-- updated_at triggers
-- ------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'products',
    'product_variants',
    'collections',
    'orders',
    'custom_designs',
    'design_proofs',
    'discounts',
    'reviews',
    'store_settings',
    'support_tickets'
  ]
  loop
    execute format('drop trigger if exists %I_set_updated_at on public.%I', t, t);
    execute format(
      'create trigger %I_set_updated_at before update on public.%I for each row execute procedure public.set_updated_at()',
      t, t
    );
  end loop;
end
$$;

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.collections enable row level security;
alter table public.collection_products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.custom_designs enable row level security;
alter table public.design_proofs enable row level security;
alter table public.proof_versions enable row level security;
alter table public.discounts enable row level security;
alter table public.reviews enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.saved_designs enable row level security;
alter table public.store_settings enable row level security;
alter table public.support_tickets enable row level security;
alter table public.order_status_events enable row level security;

-- Profiles
create policy "profiles_select_self_or_admin"
on public.profiles for select
using (id = auth.uid() or public.is_admin());

create policy "profiles_update_self_or_admin"
on public.profiles for update
using (id = auth.uid() or public.is_admin())
with check (
  (id = auth.uid() and role = (select p.role from public.profiles p where p.id = auth.uid()))
  or public.is_admin()
);

-- Catalog public reads
create policy "products_public_read_active"
on public.products for select
using (status = 'active' or public.is_admin());

create policy "products_admin_write"
on public.products for all
using (public.is_admin())
with check (public.is_admin());

create policy "variants_public_read_active_product"
on public.product_variants for select
using (
  active = true
  and exists (
    select 1 from public.products p
    where p.id = product_id and p.status = 'active'
  )
  or public.is_admin()
);

create policy "variants_admin_write"
on public.product_variants for all
using (public.is_admin())
with check (public.is_admin());

create policy "collections_public_read_active"
on public.collections for select
using (status = 'active' or public.is_admin());

create policy "collections_admin_write"
on public.collections for all
using (public.is_admin())
with check (public.is_admin());

create policy "collection_products_public_read"
on public.collection_products for select
using (
  exists (
    select 1
    from public.collections c
    join public.products p on p.id = collection_products.product_id
    where c.id = collection_products.collection_id
      and c.status = 'active'
      and p.status = 'active'
  )
  or public.is_admin()
);

create policy "collection_products_admin_write"
on public.collection_products for all
using (public.is_admin())
with check (public.is_admin());

-- Orders: customers read their own; writes happen through trusted server functions.
create policy "orders_select_own_or_admin"
on public.orders for select
using (user_id = auth.uid() or public.is_admin());

create policy "orders_admin_write"
on public.orders for all
using (public.is_admin())
with check (public.is_admin());

create policy "order_items_select_own_or_admin"
on public.order_items for select
using (
  exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and (o.user_id = auth.uid() or public.is_admin())
  )
);

create policy "order_items_admin_write"
on public.order_items for all
using (public.is_admin())
with check (public.is_admin());

-- Custom designs
create policy "custom_designs_select_own_or_admin"
on public.custom_designs for select
using (user_id = auth.uid() or public.is_admin());

create policy "custom_designs_insert_own"
on public.custom_designs for insert
with check (user_id = auth.uid());

create policy "custom_designs_update_own_or_admin"
on public.custom_designs for update
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

create policy "custom_designs_delete_own_or_admin"
on public.custom_designs for delete
using (user_id = auth.uid() or public.is_admin());

-- Proofs
create policy "design_proofs_select_customer_or_admin"
on public.design_proofs for select
using (
  public.is_admin()
  or exists (
    select 1
    from public.custom_designs d
    where d.id = design_proofs.custom_design_id
      and d.user_id = auth.uid()
  )
);

create policy "design_proofs_admin_write"
on public.design_proofs for all
using (public.is_admin())
with check (public.is_admin());

create policy "proof_versions_select_customer_or_admin"
on public.proof_versions for select
using (
  public.is_admin()
  or exists (
    select 1
    from public.design_proofs dp
    join public.custom_designs d on d.id = dp.custom_design_id
    where dp.id = proof_versions.proof_id
      and d.user_id = auth.uid()
  )
);

create policy "proof_versions_admin_write"
on public.proof_versions for all
using (public.is_admin())
with check (public.is_admin());

-- Discounts are server/admin only.
create policy "discounts_admin_only"
on public.discounts for all
using (public.is_admin())
with check (public.is_admin());

-- Reviews
create policy "reviews_public_approved_or_own"
on public.reviews for select
using (
  status = 'approved'
  or user_id = auth.uid()
  or public.is_admin()
);

create policy "reviews_insert_own"
on public.reviews for insert
with check (user_id = auth.uid());

create policy "reviews_update_own_pending"
on public.reviews for update
using ((user_id = auth.uid() and status = 'pending') or public.is_admin())
with check ((user_id = auth.uid() and status = 'pending') or public.is_admin());

create policy "reviews_admin_delete"
on public.reviews for delete
using (public.is_admin());

-- Wishlist and saved designs
create policy "wishlist_owner_all"
on public.wishlist_items for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "wishlist_admin_read"
on public.wishlist_items for select
using (public.is_admin());

create policy "saved_designs_owner_all"
on public.saved_designs for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "saved_designs_admin_read"
on public.saved_designs for select
using (public.is_admin());

-- Store settings
create policy "store_settings_public_read"
on public.store_settings for select
using (true);

create policy "store_settings_admin_write"
on public.store_settings for all
using (public.is_admin())
with check (public.is_admin());

-- Support
create policy "support_tickets_select_own_or_admin"
on public.support_tickets for select
using (user_id = auth.uid() or public.is_admin());

create policy "support_tickets_insert_customer"
on public.support_tickets for insert
with check (user_id is null or user_id = auth.uid());

create policy "support_tickets_admin_update"
on public.support_tickets for update
using (public.is_admin())
with check (public.is_admin());

create policy "support_tickets_admin_delete"
on public.support_tickets for delete
using (public.is_admin());

-- Order status history
create policy "order_status_events_select_own_or_admin"
on public.order_status_events for select
using (
  public.is_admin()
  or exists (
    select 1 from public.orders o
    where o.id = order_status_events.order_id
      and o.user_id = auth.uid()
  )
);

create policy "order_status_events_admin_write"
on public.order_status_events for all
using (public.is_admin())
with check (public.is_admin());

-- ------------------------------------------------------------
-- Storage
-- ------------------------------------------------------------

insert into storage.buckets (id, name, public)
values
  ('product-images', 'product-images', true),
  ('customer-uploads', 'customer-uploads', false),
  ('design-proofs', 'design-proofs', false)
on conflict (id) do nothing;

-- Product images: public read, admin writes.
create policy "product_images_public_read"
on storage.objects for select
using (bucket_id = 'product-images');

create policy "product_images_admin_insert"
on storage.objects for insert
with check (bucket_id = 'product-images' and public.is_admin());

create policy "product_images_admin_update"
on storage.objects for update
using (bucket_id = 'product-images' and public.is_admin())
with check (bucket_id = 'product-images' and public.is_admin());

create policy "product_images_admin_delete"
on storage.objects for delete
using (bucket_id = 'product-images' and public.is_admin());

-- Customer uploads live under <user_id>/...
create policy "customer_uploads_owner_read"
on storage.objects for select
using (
  bucket_id = 'customer-uploads'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
  )
);

create policy "customer_uploads_owner_insert"
on storage.objects for insert
with check (
  bucket_id = 'customer-uploads'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "customer_uploads_owner_update"
on storage.objects for update
using (
  bucket_id = 'customer-uploads'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'customer-uploads'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "customer_uploads_owner_delete"
on storage.objects for delete
using (
  bucket_id = 'customer-uploads'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
  )
);

-- Proof files also live under <customer_user_id>/...
create policy "design_proofs_customer_read"
on storage.objects for select
using (
  bucket_id = 'design-proofs'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
  )
);

create policy "design_proofs_admin_insert"
on storage.objects for insert
with check (bucket_id = 'design-proofs' and public.is_admin());

create policy "design_proofs_admin_update"
on storage.objects for update
using (bucket_id = 'design-proofs' and public.is_admin())
with check (bucket_id = 'design-proofs' and public.is_admin());

create policy "design_proofs_admin_delete"
on storage.objects for delete
using (bucket_id = 'design-proofs' and public.is_admin());

commit;
