-- Synthetic schema approximating the WELCOME10-relevant production columns and constraints.
-- Intentionally never includes production rows.
create role anon;
create role authenticated;
create role service_role;
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  customer_email text,
  discount_code text,
  payment_status text,
  payment_mode text,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  subtotal numeric not null default 0,
  discount numeric not null default 0
);
create table public.discounts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  type text not null default 'percentage',
  value numeric not null,
  applies_to text not null default 'all',
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  usage_count integer not null default 0,
  usage_limit integer,
  updated_at timestamptz not null default now()
);
create table public.order_coupon_reservations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  discount_id uuid not null references public.discounts(id),
  status text not null default 'active',
  expires_at timestamptz not null,
  consumed_at timestamptz,
  released_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  discount_id uuid not null references public.discounts(id),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  customer_email text,
  created_at timestamptz not null default now()
);
insert into public.discounts(code,type,value,applies_to,active)
values('SAVE5','fixed',5,'all',true);
