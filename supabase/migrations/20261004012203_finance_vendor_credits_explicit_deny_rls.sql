create policy finance_vendor_credits_no_direct_access on public.finance_vendor_credits as restrictive for all to public using (false) with check (false);
create policy finance_vendor_credit_events_no_direct_access on public.finance_vendor_credit_events as restrictive for all to public using (false) with check (false);
create policy finance_vendor_credit_applications_no_direct_access on public.finance_vendor_credit_applications as restrictive for all to public using (false) with check (false);
create policy finance_purchase_returns_no_direct_access on public.finance_purchase_returns as restrictive for all to public using (false) with check (false);
create policy finance_purchase_return_items_no_direct_access on public.finance_purchase_return_items as restrictive for all to public using (false) with check (false);
create policy finance_purchase_return_events_no_direct_access on public.finance_purchase_return_events as restrictive for all to public using (false) with check (false);