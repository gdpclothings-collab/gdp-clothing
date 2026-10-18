-- AuthComplete checks these persisted policy acceptances after Google OAuth.
-- The table had RLS enabled and SELECT granted to authenticated, but no
-- SELECT policy; every signed-in user's query returned an empty array.
-- A one-time consent was therefore requested again at every sign-in.
--
-- Allow only the owner to read their own acceptance receipts. No browser
-- INSERT/UPDATE/DELETE privileges and no admin-role bypass.
create policy "policy_acceptances_read_own"
on public.policy_acceptances
for select
to authenticated
using (user_id = (select auth.uid()));
