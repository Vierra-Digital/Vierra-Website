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
import { getGmailAliasAccounts, resolveMailboxOwner, selectFetchAccounts } from "@/lib/email/mailboxAccess";

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

describe("selectFetchAccounts", () => {
  const accessible = [
    { email: "real@company.com", ownerUserId: "u1" },
    { email: "other@company.com", ownerUserId: "u1" },
  ];
  const aliases = [
    { email: "hello@brand.com", ownerUserId: "u1", viaAccountEmail: "real@company.com" },
  ];

  it("reads every accessible account when nothing is selected", () => {
    expect(selectFetchAccounts(accessible, aliases, []).map((r) => r.email)).toEqual([
      "real@company.com",
      "other@company.com",
    ]);
  });

  it("skips an alias whose parent is also being read", () => {
    // The bug: the panel selects every connected account and aliases are listed among them, so the
    // alias's mail came back twice — once from the parent's unscoped fetch, once from the alias's
    // scoped one — showing messages twice and inflating the sidebar badge.
    const rows = selectFetchAccounts(accessible, aliases, ["real@company.com", "hello@brand.com"]);
    expect(rows.map((r) => r.email)).toEqual(["real@company.com"]);
  });

  it("reads an alias on its own when its parent is not selected", () => {
    const rows = selectFetchAccounts(accessible, aliases, ["hello@brand.com"]);
    expect(rows).toEqual([
      { email: "hello@brand.com", ownerUserId: "u1", aliasOfEmail: "real@company.com" },
    ]);
  });

  it("ignores a selected address that is neither accessible nor an alias", () => {
    expect(selectFetchAccounts(accessible, aliases, ["stranger@elsewhere.com"])).toEqual([]);
  });

  it("prefers the real account when an address is both accessible and listed as an alias", () => {
    const overlapping = [
      { email: "other@company.com", ownerUserId: "u1", viaAccountEmail: "real@company.com" },
    ];
    const rows = selectFetchAccounts(accessible, overlapping, ["other@company.com"]);
    expect(rows).toEqual([{ email: "other@company.com", ownerUserId: "u1" }]);
  });

  it("matches selections case-insensitively", () => {
    const rows = selectFetchAccounts(accessible, aliases, ["Real@Company.com"]);
    expect(rows.map((r) => r.email)).toEqual(["real@company.com"]);
  });
});
