begin;

drop policy if exists finance_expenses_admin_insert on public.finance_expenses;
create policy finance_expenses_admin_insert
  on public.finance_expenses
  for insert
  to authenticated
  with check (
    public.is_admin_step_up_authorized()
    and (created_by is null or created_by = (select auth.uid()))
  );

commit;
