import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { asStr } from "@/lib/api/parsing";

/** Get / set the caller's Artemis AI preferences (server-persisted so the auto-draft cron can read them). */
export default withAuth(
  async (req, res, session) => {
    const userId = session.user.id;

    if (req.method === "GET") {
      const pref = await prisma.emailAiPreference.findUnique({ where: { user_id: userId } });
      res.status(200).json({
        autonomy: pref?.autonomy || "suggest",
        tone: pref?.tone || "professional and friendly",
      });
      return;
    }

    const autonomyRaw = asStr(req.body?.autonomy);
    const autonomy = ["off", "suggest", "autodraft"].includes(autonomyRaw) ? autonomyRaw : "suggest";
    const tone = asStr(req.body?.tone).trim().slice(0, 200) || "professional and friendly";
    await prisma.emailAiPreference.upsert({
      where: { user_id: userId },
      create: { user_id: userId, autonomy, tone },
      update: { autonomy, tone, updated_at: new Date() },
    });
    res.status(200).json({ ok: true, autonomy, tone });
  },
  { methods: ["GET", "POST"] }
);
