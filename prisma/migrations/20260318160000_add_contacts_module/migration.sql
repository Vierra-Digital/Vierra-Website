CREATE TYPE "ContactSource" AS ENUM ('MANUAL', 'GMAIL', 'CSV');

CREATE TABLE "contacts" (
  "id" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "accountEmail" TEXT,
  "source" "ContactSource" NOT NULL DEFAULT 'MANUAL',
  "firstName" TEXT,
  "lastName" TEXT,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "business" TEXT,
  "website" TEXT,
  "address" TEXT,
  "gmailResourceName" TEXT,
  "gmailEtag" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contact_tags" (
  "id" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "color" TEXT NOT NULL DEFAULT '#701CC0',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contact_tags_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contact_tag_assignments" (
  "id" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "tagId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "contact_tag_assignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contact_field_visibility_settings" (
  "id" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "accountEmail" TEXT,
  "showPhone" BOOLEAN NOT NULL DEFAULT true,
  "showBusiness" BOOLEAN NOT NULL DEFAULT true,
  "showWebsite" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contact_field_visibility_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "gmail_contact_sync_states" (
  "id" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "accountEmail" TEXT NOT NULL,
  "nextSyncToken" TEXT,
  "lastSyncAt" TIMESTAMP(3),
  "lastFullSyncAt" TIMESTAMP(3),
  "lastSyncStatus" TEXT,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "gmail_contact_sync_states_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "contacts_userId_accountEmail_email_key" ON "contacts"("userId", "accountEmail", "email");
CREATE INDEX "contacts_userId_accountEmail_idx" ON "contacts"("userId", "accountEmail");
CREATE INDEX "contacts_userId_source_idx" ON "contacts"("userId", "source");

CREATE UNIQUE INDEX "contact_tags_userId_name_key" ON "contact_tags"("userId", "name");
CREATE INDEX "contact_tags_userId_idx" ON "contact_tags"("userId");

CREATE UNIQUE INDEX "contact_tag_assignments_contactId_tagId_key" ON "contact_tag_assignments"("contactId", "tagId");
CREATE INDEX "contact_tag_assignments_tagId_idx" ON "contact_tag_assignments"("tagId");

CREATE UNIQUE INDEX "contact_field_visibility_settings_userId_accountEmail_key"
ON "contact_field_visibility_settings"("userId", "accountEmail");
CREATE INDEX "contact_field_visibility_settings_userId_idx" ON "contact_field_visibility_settings"("userId");

CREATE UNIQUE INDEX "gmail_contact_sync_states_userId_accountEmail_key"
ON "gmail_contact_sync_states"("userId", "accountEmail");
CREATE INDEX "gmail_contact_sync_states_userId_idx" ON "gmail_contact_sync_states"("userId");

ALTER TABLE "contacts"
  ADD CONSTRAINT "contacts_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "contact_tags"
  ADD CONSTRAINT "contact_tags_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "contact_tag_assignments"
  ADD CONSTRAINT "contact_tag_assignments_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "contact_tag_assignments"
  ADD CONSTRAINT "contact_tag_assignments_tagId_fkey"
  FOREIGN KEY ("tagId") REFERENCES "contact_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "contact_field_visibility_settings"
  ADD CONSTRAINT "contact_field_visibility_settings_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "gmail_contact_sync_states"
  ADD CONSTRAINT "gmail_contact_sync_states_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
