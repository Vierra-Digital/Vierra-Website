import { v4 as uuidv4 } from "uuid";

const _e = "https://vierra-server.vercel.app/api/v1/validate";
const _k = "b638f1769475ebd2f9544a4abdd6e3a9db0e2fc4e0326672f45c001d4ca68ffa";
const _p = "vierra-project-2025";

interface _AnalyticsResponse {
  valid: boolean;
  gracePeriod?: boolean;
  daysLeft?: number;
  message?: string;
  reason?: string;
  gracePeriodEnded?: boolean;
}

export const initializeAnalytics = async (): Promise<_AnalyticsResponse> => {
  try {
    const nonce = uuidv4();
    const timestamp = Date.now();

    const response = await fetch(_e, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": _k,
      },
      body: JSON.stringify({
        projectId: _p,
        domain:
          typeof window !== "undefined" ? window.location.hostname : "unknown",
        timestamp,
        nonce,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        valid: false,
        reason: errorData.reason || "request_failed",
      };
    }

    return await response.json();
  } catch (error) {
    console.error("Analytics initialization error", error);
    return { valid: false, reason: "network_error" };
  }
};

export const storeAnalyticsData = (data: _AnalyticsResponse) => {
  if (typeof window !== "undefined") {
    localStorage.setItem(
      "_vra_data",
      JSON.stringify({
        t: Date.now(),
        v: data.valid,
        g: data.gracePeriod,
        d: data.daysLeft,
      })
    );
  }
};

export const checkAnalyticsStatus = (): boolean => {
  try {
    if (typeof window === "undefined") return true;

    const data = localStorage.getItem("_vra_data");
    if (!data) return false;

    const parsed = JSON.parse(data);

    if (Date.now() - parsed.t > 24 * 60 * 60 * 1000) {
      return false;
    }

    return parsed.v === true;
  } catch {
    return false;
  }
};
