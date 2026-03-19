-- Create enums
CREATE TYPE "EmailRecipientType" AS ENUM ('TO', 'CC', 'BCC');
CREATE TYPE "EmailTrackingEventType" AS ENUM ('OPEN', 'CLICK');

-- Create settings tables
CREATE TABLE "email_account_settings" (
  "id" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "accountEmail" TEXT NOT NULL,
  "trackingEnabled" BOOLEAN NOT NULL DEFAULT false,
  "openTrackingEnabled" BOOLEAN NOT NULL DEFAULT true,
  "clickTrackingEnabled" BOOLEAN NOT NULL DEFAULT true,
  "vacationResponderEnabled" BOOLEAN NOT NULL DEFAULT false,
  "vacationSubject" TEXT,
  "vacationBodyHtml" TEXT,
  "vacationBodyText" TEXT,
  "vacationStartAt" TIMESTAMP(3),
  "vacationEndAt" TIMESTAMP(3),
  "vacationReplyFrequencyHours" INTEGER NOT NULL DEFAULT 24,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "email_account_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "email_signatures" (
  "id" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "accountEmail" TEXT,
  "name" TEXT NOT NULL,
  "signatureHtml" TEXT,
  "signatureText" TEXT,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "email_signatures_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "email_templates" (
  "id" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "accountEmail" TEXT,
  "name" TEXT NOT NULL,
  "subject" TEXT,
  "bodyHtml" TEXT,
  "bodyText" TEXT,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "email_outbound_messages" (
  "id" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "accountEmail" TEXT NOT NULL,
  "gmailMessageId" TEXT,
  "threadId" TEXT,
  "subject" TEXT,
  "bodyHtml" TEXT,
  "bodyText" TEXT,
  "trackingEnabled" BOOLEAN NOT NULL DEFAULT false,
  "openToken" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_outbound_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "email_outbound_recipients" (
  "id" TEXT NOT NULL,
  "outboundMessageId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "recipientType" "EmailRecipientType" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_outbound_recipients_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "email_tracking_links" (
  "id" TEXT NOT NULL,
  "outboundMessageId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "originalUrl" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_tracking_links_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "email_tracking_events" (
  "id" TEXT NOT NULL,
  "outboundMessageId" TEXT NOT NULL,
  "trackingLinkId" TEXT,
  "eventType" "EmailTrackingEventType" NOT NULL,
  "recipientEmail" TEXT,
  "ipHash" TEXT,
  "userAgent" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_tracking_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "email_vacation_response_logs" (
  "id" TEXT NOT NULL,
  "emailAccountSettingId" TEXT NOT NULL,
  "senderEmail" TEXT NOT NULL,
  "lastSentAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "email_vacation_response_logs_pkey" PRIMARY KEY ("id")
);

-- Indexes and unique constraints
CREATE UNIQUE INDEX "email_account_settings_userId_accountEmail_key" ON "email_account_settings"("userId", "accountEmail");
CREATE INDEX "email_account_settings_userId_idx" ON "email_account_settings"("userId");

CREATE INDEX "email_signatures_userId_accountEmail_idx" ON "email_signatures"("userId", "accountEmail");
CREATE INDEX "email_templates_userId_accountEmail_idx" ON "email_templates"("userId", "accountEmail");

CREATE UNIQUE INDEX "email_outbound_messages_openToken_key" ON "email_outbound_messages"("openToken");
CREATE INDEX "email_outbound_messages_userId_accountEmail_createdAt_idx" ON "email_outbound_messages"("userId", "accountEmail", "createdAt");
CREATE INDEX "email_outbound_messages_gmailMessageId_idx" ON "email_outbound_messages"("gmailMessageId");

CREATE INDEX "email_outbound_recipients_outboundMessageId_email_idx" ON "email_outbound_recipients"("outboundMessageId", "email");

CREATE UNIQUE INDEX "email_tracking_links_token_key" ON "email_tracking_links"("token");
CREATE INDEX "email_tracking_links_outboundMessageId_idx" ON "email_tracking_links"("outboundMessageId");

CREATE INDEX "email_tracking_events_outboundMessageId_occurredAt_idx" ON "email_tracking_events"("outboundMessageId", "occurredAt");
CREATE INDEX "email_tracking_events_eventType_occurredAt_idx" ON "email_tracking_events"("eventType", "occurredAt");

CREATE UNIQUE INDEX "email_vacation_response_logs_emailAccountSettingId_senderEmail_key" ON "email_vacation_response_logs"("emailAccountSettingId", "senderEmail");

-- Foreign keys
ALTER TABLE "email_account_settings" ADD CONSTRAINT "email_account_settings_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "email_signatures" ADD CONSTRAINT "email_signatures_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "email_outbound_messages" ADD CONSTRAINT "email_outbound_messages_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "email_outbound_recipients" ADD CONSTRAINT "email_outbound_recipients_outboundMessageId_fkey"
  FOREIGN KEY ("outboundMessageId") REFERENCES "email_outbound_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "email_tracking_links" ADD CONSTRAINT "email_tracking_links_outboundMessageId_fkey"
  FOREIGN KEY ("outboundMessageId") REFERENCES "email_outbound_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "email_tracking_events" ADD CONSTRAINT "email_tracking_events_outboundMessageId_fkey"
  FOREIGN KEY ("outboundMessageId") REFERENCES "email_outbound_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "email_tracking_events" ADD CONSTRAINT "email_tracking_events_trackingLinkId_fkey"
  FOREIGN KEY ("trackingLinkId") REFERENCES "email_tracking_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "email_vacation_response_logs" ADD CONSTRAINT "email_vacation_response_logs_emailAccountSettingId_fkey"
  FOREIGN KEY ("emailAccountSettingId") REFERENCES "email_account_settings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
