-- Role model redesign: admin / staff / client (see docs/ROLE_MODEL_REDESIGN.md)
--
-- Collapses company_memberships.role's old "admin" (company owner) into
-- role = "staff" + a new is_owner bit, so "admin" only ever means
-- users.is_platform_admin (Vierra, global). Mirrors the same is_owner bit
-- onto invitations, so accepting a pending invite can't reintroduce
-- role = "admin" into company_memberships after this migration runs.
--
-- Pre-flight (run before the UPDATEs below): confirm no live rows have
-- role = 'user' — no code path writes it, but if any exist they need a
-- manual decision (most likely: they belong in `clients`, not here) rather
-- than silently collapsing into 'staff'.
--   SELECT id, company_id, user_id FROM company_memberships WHERE role = 'user';

ALTER TABLE company_memberships ADD COLUMN IF NOT EXISTS is_owner boolean NOT NULL DEFAULT false;
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS is_owner boolean NOT NULL DEFAULT false;

UPDATE company_memberships SET is_owner = true WHERE role = 'admin';
UPDATE company_memberships SET role = 'staff';

UPDATE invitations SET is_owner = true WHERE role = 'admin' AND accepted_at IS NULL;
UPDATE invitations SET role = 'staff' WHERE accepted_at IS NULL;

-- Mirrors user_company_role()/user_company_id()/user_client_id(), which
-- resolveUser() already calls via RPC (see lib/auth/resolveUser.ts) — those
-- functions live only in this database, not in the repo, so this one
-- follows their existing SECURITY DEFINER shape rather than a new pattern.
CREATE OR REPLACE FUNCTION public.user_is_owner()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_owner FROM company_memberships
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;
