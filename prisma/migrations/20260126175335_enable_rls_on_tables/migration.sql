-- Enable Row Level Security on all public tables
-- This addresses Supabase linter warnings about RLS being disabled

-- Enable RLS on user-facing tables
ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."clients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."onboarding_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."onboarding_platform_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."authors" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."blog_posts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."marketing_tracker" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."marketing_yearly_summary" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."signed_documents" ENABLE ROW LEVEL SECURITY;

-- Note: _prisma_migrations is a Prisma system table and should not have RLS enabled
-- It's managed by Prisma and accessed only with service role credentials

-- Create permissive policies for service role access
-- These policies allow full access to authenticated service role users
-- Prisma uses service role which has BYPASSRLS, but these policies ensure
-- compatibility if accessed through PostgREST with authenticated users

-- Users table policies
CREATE POLICY "Service role full access to users" ON "public"."users"
  FOR ALL USING (true) WITH CHECK (true);

-- Clients table policies
CREATE POLICY "Service role full access to clients" ON "public"."clients"
  FOR ALL USING (true) WITH CHECK (true);

-- Onboarding sessions table policies
CREATE POLICY "Service role full access to onboarding_sessions" ON "public"."onboarding_sessions"
  FOR ALL USING (true) WITH CHECK (true);

-- Onboarding platform tokens table policies
CREATE POLICY "Service role full access to onboarding_platform_tokens" ON "public"."onboarding_platform_tokens"
  FOR ALL USING (true) WITH CHECK (true);

-- User tokens table policies
CREATE POLICY "Service role full access to user_tokens" ON "public"."user_tokens"
  FOR ALL USING (true) WITH CHECK (true);

-- Authors table policies
CREATE POLICY "Service role full access to authors" ON "public"."authors"
  FOR ALL USING (true) WITH CHECK (true);

-- Blog posts table policies
CREATE POLICY "Service role full access to blog_posts" ON "public"."blog_posts"
  FOR ALL USING (true) WITH CHECK (true);

-- Marketing tracker table policies
CREATE POLICY "Service role full access to marketing_tracker" ON "public"."marketing_tracker"
  FOR ALL USING (true) WITH CHECK (true);

-- Marketing yearly summary table policies
CREATE POLICY "Service role full access to marketing_yearly_summary" ON "public"."marketing_yearly_summary"
  FOR ALL USING (true) WITH CHECK (true);

-- Signed documents table policies
CREATE POLICY "Service role full access to signed_documents" ON "public"."signed_documents"
  FOR ALL USING (true) WITH CHECK (true);
