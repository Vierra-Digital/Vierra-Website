import { withAuth } from "@/lib/api/withAuth";
import { artemisGenerate } from "@/lib/ai/artemis";
import { asStr } from "@/lib/api/parsing";

export default withAuth(
  async (req, res) => {
    const intent = asStr(req.body?.intent).trim();
    const tone = asStr(req.body?.tone).trim() || "professional and friendly";
    if (!intent) {
      res.status(400).json({ message: "Describe what the email should say." });
      return;
    }
    const result = await artemisGenerate({
      system:
        "You are Artemis, an email-drafting assistant for the Vierra team. Write a clear, well-structured email body from the user's intent. Match the requested tone. Return ONLY the email body text — no subject line, no preamble, no markdown code fences.",
      messages: [{ role: "user", content: `Tone: ${tone}\n\nWrite an email that: ${intent}` }],
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
