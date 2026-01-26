-- Fix RLS policy optimization - evaluate current_setting() only once per policy
-- Use COALESCE pattern to check both 'service_role' and NULL in a single subquery evaluation
-- This ensures current_setting() is called only once per query execution (InitPlan)

-- Drop existing policies
DROP POLICY IF EXISTS "Service role access to users" ON "public"."users";
DROP POLICY IF EXISTS "Service role access to clients" ON "public"."clients";
DROP POLICY IF EXISTS "Service role access to onboarding_sessions" ON "public"."onboarding_sessions";
DROP POLICY IF EXISTS "Service role access to onboarding_platform_tokens" ON "public"."onboarding_platform_tokens";
DROP POLICY IF EXISTS "Service role access to user_tokens" ON "public"."user_tokens";
DROP POLICY IF EXISTS "Service role access to authors" ON "public"."authors";
DROP POLICY IF EXISTS "Service role access to blog_posts" ON "public"."blog_posts";
DROP POLICY IF EXISTS "Service role access to marketing_tracker" ON "public"."marketing_tracker";
DROP POLICY IF EXISTS "Service role access to marketing_yearly_summary" ON "public"."marketing_yearly_summary";
DROP POLICY IF EXISTS "Service role access to signed_documents" ON "public"."signed_documents";

-- Recreate policies with single subquery evaluation
-- Pattern: COALESCE((SELECT current_setting(...)), 'service_role') = 'service_role'
-- This evaluates current_setting() once and handles both 'service_role' and NULL cases

-- Users table policy
CREATE POLICY "Service role access to users" ON "public"."users"
  FOR ALL
  USING (
    COALESCE((SELECT current_setting('request.jwt.claims', true)::json->>'role'), 'service_role') = 'service_role'
  )
  WITH CHECK (
    COALESCE((SELECT current_setting('request.jwt.claims', true)::json->>'role'), 'service_role') = 'service_role'
  );

-- Clients table policy
CREATE POLICY "Service role access to clients" ON "public"."clients"
  FOR ALL
  USING (
    COALESCE((SELECT current_setting('request.jwt.claims', true)::json->>'role'), 'service_role') = 'service_role'
  )
  WITH CHECK (
    COALESCE((SELECT current_setting('request.jwt.claims', true)::json->>'role'), 'service_role') = 'service_role'
  );

-- Onboarding sessions table policy
CREATE POLICY "Service role access to onboarding_sessions" ON "public"."onboarding_sessions"
  FOR ALL
  USING (
    COALESCE((SELECT current_setting('request.jwt.claims', true)::json->>'role'), 'service_role') = 'service_role'
  )
  WITH CHECK (
    COALESCE((SELECT current_setting('request.jwt.claims', true)::json->>'role'), 'service_role') = 'service_role'
  );

-- Onboarding platform tokens table policy
CREATE POLICY "Service role access to onboarding_platform_tokens" ON "public"."onboarding_platform_tokens"
  FOR ALL
  USING (
    COALESCE((SELECT current_setting('request.jwt.claims', true)::json->>'role'), 'service_role') = 'service_role'
  )
  WITH CHECK (
    COALESCE((SELECT current_setting('request.jwt.claims', true)::json->>'role'), 'service_role') = 'service_role'
  );

-- User tokens table policy
CREATE POLICY "Service role access to user_tokens" ON "public"."user_tokens"
  FOR ALL
  USING (
    COALESCE((SELECT current_setting('request.jwt.claims', true)::json->>'role'), 'service_role') = 'service_role'
  )
  WITH CHECK (
    COALESCE((SELECT current_setting('request.jwt.claims', true)::json->>'role'), 'service_role') = 'service_role'
  );

-- Authors table policy
CREATE POLICY "Service role access to authors" ON "public"."authors"
  FOR ALL
  USING (
    COALESCE((SELECT current_setting('request.jwt.claims', true)::json->>'role'), 'service_role') = 'service_role'
  )
  WITH CHECK (
    COALESCE((SELECT current_setting('request.jwt.claims', true)::json->>'role'), 'service_role') = 'service_role'
  );

-- Blog posts table policy
CREATE POLICY "Service role access to blog_posts" ON "public"."blog_posts"
  FOR ALL
  USING (
    COALESCE((SELECT current_setting('request.jwt.claims', true)::json->>'role'), 'service_role') = 'service_role'
  )
  WITH CHECK (
    COALESCE((SELECT current_setting('request.jwt.claims', true)::json->>'role'), 'service_role') = 'service_role'
  );

-- Marketing tracker table policy
CREATE POLICY "Service role access to marketing_tracker" ON "public"."marketing_tracker"
  FOR ALL
  USING (
    COALESCE((SELECT current_setting('request.jwt.claims', true)::json->>'role'), 'service_role') = 'service_role'
  )
  WITH CHECK (
    COALESCE((SELECT current_setting('request.jwt.claims', true)::json->>'role'), 'service_role') = 'service_role'
  );

-- Marketing yearly summary table policy
CREATE POLICY "Service role access to marketing_yearly_summary" ON "public"."marketing_yearly_summary"
  FOR ALL
  USING (
    COALESCE((SELECT current_setting('request.jwt.claims', true)::json->>'role'), 'service_role') = 'service_role'
  )
  WITH CHECK (
    COALESCE((SELECT current_setting('request.jwt.claims', true)::json->>'role'), 'service_role') = 'service_role'
  );

-- Signed documents table policy
CREATE POLICY "Service role access to signed_documents" ON "public"."signed_documents"
  FOR ALL
  USING (
    COALESCE((SELECT current_setting('request.jwt.claims', true)::json->>'role'), 'service_role') = 'service_role'
  )
  WITH CHECK (
    COALESCE((SELECT current_setting('request.jwt.claims', true)::json->>'role'), 'service_role') = 'service_role'
  );
