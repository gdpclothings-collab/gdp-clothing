begin;

revoke all on public.finance_manual_sales from authenticated;
grant select, insert on public.finance_manual_sales to authenticated;
grant update (status, voided_at, voided_by, void_reason) on public.finance_manual_sales to authenticated;

commit;
