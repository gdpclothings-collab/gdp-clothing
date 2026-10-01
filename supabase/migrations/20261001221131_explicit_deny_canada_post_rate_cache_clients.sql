drop policy if exists canada_post_rate_cache_no_client_access on public.canada_post_rate_cache;
create policy canada_post_rate_cache_no_client_access
on public.canada_post_rate_cache
for all
to anon, authenticated
using (false)
with check (false);
