import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchPostmasterStats, spamRateVerdict } from "@/lib/email/postmaster";

const mockFetch = vi.fn();
beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal("fetch", mockFetch);
});

const res = (status: number, body: unknown = {}) =>
  ({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) }) as unknown as Response;

describe("fetchPostmasterStats", () => {
  it("returns parsed stats for the most recent day with data", async () => {
    mockFetch.mockResolvedValue(
      res(200, {
        userReportedSpamRatio: 0.0004,
        domainReputation: "HIGH",
        spfSuccessRatio: 0.99,
        dkimSuccessRatio: 1,
        dmarcSuccessRatio: 0.98,
      })
    );
    const result = await fetchPostmasterStats("vierradev.com", "tok");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.stats).toMatchObject({
        domain: "vierradev.com",
        userReportedSpamRatio: 0.0004,
        domainReputation: "HIGH",
      });
      expect(result.stats.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("walks back past days with no data instead of giving up on the first 404", async () => {
    mockFetch.mockResolvedValueOnce(res(404)).mockResolvedValueOnce(res(200, { userReportedSpamRatio: 0.001 }));
    const result = await fetchPostmasterStats("vierradev.com", "tok");
    expect(result.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("reports no_data when every day in the lookback window is empty", async () => {
    mockFetch.mockResolvedValue(res(404));
    const result = await fetchPostmasterStats("vierradev.com", "tok", 3);
    expect(result).toMatchObject({ ok: false, reason: "no_data" });
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("distinguishes a permission problem from missing data", async () => {
    mockFetch.mockResolvedValue(res(403));
    const result = await fetchPostmasterStats("vierradev.com", "tok");
    expect(result).toMatchObject({ ok: false, reason: "no_permission" });
    if (!result.ok) expect(result.message).toMatch(/Reconnect|verified/i);
  });

  it("treats a network failure as an error rather than throwing", async () => {
    mockFetch.mockRejectedValue(new Error("offline"));
    const result = await fetchPostmasterStats("vierradev.com", "tok");
    expect(result).toMatchObject({ ok: false, reason: "error" });
  });

  it("rejects an empty domain without calling the API", async () => {
    const result = await fetchPostmasterStats("  ", "tok");
    expect(result).toMatchObject({ ok: false, reason: "error" });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("nulls out non-numeric ratios", async () => {
    mockFetch.mockResolvedValue(res(200, { userReportedSpamRatio: "n/a", domainReputation: 7 }));
    const result = await fetchPostmasterStats("x.com", "tok");
    if (result.ok) {
      expect(result.stats.userReportedSpamRatio).toBeNull();
      expect(result.stats.domainReputation).toBeNull();
    }
  });
});

describe("spamRateVerdict", () => {
  it("maps against Google's published thresholds", () => {
    expect(spamRateVerdict(0.0005).level).toBe("good"); // 0.05%
    expect(spamRateVerdict(0.002).level).toBe("warn"); //  0.20%
    expect(spamRateVerdict(0.004).level).toBe("bad"); //   0.40%
    expect(spamRateVerdict(null).level).toBe("unknown");
  });

  it("puts the boundaries on the correct side", () => {
    expect(spamRateVerdict(0.001).level).toBe("warn"); // exactly 0.10%
    expect(spamRateVerdict(0.003).level).toBe("bad"); //  exactly 0.30%
  });
});
