create sequence if not exists public.finance_vendor_credit_seq start 1;
create sequence if not exists public.finance_purchase_return_seq start 1;

create table public.finance_vendor_credits (
  id uuid primary key default gen_random_uuid(),
  credit_number text not null unique,
  issue_date date not null,
  vendor text not null,
  supplier_id uuid references public.finance_suppliers(id) on delete restrict,
  purchase_order_id uuid references public.finance_purchase_orders(id) on delete restrict,
  source_type text not null default 'manual',
  description text not null,
  amount numeric not null default 0,
  gst_hst_tax numeric not null default 0,
  pst_tax numeric not null default 0,
  currency text not null default 'CAD',
  status text not null default 'open',
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid,
  void_reason text,
  constraint finance_vendor_credits_source_chk check (source_type in ('manual','purchase_return')),
  constraint finance_vendor_credits_amount_chk check (amount >= 0 and gst_hst_tax >= 0 and pst_tax >= 0 and round(amount+gst_hst_tax+pst_tax,2) > 0),
  constraint finance_vendor_credits_currency_chk check (currency='CAD'),
  constraint finance_vendor_credits_status_chk check (status in ('open','applied','voided')),
  constraint finance_vendor_credits_state_chk check (
    (status in ('open','applied') and voided_at is null and voided_by is null and void_reason is null)
    or
    (status='voided' and voided_at is not null and voided_by is not null and nullif(trim(void_reason),'') is not null)
  ),
  constraint finance_vendor_credits_text_chk check (char_length(credit_number)<=120 and char_length(vendor)<=200 and char_length(description)<=500 and char_length(coalesce(notes,''))<=1000 and char_length(coalesce(void_reason,''))<=500)
);

create table public.finance_vendor_credit_events (
  id uuid primary key default gen_random_uuid(),
  credit_id uuid not null references public.finance_vendor_credits(id) on delete restrict,
  event_type text not null check (event_type in ('created','applied','application_reversed','voided')),
  reason text,
  before_snapshot jsonb,
  after_snapshot jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table public.finance_vendor_credit_applications (
  id uuid primary key default gen_random_uuid(),
  credit_id uuid not null references public.finance_vendor_credits(id) on delete restrict,
  bill_id uuid not null references public.finance_vendor_bills(id) on delete restrict,
  amount numeric not null default 0,
  gst_hst_tax numeric not null default 0,
  pst_tax numeric not null default 0,
  status text not null default 'active',
  note text,
  created_by uuid,
  created_at timestamptz not null default now(),
  reversed_at timestamptz,
  reversed_by uuid,
  reverse_reason text,
  constraint finance_vendor_credit_applications_amount_chk check (amount>=0 and gst_hst_tax>=0 and pst_tax>=0 and round(amount+gst_hst_tax+pst_tax,2)>0),
  constraint finance_vendor_credit_applications_status_chk check (status in ('active','reversed')),
  constraint finance_vendor_credit_applications_state_chk check (
    (status='active' and reversed_at is null and reversed_by is null and reverse_reason is null)
    or
    (status='reversed' and reversed_at is not null and reversed_by is not null and nullif(trim(reverse_reason),'') is not null)
  ),
  constraint finance_vendor_credit_applications_text_chk check (char_length(coalesce(note,''))<=500 and char_length(coalesce(reverse_reason,''))<=500)
);

create table public.finance_purchase_returns (
  id uuid primary key default gen_random_uuid(),
  return_number text not null unique,
  purchase_order_id uuid not null references public.finance_purchase_orders(id) on delete restrict,
  receipt_id uuid not null references public.finance_purchase_receipts(id) on delete restrict,
  vendor_credit_id uuid not null unique references public.finance_vendor_credits(id) on delete restrict,
  return_date date not null,
  location_id uuid references public.inventory_locations(id) on delete restrict,
  reason text not null,
  notes text,
  status text not null default 'posted',
  created_by uuid,
  created_at timestamptz not null default now(),
  reversed_at timestamptz,
  reversed_by uuid,
  reverse_reason text,
  constraint finance_purchase_returns_status_chk check (status in ('posted','reversed')),
  constraint finance_purchase_returns_state_chk check (
    (status='posted' and reversed_at is null and reversed_by is null and reverse_reason is null)
    or
    (status='reversed' and reversed_at is not null and reversed_by is not null and nullif(trim(reverse_reason),'') is not null)
  ),
  constraint finance_purchase_returns_text_chk check (char_length(return_number)<=120 and char_length(reason)<=500 and char_length(coalesce(notes,''))<=1000 and char_length(coalesce(reverse_reason,''))<=500)
);

create table public.finance_purchase_return_items (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references public.finance_purchase_returns(id) on delete restrict,
  purchase_receipt_item_id uuid not null references public.finance_purchase_receipt_items(id) on delete restrict,
  purchase_order_item_id uuid not null references public.finance_purchase_order_items(id) on delete restrict,
  quantity_returned numeric not null check (quantity_returned>0),
  credit_amount numeric not null default 0 check (credit_amount>=0),
  credit_gst_hst_tax numeric not null default 0 check (credit_gst_hst_tax>=0),
  credit_pst_tax numeric not null default 0 check (credit_pst_tax>=0),
  inventory_adjustment_id uuid references public.inventory_adjustments(id) on delete restrict,
  reversal_adjustment_id uuid references public.inventory_adjustments(id) on delete restrict,
  before_available integer,
  after_available integer,
  created_at timestamptz not null default now(),
  unique(return_id,purchase_receipt_item_id),
  constraint finance_purchase_return_items_inventory_shape_chk check (
    (inventory_adjustment_id is null and before_available is null and after_available is null)
    or
    (inventory_adjustment_id is not null and before_available is not null and after_available is not null and after_available<=before_available and after_available>=0)
  )
);

create table public.finance_purchase_return_events (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references public.finance_purchase_returns(id) on delete restrict,
  event_type text not null check (event_type in ('posted','reversed')),
  reason text,
  before_snapshot jsonb,
  after_snapshot jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);

alter table public.finance_vendor_credits enable row level security;
alter table public.finance_vendor_credit_events enable row level security;
alter table public.finance_vendor_credit_applications enable row level security;
alter table public.finance_purchase_returns enable row level security;
alter table public.finance_purchase_return_items enable row level security;
alter table public.finance_purchase_return_events enable row level security;

revoke all on table public.finance_vendor_credits,public.finance_vendor_credit_events,public.finance_vendor_credit_applications,public.finance_purchase_returns,public.finance_purchase_return_items,public.finance_purchase_return_events from public,anon,authenticated;
revoke all on sequence public.finance_vendor_credit_seq,public.finance_purchase_return_seq from public,anon,authenticated;
grant all on table public.finance_vendor_credits,public.finance_vendor_credit_events,public.finance_vendor_credit_applications,public.finance_purchase_returns,public.finance_purchase_return_items,public.finance_purchase_return_events to service_role;
grant all on sequence public.finance_vendor_credit_seq,public.finance_purchase_return_seq to service_role;

create index finance_vendor_credits_supplier_idx on public.finance_vendor_credits(supplier_id) where supplier_id is not null;
create index finance_vendor_credits_po_idx on public.finance_vendor_credits(purchase_order_id) where purchase_order_id is not null;
create index finance_vendor_credits_status_date_idx on public.finance_vendor_credits(status,issue_date desc);
create index finance_vendor_credit_events_credit_idx on public.finance_vendor_credit_events(credit_id,created_at desc);
create index finance_vendor_credit_applications_credit_idx on public.finance_vendor_credit_applications(credit_id,status,created_at desc);
create index finance_vendor_credit_applications_bill_idx on public.finance_vendor_credit_applications(bill_id,status,created_at desc);
create index finance_purchase_returns_po_idx on public.finance_purchase_returns(purchase_order_id,status,return_date desc);
create index finance_purchase_returns_receipt_idx on public.finance_purchase_returns(receipt_id,status,return_date desc);
create index finance_purchase_returns_credit_idx on public.finance_purchase_returns(vendor_credit_id);
create index finance_purchase_return_items_return_idx on public.finance_purchase_return_items(return_id);
create index finance_purchase_return_items_receipt_item_idx on public.finance_purchase_return_items(purchase_receipt_item_id);
create index finance_purchase_return_items_po_item_idx on public.finance_purchase_return_items(purchase_order_item_id);
create index finance_purchase_return_events_return_idx on public.finance_purchase_return_events(return_id,created_at desc);