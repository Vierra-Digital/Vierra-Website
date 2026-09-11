import { beforeEach, describe, expect, it, vi } from "vitest";

const resolveTxt = vi.hoisted(() => vi.fn());
vi.mock("dns", () => ({ promises: { resolveTxt } }));

import { checkSpf, checkDkim, checkDmarc } from "@/lib/email/domainAuthChecks";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("checkSpf", () => {
  it("fails when no SPF record is published", async () => {
    resolveTxt.mockResolvedValue([]);
    expect((await checkSpf("example.com")).status).toBe("fail");
  });

  it("fails on multiple SPF records — RFC 7208 permerror", async () => {
    resolveTxt.mockResolvedValue([["v=spf1 include:_spf.google.com ~all"], ["v=spf1 -all"]]);
    expect((await checkSpf("example.com")).status).toBe("fail");
  });

  it("warns on a soft-fail (~all) policy", async () => {
    resolveTxt.mockResolvedValue([["v=spf1 include:_spf.google.com ~all"]]);
    expect((await checkSpf("example.com")).status).toBe("warn");
  });

  it("passes a hard-fail (-all) policy", async () => {
    resolveTxt.mockResolvedValue([["v=spf1 include:_spf.google.com -all"]]);
    expect((await checkSpf("example.com")).status).toBe("pass");
  });
});

describe("checkDkim", () => {
  it("fails when no selector resolves", async () => {
    resolveTxt.mockRejectedValue(new Error("ENOTFOUND"));
    const result = await checkDkim("example.com");
    expect(result.status).toBe("fail");
  });

  it("passes when a common selector has a DKIM key", async () => {
    resolveTxt.mockImplementation(async (name: string) =>
      name.startsWith("google._domainkey.") ? [["v=DKIM1; k=rsa; p=abc"]] : Promise.reject(new Error("ENOTFOUND"))
    );
    const result = await checkDkim("example.com");
    expect(result.status).toBe("pass");
    expect(result.detail).toContain("google");
  });
});

describe("checkDmarc", () => {
  it("fails when no DMARC record exists", async () => {
    resolveTxt.mockResolvedValue([]);
    const result = await checkDmarc("example.com");
    expect(result.status).toBe("fail");
    expect(result.policy).toBeNull();
  });

  it("warns on monitor-only (p=none)", async () => {
    resolveTxt.mockResolvedValue([["v=DMARC1; p=none; rua=mailto:x@example.com"]]);
    const result = await checkDmarc("example.com");
    expect(result.status).toBe("warn");
    expect(result.policy).toBe("none");
  });

  it("passes an enforced policy (quarantine/reject)", async () => {
    resolveTxt.mockResolvedValue([["v=DMARC1; p=reject"]]);
    const result = await checkDmarc("example.com");
    expect(result.status).toBe("pass");
    expect(result.policy).toBe("reject");
  });
});
