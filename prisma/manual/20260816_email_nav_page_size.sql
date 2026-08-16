-- Rows per mailbox page, editable from the email panel's settings page.
-- 0 / NULL means "use the built-in default" (PAGE_SIZE in components/email/constants.tsx).
ALTER TABLE email_nav_preferences
  ADD COLUMN IF NOT EXISTS page_size integer;
