import { withAuth } from "@/lib/api/withAuth";
import { artemisGenerate } from "@/lib/ai/artemis";
import { asStr } from "@/lib/api/parsing";

export default withAuth(
  async (req, res) => {
    const thread = asStr(req.body?.thread).trim();
    const intent = asStr(req.body?.intent).trim();
    const tone = asStr(req.body?.tone).trim() || "professional and friendly";
    if (!thread) {
      res.status(400).json({ message: "Missing thread context." });
      return;
    }
    const guidance = intent ? `The reply should: ${intent}` : "Write an appropriate reply.";
    const result = await artemisGenerate({
      system:
        "You are Artemis, an email-reply assistant for the Vierra team. Read the email thread and draft a reply on behalf of the user. Match the requested tone, be concise, and address the sender's points. Return ONLY the reply body text — no subject, no preamble, no quoted original, no markdown fences.",
      messages: [{ role: "user", content: `Tone: ${tone}\n${guidance}\n\n--- Thread ---\n${thread}` }],
      maxTokens: 900,
    });
    if (!result.ok) {
      res.status(502).json({ message: result.error });
      return;
    }
    res.status(200).json({ text: result.text });
  },
  { methods: ["POST"] }
);
