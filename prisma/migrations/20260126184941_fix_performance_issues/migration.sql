-- Fix performance issues identified by Supabase linter
-- 1. Add missing index on blog_posts.author_id foreign key
-- 2. Remove unused/redundant indexes

-- Add index on blog_posts.author_id foreign key for better join performance
CREATE INDEX IF NOT EXISTS "blog_posts_author_id_idx" ON "public"."blog_posts"("author_id");

-- Remove unused indexes (these are either redundant with unique constraints or unused)
-- Note: Unique constraints automatically create indexes, so separate indexes on the same columns are redundant

-- user_tokens: index is redundant with unique constraint on (userId, platform)
DROP INDEX IF EXISTS "public"."user_tokens_userId_platform_idx";

-- onboarding_platform_tokens: index is redundant with unique constraint on (sessionId, platform)
DROP INDEX IF EXISTS "public"."onboarding_platform_tokens_sessionId_platform_idx";

-- marketing_tracker: unused index (queries may use the unique constraint instead)
DROP INDEX IF EXISTS "public"."marketing_tracker_userId_year_idx";

-- marketing_yearly_summary: index is redundant with unique constraint on (userId, year)
DROP INDEX IF EXISTS "public"."marketing_yearly_summary_userId_year_idx";

-- signed_documents: unused index on sessionToken
DROP INDEX IF EXISTS "public"."signed_documents_sessionToken_idx";
