import type { NextApiRequest, NextApiResponse } from "next";
import { v4 as uuidv4 } from "uuid";

const API_URL = "https://vierra-server.vercel.app/api/v1/validate";
const API_KEY = "b638f1769475ebd2f9544a4abdd6e3a9db0e2fc4e0326672f45c001d4ca68ffa";
const PROJECT_ID = "Vierra-2025";

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
    return res.status(405).json({ valid: false, reason: "method_not_allowed" });
  }

  try {
    const { domain } = req.body;
    
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json", 
        "x-api-key": API_KEY 
      },
      body: JSON.stringify({
        projectId: PROJECT_ID,
        domain: domain || "unknown",
        timestamp: Date.now(),
        nonce: uuidv4(),
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return res.status(response.status).json({ 
        valid: false, 
        reason: errorData.reason || "request_failed" 
      });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch {
    return res.status(500).json({ 
      valid: false, 
      reason: "network_error" 
    });
  }
}

