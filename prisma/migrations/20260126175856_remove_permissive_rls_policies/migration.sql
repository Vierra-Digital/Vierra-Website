-- Remove permissive RLS policies
-- Since the application uses Prisma with service role credentials (which bypass RLS),
-- these permissive policies are not needed and trigger Supabase linter warnings.
-- RLS remains enabled on all tables, which satisfies the security requirement.

DROP POLICY IF EXISTS "Service role full access to users" ON "public"."users";
DROP POLICY IF EXISTS "Service role full access to clients" ON "public"."clients";
DROP POLICY IF EXISTS "Service role full access to onboarding_sessions" ON "public"."onboarding_sessions";
DROP POLICY IF EXISTS "Service role full access to onboarding_platform_tokens" ON "public"."onboarding_platform_tokens";
DROP POLICY IF EXISTS "Service role full access to user_tokens" ON "public"."user_tokens";
DROP POLICY IF EXISTS "Service role full access to authors" ON "public"."authors";
DROP POLICY IF EXISTS "Service role full access to blog_posts" ON "public"."blog_posts";
DROP POLICY IF EXISTS "Service role full access to marketing_tracker" ON "public"."marketing_tracker";
DROP POLICY IF EXISTS "Service role full access to marketing_yearly_summary" ON "public"."marketing_yearly_summary";
DROP POLICY IF EXISTS "Service role full access to signed_documents" ON "public"."signed_documents";
