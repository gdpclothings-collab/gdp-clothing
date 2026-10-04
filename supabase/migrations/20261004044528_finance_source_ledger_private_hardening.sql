begin;

revoke all on function private.finance_append_ledger_line(jsonb,text,text,numeric,numeric) from public,anon,authenticated;
revoke all on function private.finance_expense_account_key(text) from public,anon,authenticated;
revoke all on function private.finance_sync_manual_sale_source(uuid) from public,anon,authenticated;
revoke all on function private.finance_sync_expense_source(uuid) from public,anon,authenticated;
revoke all on function private.finance_sync_order_revenue_source(uuid) from public,anon,authenticated;
revoke all on function private.finance_sync_order_cogs_source(uuid) from public,anon,authenticated;
revoke all on function private.finance_sync_refund_source(uuid) from public,anon,authenticated;
revoke all on function private.finance_sync_stripe_fee_source(text) from public,anon,authenticated;
revoke all on function private.finance_sync_stripe_payout_source(text) from public,anon,authenticated;

revoke all on function private.finance_manual_sale_ledger_trigger() from public,anon,authenticated;
revoke all on function private.finance_expense_ledger_trigger() from public,anon,authenticated;
revoke all on function private.finance_order_ledger_trigger() from public,anon,authenticated;
revoke all on function private.finance_order_cost_ledger_trigger() from public,anon,authenticated;
revoke all on function private.finance_refund_ledger_trigger() from public,anon,authenticated;
revoke all on function private.finance_stripe_balance_ledger_trigger() from public,anon,authenticated;
revoke all on function private.finance_stripe_payout_ledger_trigger() from public,anon,authenticated;

grant execute on function private.finance_append_ledger_line(jsonb,text,text,numeric,numeric) to service_role;
grant execute on function private.finance_expense_account_key(text) to service_role;
grant execute on function private.finance_sync_manual_sale_source(uuid) to service_role;
grant execute on function private.finance_sync_expense_source(uuid) to service_role;
grant execute on function private.finance_sync_order_revenue_source(uuid) to service_role;
grant execute on function private.finance_sync_order_cogs_source(uuid) to service_role;
grant execute on function private.finance_sync_refund_source(uuid) to service_role;
grant execute on function private.finance_sync_stripe_fee_source(text) to service_role;
grant execute on function private.finance_sync_stripe_payout_source(text) to service_role;

grant execute on function private.finance_manual_sale_ledger_trigger() to service_role;
grant execute on function private.finance_expense_ledger_trigger() to service_role;
grant execute on function private.finance_order_ledger_trigger() to service_role;
grant execute on function private.finance_order_cost_ledger_trigger() to service_role;
grant execute on function private.finance_refund_ledger_trigger() to service_role;
grant execute on function private.finance_stripe_balance_ledger_trigger() to service_role;
grant execute on function private.finance_stripe_payout_ledger_trigger() to service_role;

commit;
