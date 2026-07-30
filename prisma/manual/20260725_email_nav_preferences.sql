-- Per-user email panel nav layout: which left-nav modules (mailboxes/tools) are hidden.
-- Synced server-side so the layout follows the user across devices. Endpoints degrade
-- gracefully (Prisma P2021) until this is applied, so nothing breaks pre-migration.

CREATE TABLE IF NOT EXISTS email_nav_preferences (
  user_id        uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  hidden_modules text[] NOT NULL DEFAULT '{}',
  updated_at     timestamptz NOT NULL DEFAULT now()
);
