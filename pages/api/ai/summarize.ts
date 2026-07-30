import { withAuth } from "@/lib/api/withAuth";
import { artemisGenerate } from "@/lib/ai/artemis";
import { asStr } from "@/lib/api/parsing";

export default withAuth(
  async (req, res) => {
    const thread = asStr(req.body?.thread).trim();
    if (!thread) {
      res.status(400).json({ message: "Missing thread content." });
      return;
    }
    const result = await artemisGenerate({
      system:
        "You are Artemis. Summarize the email thread in 3–5 tight bullet points capturing key context, decisions, and any action items or questions awaiting a reply. Return only the bullets.",
      messages: [{ role: "user", content: thread }],
      maxTokens: 500,
    });
    if (!result.ok) {
      res.status(502).json({ message: result.error });
      return;
    }
    res.status(200).json({ text: result.text });
  },
  { methods: ["POST"] }
);
