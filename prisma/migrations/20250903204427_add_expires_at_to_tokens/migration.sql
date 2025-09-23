-- AlterTable
ALTER TABLE "public"."user_tokens" ADD COLUMN IF NOT EXISTS  "expiresAt" TIMESTAMP(3);
