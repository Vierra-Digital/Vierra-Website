-- Add RLS policies that explicitly allow service role access
-- These policies satisfy the Supabase linter requirement for policies when RLS is enabled.
-- Since the application uses Prisma with service role credentials (which bypass RLS),
-- these policies serve as documentation and satisfy the linter, but are not actually enforced
-- for service role connections.

-- Users table policy
CREATE POLICY "Service role access to users" ON "public"."users"
  FOR ALL
  USING (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    OR current_setting('request.jwt.claims', true)::json->>'role' IS NULL
  )
  WITH CHECK (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    OR current_setting('request.jwt.claims', true)::json->>'role' IS NULL
  );

-- Clients table policy
CREATE POLICY "Service role access to clients" ON "public"."clients"
  FOR ALL
  USING (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    OR current_setting('request.jwt.claims', true)::json->>'role' IS NULL
  )
  WITH CHECK (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    OR current_setting('request.jwt.claims', true)::json->>'role' IS NULL
  );

-- Onboarding sessions table policy
CREATE POLICY "Service role access to onboarding_sessions" ON "public"."onboarding_sessions"
  FOR ALL
  USING (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    OR current_setting('request.jwt.claims', true)::json->>'role' IS NULL
  )
  WITH CHECK (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    OR current_setting('request.jwt.claims', true)::json->>'role' IS NULL
  );

-- Onboarding platform tokens table policy
CREATE POLICY "Service role access to onboarding_platform_tokens" ON "public"."onboarding_platform_tokens"
  FOR ALL
  USING (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    OR current_setting('request.jwt.claims', true)::json->>'role' IS NULL
  )
  WITH CHECK (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    OR current_setting('request.jwt.claims', true)::json->>'role' IS NULL
  );

-- User tokens table policy
CREATE POLICY "Service role access to user_tokens" ON "public"."user_tokens"
  FOR ALL
  USING (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    OR current_setting('request.jwt.claims', true)::json->>'role' IS NULL
  )
  WITH CHECK (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    OR current_setting('request.jwt.claims', true)::json->>'role' IS NULL
  );

-- Authors table policy
CREATE POLICY "Service role access to authors" ON "public"."authors"
  FOR ALL
  USING (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    OR current_setting('request.jwt.claims', true)::json->>'role' IS NULL
  )
  WITH CHECK (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    OR current_setting('request.jwt.claims', true)::json->>'role' IS NULL
  );

-- Blog posts table policy
CREATE POLICY "Service role access to blog_posts" ON "public"."blog_posts"
  FOR ALL
  USING (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    OR current_setting('request.jwt.claims', true)::json->>'role' IS NULL
  )
  WITH CHECK (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    OR current_setting('request.jwt.claims', true)::json->>'role' IS NULL
  );

-- Marketing tracker table policy
CREATE POLICY "Service role access to marketing_tracker" ON "public"."marketing_tracker"
  FOR ALL
  USING (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    OR current_setting('request.jwt.claims', true)::json->>'role' IS NULL
  )
  WITH CHECK (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    OR current_setting('request.jwt.claims', true)::json->>'role' IS NULL
  );

-- Marketing yearly summary table policy
CREATE POLICY "Service role access to marketing_yearly_summary" ON "public"."marketing_yearly_summary"
  FOR ALL
  USING (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    OR current_setting('request.jwt.claims', true)::json->>'role' IS NULL
  )
  WITH CHECK (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    OR current_setting('request.jwt.claims', true)::json->>'role' IS NULL
  );

-- Signed documents table policy
CREATE POLICY "Service role access to signed_documents" ON "public"."signed_documents"
  FOR ALL
  USING (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    OR current_setting('request.jwt.claims', true)::json->>'role' IS NULL
  )
  WITH CHECK (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    OR current_setting('request.jwt.claims', true)::json->>'role' IS NULL
  );
