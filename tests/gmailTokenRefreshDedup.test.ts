import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// getValidGmailAccessToken pulls in Prisma (persisting a refreshed token) and the OAuth client
// credential resolver — both mocked so this stays a pure, import-safe unit test per the vitest
// config's convention, while still exercising the real dedup/refresh logic end to end.
const updateMock = vi.fn().mockResolvedValue({});
vi.mock("@/lib/prisma", () => ({
  prisma: { platformToken: { update: (...args: unknown[]) => updateMock(...args) } },
}));
vi.mock("@/lib/api/oauth", () => ({
  resolveGoogleWebClientCredentials: () => ({ clientId: "test-client", clientSecret: "test-secret" }),
}));

// A valid 32-byte key so lib/crypto's encrypt/decrypt run for real rather than needing their own mock.
process.env.ENCRYPTION_SECRET = Buffer.alloc(32, 7).toString("base64");

import { encrypt } from "@/lib/crypto";
import { getValidGmailAccessToken } from "@/lib/gmail/tokens";

describe("getValidGmailAccessToken concurrent-refresh dedup", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let callIndex: number;

  beforeEach(() => {
    callIndex = 0;
    // A page load's real concurrent callers (status/messages/counts) each await a network round
    // trip before touching Prisma — resolving on a macrotask tick reproduces the interleaving that
    // makes them race in production, instead of resolving synchronously and hiding the bug.
    fetchMock = vi.fn(async () => {
      const index = ++callIndex;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return {
        ok: true,
        json: async () => ({ access_token: `access-${index}`, expires_in: 3600 }),
      } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);
    updateMock.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const expiredRow = () => ({
    access_token: encrypt("stale-access-token"),
    refresh_token: encrypt("refresh-token-value"),
    // Already past expiry, so every call below takes the refresh branch (isExpiringSoon).
    expires_at: new Date(Date.now() - 60_000),
  });

  it("shares one refresh across concurrent non-forced callers for the same account", async () => {
    const preloadedRow = expiredRow();
    // Mirrors a page load: status.ts, messages.ts, and counts.ts all call this for the same
    // account within the same tick, each with their own (independently-fetched, but equivalent)
    // preloaded row.
    const results = await Promise.all([
      getValidGmailAccessToken("user-1", "a@example.com", { preloadedRow }),
      getValidGmailAccessToken("user-1", "a@example.com", { preloadedRow }),
      getValidGmailAccessToken("user-1", "A@Example.com", { preloadedRow }), // case-insensitive same account
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(updateMock).toHaveBeenCalledTimes(1);
    for (const result of results) {
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.accessToken).toBe("access-1");
    }
  });

  it("does not dedup across different accounts or users", async () => {
    const preloadedRow = expiredRow();
    await Promise.all([
      getValidGmailAccessToken("user-1", "a@example.com", { preloadedRow }),
      getValidGmailAccessToken("user-1", "b@example.com", { preloadedRow }),
      getValidGmailAccessToken("user-2", "a@example.com", { preloadedRow }),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("a forceRefresh caller never reuses another caller's non-forced result", async () => {
    const preloadedRow = expiredRow();

    const nonForced = getValidGmailAccessToken("user-1", "a@example.com", { preloadedRow });
    // Started while the non-forced call above is still in flight (both fire in the same tick,
    // before fetchMock's 5ms delay resolves) — the exact status.ts-retry-after-401 scenario this
    // fix targets: a caller that already knows the shared/cached result was stale must not be
    // handed that same in-flight result.
    const forced = getValidGmailAccessToken("user-1", "a@example.com", { preloadedRow, forceRefresh: true });

    const [nonForcedResult, forcedResult] = await Promise.all([nonForced, forced]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(nonForcedResult.ok).toBe(true);
    expect(forcedResult.ok).toBe(true);
    if (nonForcedResult.ok && forcedResult.ok) {
      expect(nonForcedResult.accessToken).not.toBe(forcedResult.accessToken);
    }
  });

  it("does not share a failed refresh's rejection across concurrent callers", async () => {
    fetchMock.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { ok: false, status: 400, text: async () => "invalid_grant" } as Response;
    });
    const preloadedRow = expiredRow();

    const results = await Promise.all([
      getValidGmailAccessToken("user-1", "a@example.com", { preloadedRow }),
      getValidGmailAccessToken("user-1", "a@example.com", { preloadedRow }),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    for (const result of results) {
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe("refresh_failed");
    }

    // The map must not be left permanently occupied by a resolved (even failed) promise — a later,
    // unrelated call for the same account has to trigger its own refresh, not hang or replay the
    // old failure forever.
    fetchMock.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { ok: true, json: async () => ({ access_token: "access-recovered", expires_in: 3600 }) } as Response;
    });
    const recovered = await getValidGmailAccessToken("user-1", "a@example.com", { preloadedRow });
    expect(recovered.ok).toBe(true);
  });
});
