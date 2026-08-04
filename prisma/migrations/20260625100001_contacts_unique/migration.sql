-- Re-add the (user_id, account_id, email) unique constraint on contacts.
--
-- This constraint existed in v1 but was omitted when the v2 schema was
-- applied directly from SQL. The Prisma schema already declares it via
-- @@unique([user_id, account_id, email], map: "uq_contacts_user_account_email").
-- Applying this migration brings the live database into sync with the schema.

ALTER TABLE contacts
  ADD CONSTRAINT uq_contacts_user_account_email UNIQUE (user_id, account_id, email);
