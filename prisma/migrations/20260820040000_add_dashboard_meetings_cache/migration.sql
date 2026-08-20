-- DB cache for the dashboard's "Upcoming Meetings" card, refreshed on a schedule instead of
-- hitting the Google Calendar API on every dashboard load. See
-- lib/dashboard/upcomingMeetings.ts and pages/api/dashboard/meetings-sync/dispatch.ts.

CREATE TABLE "dashboard_upcoming_meetings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "event_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "organizer" TEXT NOT NULL,
    "start_at" TIMESTAMPTZ(6) NOT NULL,
    "end_at" TIMESTAMPTZ(6),
    "time_zone" TEXT NOT NULL,
    "meeting_link" TEXT NOT NULL,
    "synced_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "dashboard_upcoming_meetings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "dashboard_upcoming_meetings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX "dashboard_upcoming_meetings_user_id_event_id_key" ON "dashboard_upcoming_meetings"("user_id", "event_id");
CREATE INDEX "idx_dashboard_upcoming_meetings_user_start" ON "dashboard_upcoming_meetings"("user_id", "start_at");

CREATE TABLE "dashboard_meetings_sync_status" (
    "user_id" UUID NOT NULL,
    "connected" BOOLEAN NOT NULL DEFAULT false,
    "connected_email" TEXT,
    "needs_reconnect" BOOLEAN NOT NULL DEFAULT false,
    "issue_code" TEXT NOT NULL DEFAULT 'none',
    "issue_message" TEXT,
    "synced_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "dashboard_meetings_sync_status_pkey" PRIMARY KEY ("user_id"),
    CONSTRAINT "dashboard_meetings_sync_status_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
