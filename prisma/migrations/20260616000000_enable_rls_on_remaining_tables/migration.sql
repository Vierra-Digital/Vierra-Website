-- Enable Row Level Security on the 21 tables added after the original RLS migration (20260126*).
-- Matches the current convention from fix_rls_policy_optimization: RLS enabled + a service-role
-- policy using the COALESCE single-eval pattern. Idempotent (safe to re-run).
-- Prisma connects with a BYPASSRLS role, so the running application is unaffected.

ALTER TABLE "public"."blog_images" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role access to blog_images" ON "public"."blog_images";
CREATE POLICY "Service role access to blog_images" ON "public"."blog_images"
  FOR ALL
  USING (
    COALESCE((SELECT current_setting('request.jwt.claims', true)::json->>'role'), 'service_role') = 'service_role'
  )
  WITH CHECK (
    COALESCE((SELECT current_setting('request.jwt.claims', true)::json->>'role'), 'service_role') = 'service_role'
  );

ALTER TABLE "public"."contact_field_visibility_settings" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role access to contact_field_visibility_settings" ON "public"."contact_field_visibility_settings";
CREATE POLICY "Service role access to contact_field_visibility_settings" ON "public"."contact_field_visibility_settings"
  FOR ALL
  USING (
    COALESCE((SELECT current_setting('request.jwt.claims', true)::json->>'role'), 'service_role') = 'service_role'
  )
  WITH CHECK (
    COALESCE((SELECT current_setting('request.jwt.claims', true)::json->>'role'), 'service_role') = 'service_role'
  );

ALTER TABLE "public"."contact_tag_assignments" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role access to contact_tag_assignments" ON "public"."contact_tag_assignments";
CREATE POLICY "Service role access to contact_tag_assignments" ON "public"."contact_tag_assignments"
  FOR ALL
  USING (
    COALESCE((SELECT current_setting('request.jwt.claims', true)::json->>'role'), 'service_role') = 'service_role'
  )
  WITH CHECK (
    COALESCE((SELECT current_setting('request.jwt.claims', true)::json->>'role'), 'service_role') = 'service_role'
  );

ALTER TABLE "public"."contact_tags" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role access to contact_tags" ON "public"."contact_tags";
CREATE POLICY "Service role access to contact_tags" ON "public"."contact_tags"
  FOR ALL
  USING (
    COALESCE((SELECT current_setting('request.jwt.claims', true)::json->>'role'), 'service_role') = 'service_role'
  )
  WITH CHECK (
    COALESCE((SELECT current_setting('request.jwt.claims', true)::json->>'role'), 'service_role') = 'service_role'
  );

ALTER TABLE "public"."contacts" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role access to contacts" ON "public"."contacts";
CREATE POLICY "Service role access to contacts" ON "public"."contacts"
  FOR ALL
  USING (
    COALESCE((SELECT current_setting('request.jwt.claims', true)::json->>'role'), 'service_role') = 'service_role'
  )
  WITH CHECK (
    COALESCE((SELECT current_setting('request.jwt.claims', true)::json->>'role'), 'service_role') = 'service_role'
  );

ALTER TABLE "public"."email_account_settings" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role access to email_account_settings" ON "public"."email_account_settings";
CREATE POLICY "Service role access to email_account_settings" ON "public"."email_account_settings"
  FOR ALL
  USING (
    COALESCE((SELECT current_setting('request.jwt.claims', true)::json->>'role'), 'service_role') = 'service_role'
  )
  WITH CHECK (
    COALESCE((SELECT current_setting('request.jwt.claims', true)::json->>'role'), 'service_role') = 'service_role'
  );

ALTER TABLE "public"."email_blocked_senders" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role access to email_blocked_senders" ON "public"."email_blocked_senders";
CREATE POLICY "Service role access to email_blocked_senders" ON "public"."email_blocked_senders"
  FOR ALL
  USING (
    COALESCE((SELECT current_setting('request.jwt.claims', true)::json->>'role'), 'service_role') = 'service_role'
  )
  WITH CHECK (
    COALESCE((SELECT current_setting('request.jwt.claims', true)::json->>'role'), 'service_role') = 'service_role'
  );

ALTER TABLE "public"."email_compose_drafts" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role access to email_compose_drafts" ON "public"."email_compose_drafts";
CREATE POLICY "Service role access to email_compose_drafts" ON "public"."email_compose_drafts"
  FOR ALL
  USING (
    COALESCE((SELECT current_setting('request.jwt.claims', true)::json->>'role'), 'service_role') = 'service_role'
  )
  WITH CHECK (
    COALESCE((SELECT current_setting('request.jwt.claims', true)::json->>'role'), 'service_role') = 'service_role'
  );

ALTER TABLE "public"."email_outbound_messages" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role access to email_outbound_messages" ON "public"."email_outbound_messages";
CREATE POLICY "Service role access to email_outbound_messages" ON "public"."email_outbound_messages"
  FOR ALL
  USING (
    COALESCE((SELECT current_setting('request.jwt.claims', true)::json->>'role'), 'service_role') = 'service_role'
  )
  WITH CHECK (
    COALESCE((SELECT current_setting('request.jwt.claims', true)::json->>'role'), 'service_role') = 'service_role'
  );

ALTER TABLE "public"."email_outbound_recipients" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role access to email_outbound_recipients" ON "public"."email_outbound_recipients";
CREATE POLICY "Service role access to email_outbound_recipients" ON "public"."email_outbound_recipients"
  FOR ALL
  USING (
    COALESCE((SELECT current_setting('request.jwt.claims', true)::json->>'role'), 'service_role') = 'service_role'
  )
  WITH CHECK (
    COALESCE((SELECT current_setting('request.jwt.claims', true)::json->>'role'), 'service_role') = 'service_role'
  );

ALTER TABLE "public"."email_provider_accounts" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role access to email_provider_accounts" ON "public"."email_provider_accounts";
CREATE POLICY "Service role access to email_provider_accounts" ON "public"."email_provider_accounts"
  FOR ALL
  USING (
    COALESCE((SELECT current_setting('request.jwt.claims', true)::json->>'role'), 'service_role') = 'service_role'
  )
  WITH CHECK (
    COALESCE((SELECT current_setting('request.jwt.claims', true)::json->>'role'), 'service_role') = 'service_role'
  );

ALTER TABLE "public"."email_signatures" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role access to email_signatures" ON "public"."email_signatures";
CREATE POLICY "Service role access to email_signatures" ON "public"."email_signatures"
  FOR ALL
  USING (
    COALESCE((SELECT current_setting('request.jwt.claims', true)::json->>'role'), 'service_role') = 'service_role'
  )
  WITH CHECK (
    COALESCE((SELECT current_setting('request.jwt.claims', true)::json->>'role'), 'service_role') = 'service_role'
  );

ALTER TABLE "public"."email_templates" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role access to email_templates" ON "public"."email_templates";
CREATE POLICY "Service role access to email_templates" ON "public"."email_templates"
  FOR ALL
  USING (
    COALESCE((SELECT current_setting('request.jwt.claims', true)::json->>'role'), 'service_role') = 'service_role'
  )
  WITH CHECK (
    COALESCE((SELECT current_setting('request.jwt.claims', true)::json->>'role'), 'service_role') = 'service_role'
  );

ALTER TABLE "public"."email_tracking_events" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role access to email_tracking_events" ON "public"."email_tracking_events";
CREATE POLICY "Service role access to email_tracking_events" ON "public"."email_tracking_events"
  FOR ALL
  USING (
    COALESCE((SELECT current_setting('request.jwt.claims', true)::json->>'role'), 'service_role') = 'service_role'
  )
  WITH CHECK (
    COALESCE((SELECT current_setting('request.jwt.claims', true)::json->>'role'), 'service_role') = 'service_role'
  );

ALTER TABLE "public"."email_tracking_links" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role access to email_tracking_links" ON "public"."email_tracking_links";
CREATE POLICY "Service role access to email_tracking_links" ON "public"."email_tracking_links"
  FOR ALL
  USING (
    COALESCE((SELECT current_setting('request.jwt.claims', true)::json->>'role'), 'service_role') = 'service_role'
  )
  WITH CHECK (
    COALESCE((SELECT current_setting('request.jwt.claims', true)::json->>'role'), 'service_role') = 'service_role'
  );

ALTER TABLE "public"."email_vacation_response_logs" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role access to email_vacation_response_logs" ON "public"."email_vacation_response_logs";
CREATE POLICY "Service role access to email_vacation_response_logs" ON "public"."email_vacation_response_logs"
  FOR ALL
  USING (
    COALESCE((SELECT current_setting('request.jwt.claims', true)::json->>'role'), 'service_role') = 'service_role'
  )
  WITH CHECK (
    COALESCE((SELECT current_setting('request.jwt.claims', true)::json->>'role'), 'service_role') = 'service_role'
  );

ALTER TABLE "public"."gmail_contact_sync_states" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role access to gmail_contact_sync_states" ON "public"."gmail_contact_sync_states";
CREATE POLICY "Service role access to gmail_contact_sync_states" ON "public"."gmail_contact_sync_states"
  FOR ALL
  USING (
    COALESCE((SELECT current_setting('request.jwt.claims', true)::json->>'role'), 'service_role') = 'service_role'
  )
  WITH CHECK (
    COALESCE((SELECT current_setting('request.jwt.claims', true)::json->>'role'), 'service_role') = 'service_role'
  );

ALTER TABLE "public"."password_reset_tokens" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role access to password_reset_tokens" ON "public"."password_reset_tokens";
CREATE POLICY "Service role access to password_reset_tokens" ON "public"."password_reset_tokens"
  FOR ALL
  USING (
    COALESCE((SELECT current_setting('request.jwt.claims', true)::json->>'role'), 'service_role') = 'service_role'
  )
  WITH CHECK (
    COALESCE((SELECT current_setting('request.jwt.claims', true)::json->>'role'), 'service_role') = 'service_role'
  );

ALTER TABLE "public"."project_tasks" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role access to project_tasks" ON "public"."project_tasks";
CREATE POLICY "Service role access to project_tasks" ON "public"."project_tasks"
  FOR ALL
  USING (
    COALESCE((SELECT current_setting('request.jwt.claims', true)::json->>'role'), 'service_role') = 'service_role'
  )
  WITH CHECK (
    COALESCE((SELECT current_setting('request.jwt.claims', true)::json->>'role'), 'service_role') = 'service_role'
  );

ALTER TABLE "public"."signing_sessions" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role access to signing_sessions" ON "public"."signing_sessions";
CREATE POLICY "Service role access to signing_sessions" ON "public"."signing_sessions"
  FOR ALL
  USING (
    COALESCE((SELECT current_setting('request.jwt.claims', true)::json->>'role'), 'service_role') = 'service_role'
  )
  WITH CHECK (
    COALESCE((SELECT current_setting('request.jwt.claims', true)::json->>'role'), 'service_role') = 'service_role'
  );

ALTER TABLE "public"."stored_files" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role access to stored_files" ON "public"."stored_files";
CREATE POLICY "Service role access to stored_files" ON "public"."stored_files"
  FOR ALL
  USING (
    COALESCE((SELECT current_setting('request.jwt.claims', true)::json->>'role'), 'service_role') = 'service_role'
  )
  WITH CHECK (
    COALESCE((SELECT current_setting('request.jwt.claims', true)::json->>'role'), 'service_role') = 'service_role'
  );

