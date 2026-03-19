-- Add deletion protection flag for generated/managed files
ALTER TABLE "stored_files"
ADD COLUMN IF NOT EXISTS "isDeletionProtected" BOOLEAN NOT NULL DEFAULT false;

-- Store custom domain mail providers (SMTP + POP/IMAP settings)
CREATE TABLE IF NOT EXISTS "email_provider_accounts" (
  "id" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "accountEmail" TEXT NOT NULL,
  "providerLabel" TEXT,
  "smtpHost" TEXT NOT NULL,
  "smtpPort" INTEGER NOT NULL,
  "smtpSecure" BOOLEAN NOT NULL DEFAULT true,
  "smtpUsername" TEXT NOT NULL,
  "smtpPasswordEnc" TEXT NOT NULL,
  "imapHost" TEXT,
  "imapPort" INTEGER,
  "imapSecure" BOOLEAN,
  "popHost" TEXT,
  "popPort" INTEGER,
  "popSecure" BOOLEAN,
  "isDefaultSender" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "email_provider_accounts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "email_provider_accounts_userId_idx" ON "email_provider_accounts"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "email_provider_accounts_userId_accountEmail_key"
ON "email_provider_accounts"("userId", "accountEmail");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'email_provider_accounts_userId_fkey'
  ) THEN
    ALTER TABLE "email_provider_accounts"
    ADD CONSTRAINT "email_provider_accounts_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

