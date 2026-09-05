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
    const response = await fetch("/api/analytics/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        domain: typeof window !== "undefined" ? window.location.hostname : "unknown",
      }),
    });
    return response.ok ? await response.json() : { valid: false, reason: (await response.json()).reason || "request_failed" };
  } catch {
    return { valid: false, reason: "network_error" };
  }
};

export const storeAnalyticsData = (data: _AnalyticsResponse) => {
  if (typeof window !== "undefined") {
    localStorage.setItem("_vra_data", JSON.stringify({ t: Date.now(), v: data.valid, g: data.gracePeriod, d: data.daysLeft, r: data.reason }));
  }
};

/**
 * Has this browser already asked recently? Freshness alone is the answer, deliberately — the old
 * version also required `v === true`, so any answer other than "valid" meant re-asking on every
 * single page load, forever. Since the stored value is only ever written after a completed request,
 * a fresh entry means the question has been answered and does not need asking again today.
 */
export const checkAnalyticsStatus = (): boolean => {
  try {
    if (typeof window === "undefined") return true;
    const data = localStorage.getItem("_vra_data");
    if (!data) return false;
    const parsed = JSON.parse(data);
    return typeof parsed?.t === "number" && Date.now() - parsed.t <= 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
};
