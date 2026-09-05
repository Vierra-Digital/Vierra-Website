/**
 * One-time (idempotent) provisioning for the audit-call modal's BookingLink.
 *
 * The panel's own create-link flow (pages/api/booking/links/index.ts) always assigns a random
 * slug (slugify(title)-<random>), and there's no rename endpoint — so the audit-call modal
 * (components/audit/AuditBookingStep.tsx, slug fixed at "audit-call" via
 * NEXT_PUBLIC_AUDIT_CALL_BOOKING_SLUG) needs its BookingLink row pinned to that exact slug by
 * hand. This talks to Postgres directly with `pg` (bypassing the create endpoint's HTTP/API
 * validation) since the generated Prisma client is TypeScript-only and this repo has no
 * ts-node/tsx to run it as a plain script.
 *
 * Requires: an existing user (identified by ACCOUNT_EMAIL's Gmail OAuth connection, i.e. a row
 * in platform_tokens with platform = 'gmail:<ACCOUNT_EMAIL>') to attach the link to.
 *
 * Usage: node scripts/provision-audit-call-link.js
 *
 * Switching the host account later (e.g. prototype on michael@vierradev.com now, move to
 * alex@vierradev.com once that's connected): change ACCOUNT_EMAIL below and re-run. If the new
 * account belongs to a different user than the existing "audit-call" row, that's a deliberate
 * ownership change, not an accident — pass ALLOW_REASSIGN=1 to confirm it:
 *   ALLOW_REASSIGN=1 node scripts/provision-audit-call-link.js
 */
require("dotenv").config();
const { Client } = require("pg");

const SLUG = "audit-call";
const ACCOUNT_EMAIL = "alex@vierradev.com";
const ALLOW_REASSIGN = process.env.ALLOW_REASSIGN === "1";
const TITLE = "Audit Call";
const PROVIDER = "google_meet";
const DURATION_MINUTES = 15;
const BUFFER_MINUTES = 10;
// Alex's intended hours are 9am-5pm Eastern every day — a Google Calendar Appointment Schedule
// used as a visual reference for slot spacing showed times in Pacific display and different
// per-day hours, but that was the page's own viewer-timezone/config quirk, not the actual target.
const TIMEZONE = "America/New_York";
// Every day (0=Sun...6=Sat), 9:00am-5:00pm host-local — see lib/booking/slots.ts's Availability type.
const AVAILABILITY = { days: [0, 1, 2, 3, 4, 5, 6], startMinutes: 9 * 60, endMinutes: 17 * 60 };

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required (see .env.local).");

  const client = new Client({ connectionString });
  await client.connect();
  try {
    const tokenRes = await client.query(
      `select user_id, meta from platform_tokens where platform = $1 limit 1`,
      [`gmail:${ACCOUNT_EMAIL}`]
    );
    if (tokenRes.rowCount === 0) {
      throw new Error(
        `No Gmail OAuth connection found for ${ACCOUNT_EMAIL} (platform_tokens). ` +
          `Connect it in the panel (Settings) first, then re-run this script.`
      );
    }
    const { user_id: userId, meta } = tokenRes.rows[0];
    const isWorkspace = Boolean(meta?.isWorkspaceOrOrgAccount);
    if (!isWorkspace) {
      console.warn(
        `[warn] ${ACCOUNT_EMAIL} isn't flagged as a Workspace/org Gmail account — meeting ` +
          `attendance won't be tracked automatically for this link (same tradeoff the panel's ` +
          `create-link flow warns about for personal Gmail accounts).`
      );
    }

    const existing = await client.query(`select id, user_id from booking_links where slug = $1`, [SLUG]);
    if (existing.rowCount > 0) {
      const row = existing.rows[0];
      if (row.user_id !== userId && !ALLOW_REASSIGN) {
        throw new Error(
          `A booking_links row already has slug "${SLUG}" but belongs to a different user ` +
            `(${row.user_id}, not ${userId} for ${ACCOUNT_EMAIL}). If this is a deliberate ` +
            `account switch, re-run with ALLOW_REASSIGN=1.`
        );
      }
      await client.query(
        `update booking_links
         set user_id = $2, account_email = $3, title = $4, provider = $5, duration_minutes = $6,
             buffer_minutes = $7, timezone = $8, availability = $9, active = true, updated_at = now()
         where id = $1`,
        [row.id, userId, ACCOUNT_EMAIL, TITLE, PROVIDER, DURATION_MINUTES, BUFFER_MINUTES, TIMEZONE, JSON.stringify(AVAILABILITY)]
      );
      console.log(`Updated existing booking_links row ${row.id} (slug "${SLUG}", now ${ACCOUNT_EMAIL}).`);
      return;
    }

    const inserted = await client.query(
      `insert into booking_links
         (user_id, account_email, slug, title, provider, duration_minutes, buffer_minutes, timezone, availability, active)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
       returning id`,
      [userId, ACCOUNT_EMAIL, SLUG, TITLE, PROVIDER, DURATION_MINUTES, BUFFER_MINUTES, TIMEZONE, JSON.stringify(AVAILABILITY)]
    );
    console.log(`Created booking_links row ${inserted.rows[0].id} (slug "${SLUG}").`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
