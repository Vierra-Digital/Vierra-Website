import { withAuth } from "@/lib/api/withAuth";
import { artemisGenerate } from "@/lib/ai/artemis";
import { asStr } from "@/lib/api/parsing";

const MODES: Record<string, string> = {
  shorten: "Rewrite the text to be more concise while keeping the meaning and tone.",
  expand: "Expand the text with a little more detail and warmth, staying professional.",
  formal: "Rewrite the text in a more formal, professional tone.",
  casual: "Rewrite the text in a warmer, more casual tone.",
  grammar: "Fix spelling, grammar, and punctuation only; keep the wording and tone otherwise unchanged.",
};

export default withAuth(
  async (req, res) => {
    const text = asStr(req.body?.text).trim();
    const mode = asStr(req.body?.mode).trim().toLowerCase();
    const instruction = MODES[mode];
    if (!text || !instruction) {
      res.status(400).json({ message: "Provide text and a valid rewrite mode." });
      return;
    }
    const result = await artemisGenerate({
      system: `You are Artemis, an email editor. ${instruction} Return ONLY the rewritten text — no preamble, no markdown code fences.`,
      messages: [{ role: "user", content: text }],
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
