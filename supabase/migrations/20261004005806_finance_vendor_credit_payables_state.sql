alter table public.finance_vendor_bills add column if not exists settled_at timestamptz;
alter table public.finance_vendor_bills add column if not exists settled_by uuid;

alter table public.finance_vendor_bills drop constraint if exists finance_vendor_bills_status_chk;
alter table public.finance_vendor_bills drop constraint if exists finance_vendor_bills_state_chk;
alter table public.finance_vendor_bills add constraint finance_vendor_bills_status_chk check (status in ('open','paid','settled','voided'));
alter table public.finance_vendor_bills add constraint finance_vendor_bills_state_chk check (
  (status='open' and paid_on is null and paid_at is null and paid_by is null and expense_id is null and voided_at is null and voided_by is null and void_reason is null and settled_at is null and settled_by is null)
  or (status='paid' and paid_on is not null and paid_at is not null and paid_by is not null and expense_id is not null and voided_at is null and voided_by is null and void_reason is null and settled_at is null and settled_by is null)
  or (status='settled' and paid_on is null and paid_at is null and paid_by is null and expense_id is null and voided_at is null and voided_by is null and void_reason is null and settled_at is not null and settled_by is not null)
  or (status='voided' and paid_on is null and paid_at is null and paid_by is null and expense_id is null and voided_at is not null and voided_by is not null and nullif(trim(void_reason),'') is not null and settled_at is null and settled_by is null)
);

alter table public.finance_vendor_bill_events drop constraint if exists finance_vendor_bill_events_event_type_check;
alter table public.finance_vendor_bill_events add constraint finance_vendor_bill_events_event_type_check check (event_type in ('created','paid','voided','po_linked','credit_applied','credit_application_reversed','credit_settled'));

alter table public.finance_purchase_order_events drop constraint if exists finance_purchase_order_events_event_type_check;
alter table public.finance_purchase_order_events add constraint finance_purchase_order_events_event_type_check check (event_type in ('created','updated','approved','cancelled','received','receipt_reversed','bill_linked','closed','reopened','purchase_returned','purchase_return_reversed','vendor_credit_linked'));

alter table public.finance_expenses drop constraint if exists finance_expenses_amount_check;
alter table public.finance_expenses add constraint finance_expenses_amount_check check (amount>0 or (amount=0 and tax>0));