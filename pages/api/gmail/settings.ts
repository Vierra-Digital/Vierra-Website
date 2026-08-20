import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { resolveAccountId } from "@/lib/api/emailAccounts";
import { asStr, queryAccountEmail } from "@/lib/api/parsing";
import { resolveMailboxOwner } from "@/lib/email/mailboxAccess";

function serializeSettings(s: {
  id: string; account_id: string | null; tracking_enabled: boolean; open_tracking_enabled: boolean;
  click_tracking_enabled: boolean; vacation_responder_enabled: boolean; vacation_subject: string | null;
  vacation_body_html: string | null; vacation_body_text: string | null; vacation_start_at: Date | null;
  vacation_end_at: Date | null; vacation_reply_frequency_hours: number; reply_notifications_enabled: boolean;
  default_read_receipt: boolean; created_at: Date; updated_at: Date;
}) {
  return {
    id: s.id,
    accountId: s.account_id,
    trackingEnabled: s.tracking_enabled,
    openTrackingEnabled: s.open_tracking_enabled,
    clickTrackingEnabled: s.click_tracking_enabled,
    vacationResponderEnabled: s.vacation_responder_enabled,
    vacationSubject: s.vacation_subject,
    vacationBodyHtml: s.vacation_body_html,
    vacationBodyText: s.vacation_body_text,
    vacationStartAt: s.vacation_start_at,
    vacationEndAt: s.vacation_end_at,
    vacationReplyFrequencyHours: s.vacation_reply_frequency_hours,
    replyNotificationsEnabled: s.reply_notifications_enabled,
    defaultReadReceipt: s.default_read_receipt,
    createdAt: s.created_at,
    updatedAt: s.updated_at,
  };
}

export default withAuth(async (req, res, session) => {
  const userId = session.user.id;
  const accountEmail = queryAccountEmail(req.query.accountEmail);
  if (!accountEmail) {
    res.status(400).json({ message: "accountEmail is required" });
    return;
  }

  const accountId = await resolveAccountId(userId, accountEmail);

  if (req.method === "GET") {
    // Keyed by (user, account_email) so this works for Gmail (OAuth) accounts too, which have
    // no provider-account row / account_id.
    //
    // These are the requesting staff member's settings. On a shared mailbox, a staff member who has
    // never configured anything inherits the owner's, which is what their sends actually use — so
    // read that rather than showing defaults the send path would not honour.
    let settings = await prisma.emailAccountSetting.findUnique({
      where: { user_id_account_email: { user_id: userId, account_email: accountEmail } },
    });
    if (!settings) {
      const access = await resolveMailboxOwner(userId, accountEmail);
      if (access && access.ownerUserId !== userId) {
        settings = await prisma.emailAccountSetting.findUnique({
          where: { user_id_account_email: { user_id: access.ownerUserId, account_email: accountEmail } },
        });
      }
    }
    res.status(200).json({
      settings: settings
        ? serializeSettings(settings)
        : {
            // Default ON to match sendEmailCore (a mailbox with no settings row is tracked by
            // default). Keeps the toggle consistent with actual send behavior.
            accountId,
            trackingEnabled: true,
            openTrackingEnabled: true,
            clickTrackingEnabled: true,
            vacationResponderEnabled: false,
            vacationSubject: "",
            vacationBodyHtml: "",
            vacationBodyText: "",
            vacationStartAt: null,
            vacationEndAt: null,
            vacationReplyFrequencyHours: 24,
            replyNotificationsEnabled: true,
            defaultReadReceipt: false,
          },
    });
    return;
  }

  if (req.method === "PUT") {
    const vacationReplyFrequencyHoursRaw = Number(req.body?.vacationReplyFrequencyHours);
    const vacationReplyFrequencyHours =
      Number.isFinite(vacationReplyFrequencyHoursRaw) && vacationReplyFrequencyHoursRaw > 0
        ? Math.floor(vacationReplyFrequencyHoursRaw)
        : 24;
    const settingData = {
      tracking_enabled: Boolean(req.body?.trackingEnabled),
      open_tracking_enabled: Boolean(req.body?.openTrackingEnabled ?? true),
      click_tracking_enabled: Boolean(req.body?.clickTrackingEnabled ?? true),
      vacation_responder_enabled: Boolean(req.body?.vacationResponderEnabled),
      vacation_subject: asStr(req.body?.vacationSubject) || null,
      vacation_body_html: asStr(req.body?.vacationBodyHtml) || null,
      vacation_body_text: asStr(req.body?.vacationBodyText) || null,
      vacation_start_at: req.body?.vacationStartAt ? new Date(req.body.vacationStartAt) : null,
      vacation_end_at: req.body?.vacationEndAt ? new Date(req.body.vacationEndAt) : null,
      vacation_reply_frequency_hours: vacationReplyFrequencyHours,
      reply_notifications_enabled: Boolean(req.body?.replyNotificationsEnabled ?? true),
      default_read_receipt: Boolean(req.body?.defaultReadReceipt),
    };
    const updated = await prisma.emailAccountSetting.upsert({
      where: { user_id_account_email: { user_id: userId, account_email: accountEmail } },
      create: { user_id: userId, account_email: accountEmail, account_id: accountId, ...settingData },
      update: settingData,
    });
    // Apply the whole set across every mailbox THIS STAFF MEMBER has, not just the tracking flags.
    //
    // Scoped by user_id, so it never reaches another staff member's rows: two people sharing a
    // mailbox keep their own tracking, read-receipt and out-of-office choices, and a send uses the
    // settings of whoever sent it (see sendEmailCore's actingUserId).
    //
    // The panel is one account with a primary inbox and brand accounts added onto it, so these are
    // the user's preferences rather than each mailbox's: previously, changing the reply-notification
    // toggle or the out-of-office on the selected mailbox left every other inbox on its old value,
    // with nothing on screen saying so. The vacation responder is included deliberately — an
    // out-of-office that only covered whichever inbox happened to be selected is a worse surprise
    // than one that covers all of them. Pass applyToSelectedOnly to opt a single mailbox out.
    if (req.body?.applyToSelectedOnly !== true) {
      await prisma.emailAccountSetting.updateMany({
        where: { user_id: userId },
        data: settingData,
      });
    }
    res.status(200).json({ settings: serializeSettings(updated) });
    return;
  }
}, { methods: ["GET", "PUT"] });
