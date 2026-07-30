import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { resolveAccountId } from "@/lib/api/emailAccounts";
import { asStr, queryAccountEmail } from "@/lib/api/parsing";

function serializeSettings(s: {
  id: string; account_id: string | null; tracking_enabled: boolean; open_tracking_enabled: boolean;
  click_tracking_enabled: boolean; vacation_responder_enabled: boolean; vacation_subject: string | null;
  vacation_body_html: string | null; vacation_body_text: string | null; vacation_start_at: Date | null;
  vacation_end_at: Date | null; vacation_reply_frequency_hours: number; reply_notifications_enabled: boolean;
  created_at: Date; updated_at: Date;
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
    const settings = await prisma.emailAccountSetting.findUnique({
      where: { user_id_account_email: { user_id: userId, account_email: accountEmail } },
    });
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
    };
    const updated = await prisma.emailAccountSetting.upsert({
      where: { user_id_account_email: { user_id: userId, account_email: accountEmail } },
      create: { user_id: userId, account_email: accountEmail, account_id: accountId, ...settingData },
      update: settingData,
    });
    // Sync tracking flags across all of this user's mailbox settings.
    await prisma.emailAccountSetting.updateMany({
      where: { user_id: userId },
      data: {
        tracking_enabled: Boolean(req.body?.trackingEnabled),
        open_tracking_enabled: Boolean(req.body?.openTrackingEnabled ?? true),
        click_tracking_enabled: Boolean(req.body?.clickTrackingEnabled ?? true),
      },
    });
    res.status(200).json({ settings: serializeSettings(updated) });
    return;
  }
}, { methods: ["GET", "PUT"] });
