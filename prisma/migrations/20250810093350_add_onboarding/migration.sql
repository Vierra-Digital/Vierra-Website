-- CreateEnum
CREATE TYPE "public"."Platform" AS ENUM ('facebook', 'googleads', 'linkedin');

-- CreateTable
CREATE TABLE "public"."onboarding_platform_tokens" (
    "id" SERIAL NOT NULL,
    "sessionId" TEXT NOT NULL,
    "platform" "public"."Platform" NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_platform_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "onboarding_platform_tokens_sessionId_platform_idx" ON "public"."onboarding_platform_tokens"("sessionId", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_platform_tokens_sessionId_platform_key" ON "public"."onboarding_platform_tokens"("sessionId", "platform");

-- AddForeignKey
ALTER TABLE "public"."onboarding_platform_tokens" ADD CONSTRAINT "onboarding_platform_tokens_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."onboarding_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
