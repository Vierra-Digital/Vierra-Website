-- Add DNC / soft-delete columns used by the campaigns contact management.
ALTER TABLE "public"."email_blocked_senders" ADD COLUMN IF NOT EXISTS "is_dnc" boolean NOT NULL DEFAULT false;
ALTER TABLE "public"."email_blocked_senders" ADD COLUMN IF NOT EXISTS "soft_deleted_at" timestamptz(6);
ALTER TABLE "public"."email_blocked_senders" ADD COLUMN IF NOT EXISTS "scheduled_hard_delete_at" timestamptz(6);
ALTER TABLE "public"."email_blocked_senders" ADD COLUMN IF NOT EXISTS "reason" text;
