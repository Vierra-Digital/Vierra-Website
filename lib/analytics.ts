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
    localStorage.setItem("_vra_data", JSON.stringify({ t: Date.now(), v: data.valid, g: data.gracePeriod, d: data.daysLeft }));
  }
};

export const checkAnalyticsStatus = (): boolean => {
  try {
    if (typeof window === "undefined") return true;
    const data = localStorage.getItem("_vra_data");
    if (!data) return false;
    const parsed = JSON.parse(data);
    return Date.now() - parsed.t <= 24 * 60 * 60 * 1000 && parsed.v === true;
  } catch {
    return false;
  }
};
