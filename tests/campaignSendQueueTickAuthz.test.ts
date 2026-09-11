import { beforeEach, expect, it, vi } from "vitest";

/**
 * pages/api/campaigns/send-queue/tick.ts used to be `roles: ["admin"]` — a staff member could
 * already PATCH a campaign's status to "active" (pages/api/campaigns/[id].ts has no role
 * restriction of its own) but then couldn't manually run the send queue to actually process it,
 * a later step of the same flow. This pins that a "staff" session can now call it (real requireRole
 * logic runs here — only requireSession, the actual Supabase call, is mocked — so this exercises
 * the real role check, not a stand-in for it).
 */

const db = vi.hoisted(() => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

// requireRole calls requireSession internally (not through the module's export binding), so
// mocking @/lib/auth's export doesn't intercept it — mock one level deeper instead: the Supabase
// client requireSession builds, and resolveUser's identity resolution. This exercises the real
// requireSession/requireRole role-check logic, not a stand-in for it.
const getUser = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({ createSupabasePagesClient: () => ({ auth: { getUser } }) }));
const resolveUser = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/resolveUser", () => ({ resolveUser }));

const runCampaignSendQueueTick = vi.hoisted(() => vi.fn());
vi.mock("@/lib/campaigns/sendQueueTick", () => ({ runCampaignSendQueueTick }));

import handler from "@/pages/api/campaigns/send-queue/tick";
import type { NextApiRequest, NextApiResponse } from "next";

function session(role: "admin" | "staff") {
  return { kind: "member" as const, companyId: "company-1", user: { id: "user-1", role, email: "staff@example.com", name: null } };
}

async function call() {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), setHeader: vi.fn() };
  await handler({ method: "POST", query: {}, body: {} } as unknown as NextApiRequest, res as unknown as NextApiResponse);
  return res;
}

beforeEach(() => {
  vi.resetAllMocks();
  runCampaignSendQueueTick.mockResolvedValue({ processed: 0, sent: 0, failed: 0, skipped: 0 });
  getUser.mockResolvedValue({ data: { user: { id: "auth-user-1" } }, error: null });
});

it("lets a staff member (not just admin) run the send queue", async () => {
  resolveUser.mockResolvedValue(session("staff"));
  const res = await call();
  expect(res.status).toHaveBeenCalledWith(200);
  expect(runCampaignSendQueueTick).toHaveBeenCalledWith("company-1");
});

it("still lets an admin run it too", async () => {
  resolveUser.mockResolvedValue(session("admin"));
  const res = await call();
  expect(res.status).toHaveBeenCalledWith(200);
});

it("still requires authentication", async () => {
  getUser.mockResolvedValue({ data: { user: null }, error: { message: "not signed in" } });
  const res = await call();
  expect(res.status).toHaveBeenCalledWith(401);
  expect(runCampaignSendQueueTick).not.toHaveBeenCalled();
});
