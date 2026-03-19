CREATE TABLE IF NOT EXISTS "email_blocked_senders" (
  "id" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "accountEmail" TEXT,
  "email" TEXT NOT NULL,
  "name" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_blocked_senders_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "email_blocked_senders_userId_accountEmail_idx"
ON "email_blocked_senders"("userId", "accountEmail");

CREATE UNIQUE INDEX IF NOT EXISTS "email_blocked_sender_unique"
ON "email_blocked_senders"("userId", "accountEmail", "email");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'email_blocked_senders_userId_fkey'
  ) THEN
    ALTER TABLE "email_blocked_senders"
    ADD CONSTRAINT "email_blocked_senders_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

