-- Service-only Stripe dispute/chargeback lifecycle tracking.
-- Client roles have no direct access; the signed Stripe webhook writes with the
-- Supabase service role after verifying the Stripe webhook signature.

create table if not exists public.payment_disputes (
  stripe_dispute_id text primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  payment_mode text not null check (payment_mode in ('live', 'test')),
  stripe_payment_intent_id text not null,
  stripe_charge_id text,
  status text not null,
  reason text,
  amount bigint not null check (amount >= 0),
  currency text not null,
  evidence_due_by timestamptz,
  evidence_past_due boolean,
  evidence_submission_count integer,
  last_event_id text not null,
  last_event_type text not null,
  last_event_created timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_disputes_order_id_idx
  on public.payment_disputes(order_id);
create index if not exists payment_disputes_payment_intent_idx
  on public.payment_disputes(stripe_payment_intent_id);
create index if not exists payment_disputes_status_idx
  on public.payment_disputes(status);

alter table public.payment_disputes enable row level security;
revoke all on table public.payment_disputes from public, anon, authenticated;
grant select, insert, update on table public.payment_disputes to service_role;

comment on table public.payment_disputes is
  'Service-role-only Stripe dispute lifecycle records. No customer/client access.';
