import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

const ARTEMIS_PROSPECT_URL = (process.env.ARTEMIS_PROSPECT_URL || "").replace(/\/+$/, "");
const ARTEMIS_PROSPECT_KEY = process.env.ARTEMIS_PROSPECT_KEY || "";

/**
 * Artemis pushes here when a /prospect job finishes. Session-less (Artemis has no Vierra login),
 * and the URL is a fixed, guessable path, so nothing in the POST body is trusted as data — a
 * forged request could otherwise inject fake companies straight into a client's results.
 *
 * Poll-back instead: the only thing taken from the body is job_id, used to re-fetch the real
 * result from Artemis with our own server-side key. A forged POST can at worst make us re-fetch a
 * job that was already going to finish anyway — it can never get fake data stored.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Method not allowed." });
  }
  if (!ARTEMIS_PROSPECT_URL || !ARTEMIS_PROSPECT_KEY) {
    return res.status(503).json({ message: "Artemis prospect is not configured." });
  }

  const jobId = typeof req.body?.job_id === "string" ? req.body.job_id : null;
  if (!jobId) return res.status(400).json({ message: "job_id is required." });

  const job = await prisma.artemisProspectJob.findUnique({ where: { id: jobId } });
  if (!job) return res.status(404).json({ message: "Unknown job_id." });

  try {
    const artemisRes = await fetch(`${ARTEMIS_PROSPECT_URL}/prospect/${encodeURIComponent(jobId)}`, {
      headers: { "x-api-key": ARTEMIS_PROSPECT_KEY },
    });
    if (!artemisRes.ok) {
      console.error("prospect/callback: re-fetch failed", jobId, artemisRes.status);
      return res.status(502).json({ message: "Could not confirm job with Artemis." });
    }
    const payload = (await artemisRes.json()) as { status?: string; error?: string };
    const status = (["queued", "running", "done", "failed", "interrupted"] as const).includes(
      payload.status as "queued" | "running" | "done" | "failed" | "interrupted"
    )
      ? (payload.status as "queued" | "running" | "done" | "failed" | "interrupted")
      : "running";

    // Cache the whole response, not just `results` -- stage/stats/queries are meaningful even for
    // a non-terminal status, and the polling route serves straight from this cache once terminal.
    await prisma.artemisProspectJob.update({
      where: { id: jobId },
      data: {
        status,
        result: payload as object,
        error: status === "failed" ? payload.error || "Unknown error" : null,
        updated_at: new Date(),
      },
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("prospect/callback: failed to reconcile job", jobId, error);
    return res.status(502).json({ message: "Failed to reconcile job." });
  }
}
