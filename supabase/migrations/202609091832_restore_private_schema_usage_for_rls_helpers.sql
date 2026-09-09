-- Restore schema lookup access required by the public RLS helper wrappers.
-- Object permissions remain explicit; this does not grant table access.
grant usage on schema private to anon, authenticated;

-- Defense in depth: private quota state remains inaccessible to browser roles.
revoke all on table private.background_removal_rate_limits from anon, authenticated;
