-- CreateTable
CREATE TABLE "signing_sessions" (
    "token" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "pdfBase64" TEXT,
    "fields" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "signerEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "signing_sessions_pkey" PRIMARY KEY ("token")
);
