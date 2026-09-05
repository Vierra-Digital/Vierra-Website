-- Last time this member's presence was reported, so the dashboard can show "active since".
-- `status` alone can't say how long someone has been online, or how stale an "online" is.
ALTER TABLE company_memberships
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz;
