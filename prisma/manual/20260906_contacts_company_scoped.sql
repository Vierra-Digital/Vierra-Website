-- Contacts become client-scoped (see docs/ROLE_MODEL_REDESIGN.md's "v2" section) — today a
-- Contact is visible only to the user_id who created it, which doesn't fit "everyone at this
-- client company can see the same contacts." Adds company_id, backfills it, and switches the
-- delete-cascade semantics so removing a staff member's user account can no longer wipe out a
-- client's contact list.
--
-- PRE-FLIGHT — sanity-check the two backfill sources before running anything below:
--   SELECT count(*) FILTER (WHERE account_id IS NOT NULL) AS via_account,
--          count(*) FILTER (WHERE account_id IS NULL) AS orphaned
--   FROM contacts;

-- Wrapped in a transaction so a failure partway (e.g. the NOT NULL step, if a row still has no
-- company_id) rolls back everything instead of leaving contacts half-migrated.
BEGIN;

-- 1. Add the column, nullable for now — filled in by the backfill below, then locked NOT NULL.
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS company_id uuid;

-- 2. Backfill from account_id where possible (an EmailProviderAccount is already tied to a real
--    company — see prisma/schema.prisma's EmailProviderAccount).
UPDATE contacts c
SET company_id = epa.company_id
FROM email_provider_accounts epa
WHERE c.account_id = epa.id
  AND c.company_id IS NULL;

-- 3. Anything left (manual/CSV contacts with no account_id, so no company can be inferred) goes
--    to Vierra's own fixed company row — visible only to staff until someone manually reassigns
--    it to the right client, rather than left orphaned or guessed at.
UPDATE contacts
SET company_id = (SELECT id FROM companies WHERE slug = 'vierra')
WHERE company_id IS NULL;

ALTER TABLE contacts ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE contacts ADD CONSTRAINT contacts_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_contacts_company_id ON contacts (company_id);

-- 4. Dedup moves from (user_id, account_id, email) to (company_id, account_id, email) — two
--    people at the same client shouldn't create two rows for the same lead just because they're
--    different staff members anymore.
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS uq_contacts_user_account_email;
ALTER TABLE contacts ADD CONSTRAINT uq_contacts_company_account_email
  UNIQUE (company_id, account_id, email);

-- 5. user_id becomes "who originally added this" attribution, not the visibility/ownership
--    boundary — nullable, and ON DELETE SET NULL instead of CASCADE, so a departing staff
--    member's account being deleted no longer takes the client's contacts with it. The FK's
--    actual name isn't reliable from the repo (prisma/migrations/ is baselined pre-v2 history,
--    per CLAUDE.md — the live name may differ from what that old migration shows), so find and
--    drop it by column instead of guessing the name.
ALTER TABLE contacts ALTER COLUMN user_id DROP NOT NULL;
DO $$
DECLARE
  fk_name text;
BEGIN
  SELECT tc.constraint_name INTO fk_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
  WHERE tc.table_name = 'contacts' AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'user_id';
  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE contacts DROP CONSTRAINT %I', fk_name);
  END IF;
END $$;
ALTER TABLE contacts ADD CONSTRAINT contacts_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

COMMIT;
