-- GDP Clothing commerce operations layer
-- Adds operational data models without removing or rewriting existing storefront data.

create or replace function public.gdp_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  session_token uuid not null unique default gen_random_uuid(),
  customer_email text,
  customer_name text,
  cart jsonb not null default '[]'::jsonb,
  shipping_address jsonb not null default '{}'::jsonb,
  billing_address jsonb not null default '{}'::jsonb,
  currency text not null default 'CAD',
  subtotal numeric not null default 0 check (subtotal >= 0),
  discount numeric not null default 0 check (discount >= 0),
  shipping numeric not null default 0 check (shipping >= 0),
  tax numeric not null default 0 check (tax >= 0),
  total numeric not null default 0 check (total >= 0),
  status text not null default 'active'
    check (status in ('active','converted','abandoned','recovered','expired')),
  converted_order_id uuid references public.orders(id) on delete set null,
  recovery_email_sent_at timestamptz,
  last_activity_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists checkout_sessions_status_activity_idx on public.checkout_sessions(status, last_activity_at desc);
create index if not exists checkout_sessions_email_idx on public.checkout_sessions(lower(customer_email));
drop trigger if exists checkout_sessions_set_updated_at on public.checkout_sessions;
create trigger checkout_sessions_set_updated_at before update on public.checkout_sessions
for each row execute function public.gdp_set_updated_at();

create table if not exists public.returns (
  id uuid primary key default gen_random_uuid(),
  return_number text not null unique,
  order_id uuid not null references public.orders(id) on delete restrict,
  status text not null default 'requested'
    check (status in ('requested','approved','in_transit','received','completed','rejected','cancelled')),
  reason text,
  resolution text not null default 'refund'
    check (resolution in ('refund','exchange','store_credit','no_refund')),
  customer_notes text,
  admin_notes text,
  refund_amount numeric not null default 0 check (refund_amount >= 0),
  restock boolean not null default true,
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  received_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists returns_order_idx on public.returns(order_id);
create index if not exists returns_status_idx on public.returns(status, requested_at desc);
drop trigger if exists returns_set_updated_at on public.returns;
create trigger returns_set_updated_at before update on public.returns
for each row execute function public.gdp_set_updated_at();

create table if not exists public.return_items (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references public.returns(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  reason text,
  item_condition text check (item_condition is null or item_condition in ('unopened','new','worn','damaged','defective','other')),
  restock boolean not null default true,
  created_at timestamptz not null default now(),
  unique(return_id, order_item_id)
);
create index if not exists return_items_return_idx on public.return_items(return_id);

create table if not exists public.refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  return_id uuid references public.returns(id) on delete set null,
  amount numeric not null check (amount > 0),
  status text not null default 'pending'
    check (status in ('pending','succeeded','failed','cancelled')),
  provider text not null default 'stripe',
  provider_refund_id text,
  reason text,
  processed_by uuid references auth.users(id) on delete set null,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists refunds_order_idx on public.refunds(order_id, created_at desc);
drop trigger if exists refunds_set_updated_at on public.refunds;
create trigger refunds_set_updated_at before update on public.refunds
for each row execute function public.gdp_set_updated_at();

create table if not exists public.inventory_locations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  address jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  is_default boolean not null default false,
  fulfills_online boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists inventory_locations_one_default_idx on public.inventory_locations((is_default)) where is_default = true;
drop trigger if exists inventory_locations_set_updated_at on public.inventory_locations;
create trigger inventory_locations_set_updated_at before update on public.inventory_locations
for each row execute function public.gdp_set_updated_at();

create table if not exists public.inventory_levels (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.inventory_locations(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  available integer not null default 0 check (available >= 0),
  committed integer not null default 0 check (committed >= 0),
  incoming integer not null default 0 check (incoming >= 0),
  updated_at timestamptz not null default now(),
  unique(location_id, variant_id)
);
create index if not exists inventory_levels_variant_idx on public.inventory_levels(variant_id);
create index if not exists inventory_levels_location_idx on public.inventory_levels(location_id);
drop trigger if exists inventory_levels_set_updated_at on public.inventory_levels;
create trigger inventory_levels_set_updated_at before update on public.inventory_levels
for each row execute function public.gdp_set_updated_at();

create table if not exists public.inventory_adjustments (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.inventory_locations(id) on delete restrict,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  adjustment integer not null check (adjustment <> 0),
  before_quantity integer not null check (before_quantity >= 0),
  after_quantity integer not null check (after_quantity >= 0),
  reason text not null default 'manual'
    check (reason in ('manual','sale','return','damage','correction','transfer_in','transfer_out','restock','cycle_count')),
  note text,
  actor_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists inventory_adjustments_variant_idx on public.inventory_adjustments(variant_id, created_at desc);
create index if not exists inventory_adjustments_location_idx on public.inventory_adjustments(location_id, created_at desc);

create table if not exists public.inventory_transfers (
  id uuid primary key default gen_random_uuid(),
  transfer_number text not null unique,
  from_location_id uuid not null references public.inventory_locations(id) on delete restrict,
  to_location_id uuid not null references public.inventory_locations(id) on delete restrict,
  status text not null default 'draft'
    check (status in ('draft','ready','in_transit','received','cancelled')),
  note text,
  created_by uuid references auth.users(id) on delete set null,
  shipped_at timestamptz,
  received_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_location_id <> to_location_id)
);
create index if not exists inventory_transfers_status_idx on public.inventory_transfers(status, created_at desc);
drop trigger if exists inventory_transfers_set_updated_at on public.inventory_transfers;
create trigger inventory_transfers_set_updated_at before update on public.inventory_transfers
for each row execute function public.gdp_set_updated_at();

create table if not exists public.inventory_transfer_items (
  id uuid primary key default gen_random_uuid(),
  transfer_id uuid not null references public.inventory_transfers(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  received_quantity integer not null default 0 check (received_quantity >= 0),
  created_at timestamptz not null default now(),
  unique(transfer_id, variant_id)
);
create index if not exists inventory_transfer_items_transfer_idx on public.inventory_transfer_items(transfer_id);

create table if not exists public.markets (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  countries text[] not null default '{}',
  currency text not null default 'CAD',
  language text not null default 'en',
  domain text,
  pricing_adjustment numeric not null default 0,
  active boolean not null default false,
  is_primary boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists markets_one_primary_idx on public.markets((is_primary)) where is_primary = true;
drop trigger if exists markets_set_updated_at on public.markets;
create trigger markets_set_updated_at before update on public.markets
for each row execute function public.gdp_set_updated_at();

create table if not exists public.shipping_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  active boolean not null default true,
  product_scope text not null default 'all'
    check (product_scope in ('all','physical','custom','specific')),
  product_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists shipping_profiles_set_updated_at on public.shipping_profiles;
create trigger shipping_profiles_set_updated_at before update on public.shipping_profiles
for each row execute function public.gdp_set_updated_at();

create table if not exists public.shipping_rates (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.shipping_profiles(id) on delete cascade,
  market_id uuid references public.markets(id) on delete cascade,
  name text not null,
  method_code text not null,
  price numeric not null default 0 check (price >= 0),
  min_order numeric check (min_order is null or min_order >= 0),
  max_order numeric check (max_order is null or max_order >= 0),
  min_delivery_days integer check (min_delivery_days is null or min_delivery_days >= 0),
  max_delivery_days integer check (max_delivery_days is null or max_delivery_days >= 0),
  active boolean not null default true,
  conditions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists shipping_rates_profile_idx on public.shipping_rates(profile_id);
create index if not exists shipping_rates_market_idx on public.shipping_rates(market_id);
drop trigger if exists shipping_rates_set_updated_at on public.shipping_rates;
create trigger shipping_rates_set_updated_at before update on public.shipping_rates
for each row execute function public.gdp_set_updated_at();

create table if not exists public.tax_rules (
  id uuid primary key default gen_random_uuid(),
  market_id uuid references public.markets(id) on delete cascade,
  country_code text not null,
  region_code text,
  name text not null,
  rate numeric not null check (rate >= 0 and rate <= 1),
  tax_shipping boolean not null default false,
  active boolean not null default true,
  priority integer not null default 100,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tax_rules_region_idx on public.tax_rules(country_code, region_code, active);
drop trigger if exists tax_rules_set_updated_at on public.tax_rules;
create trigger tax_rules_set_updated_at before update on public.tax_rules
for each row execute function public.gdp_set_updated_at();

create table if not exists public.content_pages (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  page_type text not null default 'page' check (page_type in ('page','policy','landing','faq')),
  excerpt text,
  body jsonb not null default '{}'::jsonb,
  seo jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists content_pages_set_updated_at on public.content_pages;
create trigger content_pages_set_updated_at before update on public.content_pages
for each row execute function public.gdp_set_updated_at();

create table if not exists public.navigation_menus (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  handle text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists navigation_menus_set_updated_at on public.navigation_menus;
create trigger navigation_menus_set_updated_at before update on public.navigation_menus
for each row execute function public.gdp_set_updated_at();

create table if not exists public.navigation_items (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid not null references public.navigation_menus(id) on delete cascade,
  parent_id uuid references public.navigation_items(id) on delete cascade,
  label text not null,
  link_type text not null default 'url' check (link_type in ('url','page','product','collection')),
  target_id uuid,
  url text,
  position integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists navigation_items_menu_idx on public.navigation_items(menu_id, position);
drop trigger if exists navigation_items_set_updated_at on public.navigation_items;
create trigger navigation_items_set_updated_at before update on public.navigation_items
for each row execute function public.gdp_set_updated_at();

create table if not exists public.customer_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text,
  description text,
  created_at timestamptz not null default now()
);
create table if not exists public.customer_tag_assignments (
  id uuid primary key default gen_random_uuid(),
  customer_email text not null,
  tag_id uuid not null references public.customer_tags(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(customer_email, tag_id)
);
create index if not exists customer_tag_assignments_email_idx on public.customer_tag_assignments(lower(customer_email));
create table if not exists public.customer_segments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  segment_type text not null default 'manual' check (segment_type in ('manual','dynamic')),
  rules jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists customer_segments_set_updated_at on public.customer_segments;
create trigger customer_segments_set_updated_at before update on public.customer_segments
for each row execute function public.gdp_set_updated_at();
create table if not exists public.customer_segment_members (
  id uuid primary key default gen_random_uuid(),
  segment_id uuid not null references public.customer_segments(id) on delete cascade,
  customer_email text not null,
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(segment_id, customer_email)
);
create index if not exists customer_segment_members_email_idx on public.customer_segment_members(lower(customer_email));

create table if not exists public.staff_roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  system_role boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists staff_roles_set_updated_at on public.staff_roles;
create trigger staff_roles_set_updated_at before update on public.staff_roles
for each row execute function public.gdp_set_updated_at();

create table if not exists public.staff_permissions (
  key text primary key,
  name text not null,
  description text,
  category text not null default 'general'
);
create table if not exists public.staff_role_permissions (
  role_id uuid not null references public.staff_roles(id) on delete cascade,
  permission_key text not null references public.staff_permissions(key) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(role_id, permission_key)
);
create table if not exists public.staff_assignments (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role_id uuid not null references public.staff_roles(id) on delete restrict,
  active boolean not null default true,
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists staff_assignments_set_updated_at on public.staff_assignments;
create trigger staff_assignments_set_updated_at before update on public.staff_assignments
for each row execute function public.gdp_set_updated_at();

create table if not exists public.notification_templates (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  channel text not null default 'email' check (channel in ('email','sms','push','internal')),
  name text not null,
  subject text,
  body text not null default '',
  variables text[] not null default '{}',
  active boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists notification_templates_set_updated_at on public.notification_templates;
create trigger notification_templates_set_updated_at before update on public.notification_templates
for each row execute function public.gdp_set_updated_at();

create table if not exists public.app_integrations (
  id uuid primary key default gen_random_uuid(),
  provider text not null unique,
  display_name text not null,
  category text not null default 'other',
  status text not null default 'not_configured'
    check (status in ('not_configured','configured','active','paused','error')),
  enabled boolean not null default false,
  public_config jsonb not null default '{}'::jsonb,
  last_health_check_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists app_integrations_set_updated_at on public.app_integrations;
create trigger app_integrations_set_updated_at before update on public.app_integrations
for each row execute function public.gdp_set_updated_at();

create or replace function public.admin_adjust_inventory(
  p_variant_id uuid,
  p_location_id uuid,
  p_new_available integer,
  p_reason text default 'manual',
  p_note text default null
)
returns public.inventory_levels
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_level public.inventory_levels;
  v_before integer;
  v_total integer;
begin
  if not public.is_admin() then raise exception 'admin access required'; end if;
  if p_new_available < 0 then raise exception 'inventory cannot be negative'; end if;

  insert into public.inventory_levels(location_id, variant_id, available)
  values (p_location_id, p_variant_id, p_new_available)
  on conflict (location_id, variant_id)
  do update set available = excluded.available, updated_at = now()
  returning * into v_level;

  select coalesce((select ia.after_quantity from public.inventory_adjustments ia
    where ia.location_id = p_location_id and ia.variant_id = p_variant_id
    order by ia.created_at desc limit 1), p_new_available) into v_before;

  if v_before <> p_new_available then
    insert into public.inventory_adjustments(
      location_id, variant_id, adjustment, before_quantity, after_quantity, reason, note, actor_user_id
    ) values (
      p_location_id, p_variant_id, p_new_available - v_before, v_before, p_new_available, p_reason, p_note, auth.uid()
    );
  end if;

  select coalesce(sum(available),0) into v_total from public.inventory_levels where variant_id = p_variant_id;
  update public.product_variants set stock = v_total, updated_at = now() where id = p_variant_id;
  return v_level;
end;
$$;
revoke all on function public.admin_adjust_inventory(uuid, uuid, integer, text, text) from public;
grant execute on function public.admin_adjust_inventory(uuid, uuid, integer, text, text) to authenticated;

insert into public.inventory_locations(code, name, active, is_default, fulfills_online, sort_order)
values ('MAIN', 'GDP Main Inventory', true, true, true, 0)
on conflict (code) do nothing;
insert into public.inventory_levels(location_id, variant_id, available, committed, incoming)
select l.id, v.id, greatest(v.stock,0), 0, 0
from public.inventory_locations l cross join public.product_variants v
where l.code = 'MAIN'
on conflict (location_id, variant_id) do nothing;
insert into public.markets(code, name, countries, currency, language, active, is_primary)
values ('CA', 'Canada', array['CA'], 'CAD', 'en', true, true)
on conflict (code) do nothing;
insert into public.shipping_profiles(name, description, active, product_scope)
select 'General shipping', 'Default GDP Clothing shipping profile', true, 'all'
where not exists (select 1 from public.shipping_profiles);

insert into public.staff_permissions(key, name, description, category) values
  ('orders.read','View orders','View order records and status','orders'),
  ('orders.manage','Manage orders','Edit status, fulfillment and tracking','orders'),
  ('products.read','View products','View product catalog','products'),
  ('products.manage','Manage products','Create and edit products and collections','products'),
  ('inventory.read','View inventory','View inventory levels and locations','inventory'),
  ('inventory.manage','Manage inventory','Adjust stock and manage transfers','inventory'),
  ('customers.read','View customers','View customer profiles and history','customers'),
  ('customers.manage','Manage customers','Manage tags and segments','customers'),
  ('discounts.manage','Manage discounts','Create and edit discounts','marketing'),
  ('reviews.manage','Manage reviews','Moderate and verify reviews','content'),
  ('content.manage','Manage content','Edit pages and navigation','content'),
  ('custom_studio.manage','Manage Custom Studio','Manage artwork and proofs','operations'),
  ('production.manage','Manage production','Manage production workflow','operations'),
  ('analytics.read','View analytics','View analytics and finance dashboards','analytics'),
  ('settings.manage','Manage settings','Manage store configuration and integrations','settings'),
  ('staff.manage','Manage staff','Manage staff roles and permissions','settings')
on conflict (key) do nothing;

insert into public.staff_roles(key, name, description, system_role, active) values
  ('admin','Administrator','Full GDP Clothing commerce administration',true,true),
  ('operations','Operations','Orders, Custom Studio, production and inventory operations',true,true),
  ('merchandising','Merchandising','Products, collections, discounts, reviews and content',true,true),
  ('support','Customer Support','Orders and customer support visibility',true,true)
on conflict (key) do nothing;

insert into public.staff_role_permissions(role_id, permission_key)
select r.id, p.key from public.staff_roles r cross join public.staff_permissions p
where r.key = 'admin' on conflict do nothing;
insert into public.staff_role_permissions(role_id, permission_key)
select r.id, p.key from public.staff_roles r join public.staff_permissions p on p.key in (
  'orders.read','orders.manage','inventory.read','inventory.manage',
  'customers.read','custom_studio.manage','production.manage','analytics.read'
) where r.key = 'operations' on conflict do nothing;
insert into public.staff_role_permissions(role_id, permission_key)
select r.id, p.key from public.staff_roles r join public.staff_permissions p on p.key in (
  'products.read','products.manage','inventory.read','discounts.manage',
  'reviews.manage','content.manage','analytics.read'
) where r.key = 'merchandising' on conflict do nothing;
insert into public.staff_role_permissions(role_id, permission_key)
select r.id, p.key from public.staff_roles r join public.staff_permissions p on p.key in (
  'orders.read','customers.read'
) where r.key = 'support' on conflict do nothing;

insert into public.notification_templates(key, channel, name, subject, body, variables, active) values
  ('order_confirmation','email','Order confirmation','Your GDP Clothing order {{order_number}}','Thanks for your order. We will keep you updated as it moves through production and fulfillment.',array['order_number','customer_name'],true),
  ('proof_ready','email','Design proof ready','Your GDP Clothing proof is ready','Your custom design proof is ready for review.',array['order_number','proof_url'],true),
  ('order_shipped','email','Order shipped','Your GDP Clothing order has shipped','Your order is on the way. Tracking: {{tracking_number}}',array['order_number','tracking_number','carrier'],true),
  ('abandoned_checkout','email','Abandoned checkout','Your GDP Clothing cart is waiting','You still have items waiting in your GDP Clothing cart.',array['checkout_url','customer_name'],false)
on conflict (key) do nothing;

insert into public.app_integrations(provider, display_name, category, status, enabled) values
  ('supabase','Supabase','data','active',true),
  ('stripe','Stripe','payments','configured',true),
  ('github','GitHub','development','active',true),
  ('cloudflare','Cloudflare','deployment','configured',true)
on conflict (provider) do nothing;

alter table public.checkout_sessions enable row level security;
alter table public.returns enable row level security;
alter table public.return_items enable row level security;
alter table public.refunds enable row level security;
alter table public.inventory_locations enable row level security;
alter table public.inventory_levels enable row level security;
alter table public.inventory_adjustments enable row level security;
alter table public.inventory_transfers enable row level security;
alter table public.inventory_transfer_items enable row level security;
alter table public.markets enable row level security;
alter table public.shipping_profiles enable row level security;
alter table public.shipping_rates enable row level security;
alter table public.tax_rules enable row level security;
alter table public.content_pages enable row level security;
alter table public.navigation_menus enable row level security;
alter table public.navigation_items enable row level security;
alter table public.customer_tags enable row level security;
alter table public.customer_tag_assignments enable row level security;
alter table public.customer_segments enable row level security;
alter table public.customer_segment_members enable row level security;
alter table public.staff_roles enable row level security;
alter table public.staff_permissions enable row level security;
alter table public.staff_role_permissions enable row level security;
alter table public.staff_assignments enable row level security;
alter table public.notification_templates enable row level security;
alter table public.app_integrations enable row level security;

create policy checkout_sessions_admin_all on public.checkout_sessions for all using (public.is_admin()) with check (public.is_admin());
create policy checkout_sessions_owner_read on public.checkout_sessions for select using (user_id = auth.uid() or public.is_admin());
create policy returns_admin_all on public.returns for all using (public.is_admin()) with check (public.is_admin());
create policy returns_customer_read on public.returns for select using (
  public.is_admin() or exists (select 1 from public.orders o where o.id = returns.order_id and o.user_id = auth.uid())
);
create policy return_items_admin_all on public.return_items for all using (public.is_admin()) with check (public.is_admin());
create policy return_items_customer_read on public.return_items for select using (
  public.is_admin() or exists (
    select 1 from public.returns r join public.orders o on o.id = r.order_id
    where r.id = return_items.return_id and o.user_id = auth.uid()
  )
);
create policy refunds_admin_all on public.refunds for all using (public.is_admin()) with check (public.is_admin());
create policy refunds_customer_read on public.refunds for select using (
  public.is_admin() or exists (select 1 from public.orders o where o.id = refunds.order_id and o.user_id = auth.uid())
);
create policy inventory_locations_public_read on public.inventory_locations for select using (active or public.is_admin());
create policy inventory_locations_admin_write on public.inventory_locations for all using (public.is_admin()) with check (public.is_admin());
create policy inventory_levels_admin_all on public.inventory_levels for all using (public.is_admin()) with check (public.is_admin());
create policy inventory_adjustments_admin_all on public.inventory_adjustments for all using (public.is_admin()) with check (public.is_admin());
create policy inventory_transfers_admin_all on public.inventory_transfers for all using (public.is_admin()) with check (public.is_admin());
create policy inventory_transfer_items_admin_all on public.inventory_transfer_items for all using (public.is_admin()) with check (public.is_admin());
create policy markets_public_read_active on public.markets for select using (active or public.is_admin());
create policy markets_admin_write on public.markets for all using (public.is_admin()) with check (public.is_admin());
create policy shipping_profiles_public_read_active on public.shipping_profiles for select using (active or public.is_admin());
create policy shipping_profiles_admin_write on public.shipping_profiles for all using (public.is_admin()) with check (public.is_admin());
create policy shipping_rates_public_read_active on public.shipping_rates for select using (active or public.is_admin());
create policy shipping_rates_admin_write on public.shipping_rates for all using (public.is_admin()) with check (public.is_admin());
create policy tax_rules_public_read_active on public.tax_rules for select using (active or public.is_admin());
create policy tax_rules_admin_write on public.tax_rules for all using (public.is_admin()) with check (public.is_admin());
create policy content_pages_public_read_published on public.content_pages for select using (status = 'published' or public.is_admin());
create policy content_pages_admin_write on public.content_pages for all using (public.is_admin()) with check (public.is_admin());
create policy navigation_menus_public_read_active on public.navigation_menus for select using (active or public.is_admin());
create policy navigation_menus_admin_write on public.navigation_menus for all using (public.is_admin()) with check (public.is_admin());
create policy navigation_items_public_read_active on public.navigation_items for select using (
  public.is_admin() or (active and exists (select 1 from public.navigation_menus m where m.id = navigation_items.menu_id and m.active))
);
create policy navigation_items_admin_write on public.navigation_items for all using (public.is_admin()) with check (public.is_admin());
create policy customer_tags_admin_all on public.customer_tags for all using (public.is_admin()) with check (public.is_admin());
create policy customer_tag_assignments_admin_all on public.customer_tag_assignments for all using (public.is_admin()) with check (public.is_admin());
create policy customer_segments_admin_all on public.customer_segments for all using (public.is_admin()) with check (public.is_admin());
create policy customer_segment_members_admin_all on public.customer_segment_members for all using (public.is_admin()) with check (public.is_admin());
create policy staff_roles_admin_all on public.staff_roles for all using (public.is_admin()) with check (public.is_admin());
create policy staff_permissions_admin_all on public.staff_permissions for all using (public.is_admin()) with check (public.is_admin());
create policy staff_role_permissions_admin_all on public.staff_role_permissions for all using (public.is_admin()) with check (public.is_admin());
create policy staff_assignments_admin_all on public.staff_assignments for all using (public.is_admin()) with check (public.is_admin());
create policy notification_templates_admin_all on public.notification_templates for all using (public.is_admin()) with check (public.is_admin());
create policy app_integrations_admin_all on public.app_integrations for all using (public.is_admin()) with check (public.is_admin());
