CREATE TABLE IF NOT EXISTS "email_compose_drafts" (
  "id" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "draftKey" TEXT NOT NULL,
  "accountEmail" TEXT,
  "toText" TEXT NOT NULL,
  "ccText" TEXT,
  "bccText" TEXT,
  "showCc" BOOLEAN NOT NULL DEFAULT false,
  "showBcc" BOOLEAN NOT NULL DEFAULT false,
  "subject" TEXT NOT NULL,
  "bodyText" TEXT NOT NULL,
  "bodyHtml" TEXT,
  "previewHtml" TEXT,
  "threadId" TEXT,
  "inReplyTo" TEXT,
  "references" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "email_compose_drafts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "email_compose_drafts_userId_draftKey_key"
ON "email_compose_drafts"("userId", "draftKey");

CREATE INDEX IF NOT EXISTS "email_compose_drafts_userId_accountEmail_idx"
ON "email_compose_drafts"("userId", "accountEmail");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'email_compose_drafts_userId_fkey'
  ) THEN
    ALTER TABLE "email_compose_drafts"
    ADD CONSTRAINT "email_compose_drafts_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

