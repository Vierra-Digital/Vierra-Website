import type { NextApiRequest, NextApiResponse } from "next";
import { v4 as uuidv4 } from "uuid";

/**
 * Proxies the licence check for the self-hosted analytics service.
 *
 * The URL, key and project id used to be hardcoded here, which put a live API key in the repository
 * and in git history. They are env-driven now, and when any of them is unset this returns
 * `not_configured` without calling upstream — so an unconfigured deployment makes no doomed request
 * on every page load. The previously committed key should be treated as compromised and rotated.
 */
const API_URL = process.env.ANALYTICS_VALIDATE_URL || "";
const API_KEY = process.env.ANALYTICS_VALIDATE_KEY || "";
const PROJECT_ID = process.env.ANALYTICS_VALIDATE_PROJECT_ID || "";

interface AnalyticsResponse {
  valid: boolean;
  gracePeriod?: boolean;
  daysLeft?: number;
  message?: string;
  reason?: string;
  gracePeriodEnded?: boolean;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<AnalyticsResponse>) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ valid: false, reason: "method_not_allowed" });
  }

  // 200 rather than an error status: not being configured is a valid state, and the client caches
  // this answer so it stops asking.
  if (!API_URL || !API_KEY || !PROJECT_ID) {
    return res.status(200).json({ valid: false, reason: "not_configured" });
  }

  try {
    const { domain } = req.body ?? {};

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
      },
      body: JSON.stringify({
        projectId: PROJECT_ID,
        domain: typeof domain === "string" && domain ? domain : "unknown",
        timestamp: Date.now(),
        nonce: uuidv4(),
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        valid: false,
        reason: errorData.reason || "request_failed",
      });
    }

    return res.status(200).json(await response.json());
  } catch {
    return res.status(500).json({ valid: false, reason: "network_error" });
  }
}
