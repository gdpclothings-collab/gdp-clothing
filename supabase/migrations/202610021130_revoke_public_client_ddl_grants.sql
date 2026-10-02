-- Browser clients do not need DDL-adjacent privileges on public tables.
-- TRUNCATE is especially important to remove because it bypasses row-level security.
REVOKE TRUNCATE, REFERENCES, TRIGGER
ON ALL TABLES IN SCHEMA public
FROM anon, authenticated;

-- Prevent postgres-owned application tables created by future migrations from
-- automatically restoring these privileges to browser-facing roles.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
REVOKE TRUNCATE, REFERENCES, TRIGGER
ON TABLES
FROM anon, authenticated;
