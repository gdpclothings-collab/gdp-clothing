begin;

create index if not exists finance_tax_registration_created_by_idx
  on public.finance_tax_registration_settings (created_by);
create index if not exists finance_tax_registration_updated_by_idx
  on public.finance_tax_registration_settings (updated_by);
create index if not exists finance_tax_filing_closed_by_idx
  on public.finance_tax_filing_periods (closed_by);
create index if not exists finance_tax_filing_filed_by_idx
  on public.finance_tax_filing_periods (filed_by);
create index if not exists finance_tax_filing_reopened_by_idx
  on public.finance_tax_filing_periods (reopened_by);
create index if not exists finance_tax_filing_created_by_idx
  on public.finance_tax_filing_periods (created_by);

commit;
