-- Public-schema RPCs already use explicit role grants; remove the blanket PUBLIC path.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;

-- Prevent future postgres-owned application functions from becoming executable by
-- every database role unless a migration explicitly grants the intended access.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
