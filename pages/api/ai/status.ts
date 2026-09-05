import { withAuth } from "@/lib/api/withAuth";
import { artemisBoxConfigured, boxHealth } from "@/lib/ai/artemisBox";
import { prisma } from "@/lib/prisma";
import { resolveTargetCompanyId } from "@/lib/api/targetCompany";

/** Is the box reachable, and what has it been doing lately — the Artemis section's header. */
export default withAuth(
  async (req, res, session) => {
    if (!artemisBoxConfigured()) {
      res.status(200).json({ online: false, message: "Artemis isn't configured yet.", model: null, usage: null });
      return;
    }
    const companyId = resolveTargetCompanyId(session, req);
    if (!companyId) {
      res.status(400).json({ message: "companyId is required" });
      return;
    }

    const [health, runs] = await Promise.all([
      boxHealth(),
      prisma.artemisRun.groupBy({
        by: ["status"],
        where: {
          company_id: companyId,
          created_at: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        _count: { _all: true },
        _avg: { latency_ms: true },
      }),
    ]);

    const ok = runs.find((row) => row.status === "ok");
    const failed = runs.find((row) => row.status === "error");

    res.status(200).json({
      online: health.ok,
      message: health.ok ? null : health.error,
      model: health.ok ? health.data.model : null,
      usage: {
        windowHours: 24,
        ok: ok?._count._all ?? 0,
        errors: failed?._count._all ?? 0,
        avgLatencyMs: ok?._avg.latency_ms ? Math.round(ok._avg.latency_ms) : null,
      },
    });
  },
  { methods: ["GET"], roles: ["admin", "staff"], scope: "ai/status" }
);
