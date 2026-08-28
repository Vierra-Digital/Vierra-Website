-- Eight enum types left behind by the pre-v2 schema. Nothing uses them: the current schema stores
-- these values as text, so no column is typed by any of them.
--
-- Verified before applying, per type: zero columns with that udt_name, zero rows in pg_depend
-- referencing it (excluding its own array type and enum labels), and zero functions taking or
-- returning it.
--
-- Deliberately NOT `CASCADE`: if some dependency was missed, the drop should fail loudly rather
-- than quietly delete whatever depends on it. IF EXISTS so the file is safe to re-run.

DROP TYPE IF EXISTS "ContactSource";
DROP TYPE IF EXISTS "EmailRecipientType";
DROP TYPE IF EXISTS "EmailTrackingEventType";
DROP TYPE IF EXISTS "OnboardingStatus";
DROP TYPE IF EXISTS "Outreach";
DROP TYPE IF EXISTS "Platform";
DROP TYPE IF EXISTS "ProjectBoard";
DROP TYPE IF EXISTS "ProjectTaskStatus";
