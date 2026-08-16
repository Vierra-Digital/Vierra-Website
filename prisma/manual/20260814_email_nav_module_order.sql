-- Per-user ordering of the email panel's left-nav modules, alongside the existing
-- hidden-module set. Empty means "use the built-in MODULES order", so existing rows
-- keep today's layout until the user reorders something.
--
-- The nav-layout endpoint degrades gracefully (Prisma P2021 missing table / P2022
-- missing column) until this is applied, so the panel keeps rendering pre-migration.

ALTER TABLE email_nav_preferences
  ADD COLUMN IF NOT EXISTS module_order text[] NOT NULL DEFAULT '{}';
