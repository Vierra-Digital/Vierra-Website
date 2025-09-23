-- CreateTable
CREATE TABLE "public"."marketing_tracker" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "meetingsSet" INTEGER NOT NULL DEFAULT 0,
    "clientsClosed" INTEGER NOT NULL DEFAULT 0,
    "revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "attemptsToMeetingsPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "meetingsToClientsPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketing_tracker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."marketing_yearly_summary" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "totalAttempt" INTEGER NOT NULL DEFAULT 0,
    "totalMeetingsSet" INTEGER NOT NULL DEFAULT 0,
    "totalClientsLosed" INTEGER NOT NULL DEFAULT 0,
    "totalRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "attemptsToMeetingsPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "meetingsToClientsPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketing_yearly_summary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."signed_documents" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "signedPdfData" BYTEA NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signerEmail" TEXT,
    "sessionToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "signed_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."staff" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "time_zone" TEXT NOT NULL,
    "mentor" TEXT,
    "email" TEXT NOT NULL,
    "company_email" TEXT NOT NULL,
    "strikes" TEXT NOT NULL,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "marketing_tracker_userId_year_idx" ON "public"."marketing_tracker"("userId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "marketing_tracker_userId_year_month_key" ON "public"."marketing_tracker"("userId", "year", "month");

-- CreateIndex
CREATE INDEX "marketing_yearly_summary_userId_year_idx" ON "public"."marketing_yearly_summary"("userId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "marketing_yearly_summary_userId_year_key" ON "public"."marketing_yearly_summary"("userId", "year");

-- CreateIndex
CREATE INDEX "signed_documents_sessionToken_idx" ON "public"."signed_documents"("sessionToken");

-- CreateIndex
CREATE INDEX "signed_documents_userId_idx" ON "public"."signed_documents"("userId");

-- AddForeignKey
ALTER TABLE "public"."marketing_tracker" ADD CONSTRAINT "marketing_tracker_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."marketing_yearly_summary" ADD CONSTRAINT "marketing_yearly_summary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."signed_documents" ADD CONSTRAINT "signed_documents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
