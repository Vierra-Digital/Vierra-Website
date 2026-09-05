import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { asStr } from "@/lib/api/parsing";
import { normalizeEmail, sendEmailCore } from "@/lib/gmail/sendCore";
import { buildIcsReply, type IcsPartstat } from "@/lib/email/ics";
import { fetchInviteForMessage } from "@/lib/gmail/messageParsing";

const RESPONSE_TO_PARTSTAT: Record<string, IcsPartstat> = {
  accepted: "ACCEPTED",
  declined: "DECLINED",
  tentative: "TENTATIVE",
};

const RESPONSE_LABEL: Record<string, string> = {
  accepted: "Accepted",
  declined: "Declined",
  tentative: "Tentative",
};

function getPublicBaseUrl() {
  const explicit = process.env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  return explicit.replace(/\/$/, "") || "http://localhost:3000";
}

export default withAuth(async (req, res, session) => {
  const userId = session.user.id;
  const accountEmail = normalizeEmail(asStr(req.body?.accountEmail));
  const messageId = asStr(req.body?.messageId);
  const response = asStr(req.body?.response).toLowerCase();
  const partstat = RESPONSE_TO_PARTSTAT[response];

  if (!accountEmail || !messageId) {
    res.status(400).json({ message: "accountEmail and messageId are required." });
    return;
  }
  if (!partstat) {
    res.status(400).json({ message: "response must be accepted, declined, or tentative." });
    return;
  }

  // Re-derive the invite from Gmail itself — never trust invite details (UID, SEQUENCE,
  // organizer) submitted by the client, only which button they clicked.
  const fetched = await fetchInviteForMessage(userId, accountEmail, messageId);
  if (!fetched.ok) {
    res.status(fetched.status).json({ message: fetched.message });
    return;
  }
  const { invite, effectiveUserId } = fetched;
  if (!invite.organizerEmail) {
    res.status(422).json({ message: "This invite has no organizer to reply to." });
    return;
  }

  const replyIcs = buildIcsReply({
    uid: invite.uid,
    sequence: invite.sequence,
    summary: invite.summary,
    startIso: invite.startIso,
    endIso: invite.endIso,
    organizerEmail: invite.organizerEmail,
    attendeeEmail: accountEmail,
    partstat,
  });

  const label = RESPONSE_LABEL[response];
  const sendResult = await sendEmailCore(
    effectiveUserId,
    {
      accountEmail,
      to: invite.organizerEmail,
      subject: `${label}: ${invite.summary}`,
      body: `${label} the invite "${invite.summary}".`,
      bodyHtml: `<p>${label} the invite <strong>${invite.summary}</strong>.</p>`,
      attachments: [
        {
          filename: "reply.ics",
          contentType: "text/calendar; method=REPLY",
          contentBase64: Buffer.from(replyIcs, "utf8").toString("base64"),
        },
      ],
    },
    getPublicBaseUrl(),
    userId
  );
  if (!sendResult.ok) {
    res.status(sendResult.status).json({ message: sendResult.message });
    return;
  }

  await prisma.emailMeetingResponse.upsert({
    where: {
      user_id_account_email_ics_uid: {
        user_id: effectiveUserId,
        account_email: accountEmail,
        ics_uid: invite.uid,
      },
    },
    create: {
      user_id: effectiveUserId,
      account_email: accountEmail,
      ics_uid: invite.uid,
      sequence: invite.sequence,
      response,
      organizer_email: invite.organizerEmail,
      summary: invite.summary,
      start_at: new Date(invite.startIso),
      end_at: new Date(invite.endIso),
    },
    update: {
      sequence: invite.sequence,
      response,
      organizer_email: invite.organizerEmail,
      summary: invite.summary,
      start_at: new Date(invite.startIso),
      end_at: new Date(invite.endIso),
    },
  });

  res.status(200).json({ ok: true, response });
}, { methods: ["POST"] });
