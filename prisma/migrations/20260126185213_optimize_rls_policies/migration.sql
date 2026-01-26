-- Optimize RLS policies to prevent re-evaluation of current_setting() for each row
-- Wrap current_setting() calls in subqueries so they're evaluated once per query
-- This fixes the "Auth RLS Initialization Plan" performance warnings

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

-- Recreate policies with optimized subquery pattern
-- Using (select current_setting(...)) ensures the function is evaluated once per query, not per row
-- Extract the role once in a subquery to avoid multiple evaluations

-- Users table policy
CREATE POLICY "Service role access to users" ON "public"."users"
  FOR ALL
  USING (
    (SELECT current_setting('request.jwt.claims', true)::json->>'role') = 'service_role'
     OR (SELECT current_setting('request.jwt.claims', true)::json->>'role') IS NULL
  )
  WITH CHECK (
    (SELECT current_setting('request.jwt.claims', true)::json->>'role') = 'service_role'
     OR (SELECT current_setting('request.jwt.claims', true)::json->>'role') IS NULL
  );

-- Clients table policy
CREATE POLICY "Service role access to clients" ON "public"."clients"
  FOR ALL
  USING (
    (SELECT current_setting('request.jwt.claims', true)::json->>'role') = 'service_role'
     OR (SELECT current_setting('request.jwt.claims', true)::json->>'role') IS NULL
  )
  WITH CHECK (
    (SELECT current_setting('request.jwt.claims', true)::json->>'role') = 'service_role'
     OR (SELECT current_setting('request.jwt.claims', true)::json->>'role') IS NULL
  );

-- Onboarding sessions table policy
CREATE POLICY "Service role access to onboarding_sessions" ON "public"."onboarding_sessions"
  FOR ALL
  USING (
    (SELECT current_setting('request.jwt.claims', true)::json->>'role') = 'service_role'
     OR (SELECT current_setting('request.jwt.claims', true)::json->>'role') IS NULL
  )
  WITH CHECK (
    (SELECT current_setting('request.jwt.claims', true)::json->>'role') = 'service_role'
     OR (SELECT current_setting('request.jwt.claims', true)::json->>'role') IS NULL
  );

-- Onboarding platform tokens table policy
CREATE POLICY "Service role access to onboarding_platform_tokens" ON "public"."onboarding_platform_tokens"
  FOR ALL
  USING (
    (SELECT current_setting('request.jwt.claims', true)::json->>'role') = 'service_role'
     OR (SELECT current_setting('request.jwt.claims', true)::json->>'role') IS NULL
  )
  WITH CHECK (
    (SELECT current_setting('request.jwt.claims', true)::json->>'role') = 'service_role'
     OR (SELECT current_setting('request.jwt.claims', true)::json->>'role') IS NULL
  );

-- User tokens table policy
CREATE POLICY "Service role access to user_tokens" ON "public"."user_tokens"
  FOR ALL
  USING (
    (SELECT current_setting('request.jwt.claims', true)::json->>'role') = 'service_role'
     OR (SELECT current_setting('request.jwt.claims', true)::json->>'role') IS NULL
  )
  WITH CHECK (
    (SELECT current_setting('request.jwt.claims', true)::json->>'role') = 'service_role'
     OR (SELECT current_setting('request.jwt.claims', true)::json->>'role') IS NULL
  );

-- Authors table policy
CREATE POLICY "Service role access to authors" ON "public"."authors"
  FOR ALL
  USING (
    (SELECT current_setting('request.jwt.claims', true)::json->>'role') = 'service_role'
     OR (SELECT current_setting('request.jwt.claims', true)::json->>'role') IS NULL
  )
  WITH CHECK (
    (SELECT current_setting('request.jwt.claims', true)::json->>'role') = 'service_role'
     OR (SELECT current_setting('request.jwt.claims', true)::json->>'role') IS NULL
  );

-- Blog posts table policy
CREATE POLICY "Service role access to blog_posts" ON "public"."blog_posts"
  FOR ALL
  USING (
    (SELECT current_setting('request.jwt.claims', true)::json->>'role') = 'service_role'
     OR (SELECT current_setting('request.jwt.claims', true)::json->>'role') IS NULL
  )
  WITH CHECK (
    (SELECT current_setting('request.jwt.claims', true)::json->>'role') = 'service_role'
     OR (SELECT current_setting('request.jwt.claims', true)::json->>'role') IS NULL
  );

-- Marketing tracker table policy
CREATE POLICY "Service role access to marketing_tracker" ON "public"."marketing_tracker"
  FOR ALL
  USING (
    (SELECT current_setting('request.jwt.claims', true)::json->>'role') = 'service_role'
     OR (SELECT current_setting('request.jwt.claims', true)::json->>'role') IS NULL
  )
  WITH CHECK (
    (SELECT current_setting('request.jwt.claims', true)::json->>'role') = 'service_role'
     OR (SELECT current_setting('request.jwt.claims', true)::json->>'role') IS NULL
  );

-- Marketing yearly summary table policy
CREATE POLICY "Service role access to marketing_yearly_summary" ON "public"."marketing_yearly_summary"
  FOR ALL
  USING (
    (SELECT current_setting('request.jwt.claims', true)::json->>'role') = 'service_role'
     OR (SELECT current_setting('request.jwt.claims', true)::json->>'role') IS NULL
  )
  WITH CHECK (
    (SELECT current_setting('request.jwt.claims', true)::json->>'role') = 'service_role'
     OR (SELECT current_setting('request.jwt.claims', true)::json->>'role') IS NULL
  );

-- Signed documents table policy
CREATE POLICY "Service role access to signed_documents" ON "public"."signed_documents"
  FOR ALL
  USING (
    (SELECT current_setting('request.jwt.claims', true)::json->>'role') = 'service_role'
     OR (SELECT current_setting('request.jwt.claims', true)::json->>'role') IS NULL
  )
  WITH CHECK (
    (SELECT current_setting('request.jwt.claims', true)::json->>'role') = 'service_role'
     OR (SELECT current_setting('request.jwt.claims', true)::json->>'role') IS NULL
  );
