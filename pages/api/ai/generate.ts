import { withAuth } from "@/lib/api/withAuth";
import { asStr } from "@/lib/api/parsing";
import { boxGenerate } from "@/lib/ai/artemisBox";
import { resolveBrain } from "@/lib/ai/brains";
import { logArtemisRun } from "@/lib/ai/artemisRuns";
import { prisma } from "@/lib/prisma";
import { resolveTargetCompanyId } from "@/lib/api/targetCompany";

const PLATFORMS = ["linkedin", "instagram", "x", "blog", "email"] as const;

/**
 * Brand-voice content drafts from the Artemis box, grounded in the brain's knowledge base.
 *
 * The result lands in the review queue by default. Nothing here publishes or sends anything —
 * a draft has to be approved by a person first, and approval happens in the review routes.
 */
export default withAuth(
  async (req, res, session) => {
    const topic = asStr(req.body?.topic).trim().slice(0, 2000);
    const requested = asStr(req.body?.platform).trim().toLowerCase();
    const platform = (PLATFORMS as readonly string[]).includes(requested) ? requested : "linkedin";
    const brain = resolveBrain(req.body?.brain);
    // Opt out only if the caller explicitly says so; review-before-publish is the default.
    const saveToReview = req.body?.saveToReview !== false;

    if (!topic) {
      res.status(400).json({ message: "Give Artemis a topic to write about." });
      return;
    }
    const companyId = resolveTargetCompanyId(session, req);
    if (!companyId) {
      res.status(400).json({ message: "companyId is required" });
      return;
    }

    const startedAt = Date.now();
    const result = await boxGenerate({ topic, platform, brain });
    const latencyMs = Date.now() - startedAt;

    if (!result.ok) {
      await logArtemisRun({
        endpoint: "generate",
        companyId,
        userId: session.user.id,
        brainId: brain,
        latencyMs,
        error: result.error,
      });
      res.status(502).json({ message: result.error });
      return;
    }

    const drafts = result.data.drafts.trim();
    let reviewItemId: string | null = null;

    if (saveToReview && drafts) {
      const item = await prisma.artemisReviewItem.create({
        data: {
          company_id: companyId,
          brain_id: brain,
          kind: platform === "blog" ? "blog" : platform === "email" ? "email" : "social",
          title: topic.slice(0, 200),
          content: drafts,
          meta: { topic, platform, used_context: result.data.used_context },
        },
        select: { id: true },
      });
      reviewItemId = item.id;
    }

    await logArtemisRun({
      endpoint: "generate",
      companyId,
      userId: session.user.id,
      brainId: brain,
      latencyMs,
      reviewItemId,
    });

    res.status(200).json({
      drafts,
      usedContext: result.data.used_context,
      brain,
      platform,
      reviewItemId,
    });
  },
  { methods: ["POST"], roles: ["admin", "staff"], scope: "ai/generate" }
);
