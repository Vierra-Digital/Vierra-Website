import type { NextApiRequest, NextApiResponse } from "next";
import { beforeEach, expect, it, vi } from "vitest";

/**
 * pages/api/email/accounts.ts GET used to always return every mailbox the user has ever
 * connected, regardless of company — fine for the panel's own account switcher and Settings, but
 * the campaign wizard's "Sender Account" picker used the same unscoped list, so it offered
 * mailboxes that would fail validation on submit (a mailbox's company_id is fixed at connection
 * time; picking one from a different company than the campaign being created answers "accountId
 * must reference one of your connected mailboxes"). This pins the new opt-in `scopeToCompany=1`
 * filter the wizard now uses, and that every other caller's unscoped behavior is unchanged.
 */

const db = vi.hoisted(() => ({ emailProviderAccount: { findMany: vi.fn() } }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/auth", () => ({ requireRole: vi.fn() }));

import { requireRole } from "@/lib/auth";
import handler from "@/pages/api/email/accounts";

async function call(query: Record<string, unknown> = {}) {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  await handler({ method: "GET", query, body: {} } as unknown as NextApiRequest, res as unknown as NextApiResponse);
  return res;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireRole).mockResolvedValue({
    kind: "member",
    companyId: "vierra-company",
    user: { id: "user-1", role: "staff", email: "staff@example.com", name: null },
  } as never);
  db.emailProviderAccount.findMany.mockResolvedValue([]);
});

it("returns every mailbox unscoped by default (the panel's own account switcher needs this)", async () => {
  await call();
  expect(db.emailProviderAccount.findMany).toHaveBeenCalledWith({
    where: { user_id: "user-1" },
    orderBy: { created_at: "desc" },
  });
});

it("scopes to the resolved company when the campaign wizard opts in", async () => {
  await call({ scopeToCompany: "1" });
  expect(db.emailProviderAccount.findMany).toHaveBeenCalledWith({
    where: { user_id: "user-1", company_id: "vierra-company" },
    orderBy: { created_at: "desc" },
  });
});

it("ignores the flag if it isn't exactly \"1\"", async () => {
  await call({ scopeToCompany: "true" });
  expect(db.emailProviderAccount.findMany).toHaveBeenCalledWith({
    where: { user_id: "user-1" },
    orderBy: { created_at: "desc" },
  });
});
