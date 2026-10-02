-- PostgreSQL 17 exposes MAINTAIN as a table privilege. Browser-facing roles do not
-- need VACUUM/ANALYZE/CLUSTER-style maintenance capability on application tables.
REVOKE MAINTAIN
ON ALL TABLES IN SCHEMA public
FROM anon, authenticated;

-- Prevent postgres-owned application tables created by future migrations from
-- automatically restoring MAINTAIN to browser-facing roles.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
REVOKE MAINTAIN
ON TABLES
FROM anon, authenticated;
