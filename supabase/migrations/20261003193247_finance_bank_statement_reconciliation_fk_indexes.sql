create index if not exists finance_bank_statement_closed_by_idx
  on public.finance_bank_statement_reconciliations (closed_by);

create index if not exists finance_bank_statement_last_reopened_by_idx
  on public.finance_bank_statement_reconciliations (last_reopened_by);
