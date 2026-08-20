import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

// mailboxAccess talks to prisma, the Gmail token store, and the Gmail sendAs API — mock all
// three so we can exercise alias resolution (getGmailAliasAccounts, resolveMailboxOwner's alias
// fallback) with no network/DB.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    platformToken: { findMany: vi.fn(), findFirst: vi.fn() },
    mailboxGrant: { findMany: vi.fn(), findFirst: vi.fn() },
    emailProviderAccount: { findFirst: vi.fn() },
  },
}));
vi.mock("@/lib/gmail/tokens", () => ({ getValidGmailAccessToken: vi.fn() }));
vi.mock("@/lib/gmail/gmailApi", () => ({ fetchSendAsAliases: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { getValidGmailAccessToken } from "@/lib/gmail/tokens";
import { fetchSendAsAliases } from "@/lib/gmail/gmailApi";
import { getGmailAliasAccounts, resolveMailboxOwner } from "@/lib/email/mailboxAccess";

const platformFindMany = prisma.platformToken.findMany as unknown as Mock;
const platformFindFirst = prisma.platformToken.findFirst as unknown as Mock;
const grantFindMany = prisma.mailboxGrant.findMany as unknown as Mock;
const grantFindFirst = prisma.mailboxGrant.findFirst as unknown as Mock;
const providerFindFirst = prisma.emailProviderAccount.findFirst as unknown as Mock;
const tokenFor = getValidGmailAccessToken as unknown as Mock;
const aliasesFor = fetchSendAsAliases as unknown as Mock;

// getGmailAliasAccounts caches per userId for a few minutes (see mailboxAccess.ts), and that
// cache is module-internal (not resettable between tests) — so every test that isn't
// specifically exercising the cache uses its own fresh, never-before-seen userId to avoid
// bleeding results into later tests.
let userCounter = 0;
const freshUser = () => `user-${userCounter++}`;

/** Wires a single owned Gmail connection (no grants) with a canned token + alias list. */
function setupOneAccount(email: string, aliases: Array<{ email: string; isPrimary: boolean }>) {
  platformFindMany.mockResolvedValue([{ platform: `gmail:${email}` }]);
  grantFindMany.mockResolvedValue([]);
  tokenFor.mockResolvedValue({ ok: true, accessToken: `tok-${email}` });
  aliasesFor.mockImplementation((token: string) =>
    Promise.resolve(token === `tok-${email}` ? aliases.map((a) => ({ ...a, displayName: "" })) : [])
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getGmailAliasAccounts", () => {
  it("resolves a forwarded domain address to the account whose sendAs list verifies it", async () => {
    const user = freshUser();
    setupOneAccount("alex@vierradev.com", [
      { email: "alex@vierradev.com", isPrimary: true },
      { email: "business@alexshick.com", isPrimary: false },
    ]);
    const aliases = await getGmailAliasAccounts(user);
    expect(aliases).toEqual([{ email: "business@alexshick.com", ownerUserId: user, viaAccountEmail: "alex@vierradev.com" }]);
  });

  it("never returns the primary address as an alias of itself", async () => {
    setupOneAccount("alex@vierradev.com", [{ email: "alex@vierradev.com", isPrimary: true }]);
    expect(await getGmailAliasAccounts(freshUser())).toEqual([]);
  });

  it("skips an alias email that's already a directly-connected account", async () => {
    platformFindMany.mockResolvedValue([{ platform: "gmail:alex@vierradev.com" }, { platform: "gmail:business@alexshick.com" }]);
    grantFindMany.mockResolvedValue([]);
    tokenFor.mockResolvedValue({ ok: true, accessToken: "tok" });
    aliasesFor.mockResolvedValue([
      { email: "alex@vierradev.com", isPrimary: true, displayName: "" },
      { email: "business@alexshick.com", isPrimary: false, displayName: "" },
    ]);
    expect(await getGmailAliasAccounts(freshUser())).toEqual([]);
  });

  it("on a collision, the earliest-connected account wins regardless of which Gmail call resolves first", async () => {
    const user = freshUser();
    // platformToken.findMany is ordered by created_at asc, so index 0 is "earliest connected".
    platformFindMany.mockResolvedValue([{ platform: "gmail:first@vierradev.com" }, { platform: "gmail:second@vierradev.com" }]);
    grantFindMany.mockResolvedValue([]);
    tokenFor.mockImplementation((_userId: string, email: string) => Promise.resolve({ ok: true, accessToken: `tok-${email}` }));
    // The SECOND account's Gmail call resolves first, to prove the tiebreak isn't just "first to finish".
    aliasesFor.mockImplementation((token: string) => {
      if (token === "tok-second@vierradev.com") {
        return Promise.resolve([{ email: "shared@domain.com", isPrimary: false, displayName: "" }]);
      }
      return new Promise((resolve) =>
        setTimeout(() => resolve([{ email: "shared@domain.com", isPrimary: false, displayName: "" }]), 5)
      );
    });
    const aliases = await getGmailAliasAccounts(user);
    expect(aliases).toEqual([{ email: "shared@domain.com", ownerUserId: user, viaAccountEmail: "first@vierradev.com" }]);
  });

  it("is cached across calls within the TTL — a second call doesn't re-hit Gmail", async () => {
    const user = freshUser();
    setupOneAccount("alex@vierradev.com", [{ email: "business@alexshick.com", isPrimary: false }]);
    await getGmailAliasAccounts(user);
    await getGmailAliasAccounts(user);
    expect(aliasesFor).toHaveBeenCalledTimes(1);
  });

  it("omits an account's aliases (without throwing) when its token is invalid", async () => {
    platformFindMany.mockResolvedValue([{ platform: "gmail:alex@vierradev.com" }]);
    grantFindMany.mockResolvedValue([]);
    tokenFor.mockResolvedValue({ ok: false, reason: "refresh_failed", message: "bad token" });
    await expect(getGmailAliasAccounts(freshUser())).resolves.toEqual([]);
    expect(aliasesFor).not.toHaveBeenCalled();
  });
});

describe("resolveMailboxOwner — alias fallback", () => {
  it("resolves an alias address to its owning account's ownerUserId and real tokenEmail", async () => {
    const user = freshUser();
    platformFindFirst.mockResolvedValue(null); // not directly owned
    providerFindFirst.mockResolvedValue(null); // not an SMTP account
    grantFindFirst.mockResolvedValue(null); // not granted
    setupOneAccount("alex@vierradev.com", [{ email: "business@alexshick.com", isPrimary: false }]);

    const access = await resolveMailboxOwner(user, "business@alexshick.com");
    expect(access).toEqual({ ownerUserId: user, canSend: true, tokenEmail: "alex@vierradev.com" });
  });

  it("returns null (fail-closed) when the address is neither owned, granted, nor a known alias", async () => {
    platformFindFirst.mockResolvedValue(null);
    providerFindFirst.mockResolvedValue(null);
    grantFindFirst.mockResolvedValue(null);
    platformFindMany.mockResolvedValue([]);
    grantFindMany.mockResolvedValue([]);

    expect(await resolveMailboxOwner(freshUser(), "nobody@nowhere.com")).toBeNull();
  });
});
