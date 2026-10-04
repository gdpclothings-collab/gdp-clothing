begin;

revoke all on function private.finance_manual_sale_ledger_trigger() from public,anon,authenticated;
revoke all on function private.finance_expense_ledger_trigger() from public,anon,authenticated;
revoke all on function private.finance_order_ledger_trigger() from public,anon,authenticated;
revoke all on function private.finance_order_cost_ledger_trigger() from public,anon,authenticated;
revoke all on function private.finance_refund_ledger_trigger() from public,anon,authenticated;
revoke all on function private.finance_stripe_balance_ledger_trigger() from public,anon,authenticated;
revoke all on function private.finance_stripe_payout_ledger_trigger() from public,anon,authenticated;

grant execute on function private.finance_manual_sale_ledger_trigger() to service_role;
grant execute on function private.finance_expense_ledger_trigger() to service_role;
grant execute on function private.finance_order_ledger_trigger() to service_role;
grant execute on function private.finance_order_cost_ledger_trigger() to service_role;
grant execute on function private.finance_refund_ledger_trigger() to service_role;
grant execute on function private.finance_stripe_balance_ledger_trigger() to service_role;
grant execute on function private.finance_stripe_payout_ledger_trigger() to service_role;

commit;
