-- Additive metadata for prepared invoice drafts; no checkout/payment behavior changes.
alter table public.orders add column if not exists invoice_due_date date;
alter table public.orders add column if not exists invoice_payment_terms text;
alter table public.orders add constraint orders_invoice_terms_length check (invoice_payment_terms is null or length(invoice_payment_terms) <= 120);
comment on column public.orders.invoice_due_date is 'Requested due date for a manually prepared invoice; independent of fulfilment need_by_date.';
comment on column public.orders.invoice_payment_terms is 'Human-readable payment terms for manual invoice drafts.';
