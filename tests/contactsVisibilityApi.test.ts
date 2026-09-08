import type { NextApiRequest, NextApiResponse } from "next";
import { beforeEach, expect, it, vi } from "vitest";
import { Prisma } from "@/lib/generated/prisma/client";

/**
 * pages/api/contacts/visibility.ts — per-inbox field visibility. Never had a route test. The PUT
 * handler used to find-then-create, which raced two concurrent saves for the same account into a
 * double-insert; it's now an atomic upsert wherever the schema's real (user_id, account_id) unique
 * constraint applies. These pin that it actually takes the upsert path (not the old find-then-write
 * one) whenever an account_id is resolvable, and that a genuine conflict still answers cleanly.
 */

const db = vi.hoisted(() => ({
  contactFieldVisibilitySetting: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn(), upsert: vi.fn() },
  emailProviderAccount: { findFirst: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/auth", () => ({ requireRole: vi.fn() }));

import { requireRole } from "@/lib/auth";
import handler from "@/pages/api/contacts/visibility";

const ACCOUNT_ID = "55555555-5555-4555-8555-555555555555";

function prismaKnownError(code: string) {
  return new Prisma.PrismaClientKnownRequestError("simulated", { code, clientVersion: "test" });
}

async function call(method: string, body: Record<string, unknown> = {}, query: Record<string, unknown> = {}) {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  await handler({ method, body, query } as unknown as NextApiRequest, res as unknown as NextApiResponse);
  return res;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireRole).mockResolvedValue({
    kind: "member",
    companyId: "company-1",
    user: { id: "user-1", role: "staff", email: "staff@example.com", name: null },
  } as never);
});

it("upserts atomically (not find-then-create) when the account resolves", async () => {
  db.emailProviderAccount.findFirst.mockResolvedValue({ id: ACCOUNT_ID });
  db.contactFieldVisibilitySetting.upsert.mockResolvedValue({ show_phone: false, show_business: true, show_website: true });
  const res = await call("PUT", { showPhone: false }, { accountEmail: "me@example.com" });
  expect(db.contactFieldVisibilitySetting.upsert).toHaveBeenCalledWith({
    where: { user_id_account_id: { user_id: "user-1", account_id: ACCOUNT_ID } },
    create: expect.objectContaining({ user_id: "user-1", account_id: ACCOUNT_ID, show_phone: false }),
    update: { show_phone: false, show_business: true, show_website: true },
  });
  expect(db.contactFieldVisibilitySetting.findFirst).not.toHaveBeenCalled();
  expect(res.status).toHaveBeenCalledWith(200);
});

it("falls back to find-then-write when the account doesn't resolve (no account_id to upsert on)", async () => {
  db.emailProviderAccount.findFirst.mockResolvedValue(null);
  db.contactFieldVisibilitySetting.findFirst.mockResolvedValue(null);
  db.contactFieldVisibilitySetting.create.mockResolvedValue({ show_phone: true, show_business: true, show_website: true });
  await call("PUT", {}, { accountEmail: "unresolvable@example.com" });
  expect(db.contactFieldVisibilitySetting.upsert).not.toHaveBeenCalled();
  expect(db.contactFieldVisibilitySetting.create).toHaveBeenCalledWith({
    data: expect.objectContaining({ account_id: null, account_email: "unresolvable@example.com" }),
  });
});

it("defaults every field to visible when the body sends nothing", async () => {
  db.emailProviderAccount.findFirst.mockResolvedValue({ id: ACCOUNT_ID });
  db.contactFieldVisibilitySetting.upsert.mockResolvedValue({ show_phone: true, show_business: true, show_website: true });
  await call("PUT", {}, { accountEmail: "me@example.com" });
  expect(db.contactFieldVisibilitySetting.upsert).toHaveBeenCalledWith(
    expect.objectContaining({ update: { show_phone: true, show_business: true, show_website: true } })
  );
});

it("answers a clean 409 (not 500) on a genuine unique-constraint race", async () => {
  db.emailProviderAccount.findFirst.mockResolvedValue({ id: ACCOUNT_ID });
  db.contactFieldVisibilitySetting.upsert.mockRejectedValue(prismaKnownError("P2002"));
  const res = await call("PUT", {}, { accountEmail: "me@example.com" });
  expect(res.status).toHaveBeenCalledWith(409);
});

it("falls back to a generic 500 for a genuinely unexpected error, not a crash", async () => {
  db.emailProviderAccount.findFirst.mockRejectedValue(new Error("connection reset"));
  const res = await call("GET", {}, { accountEmail: "me@example.com" });
  expect(res.status).toHaveBeenCalledWith(500);
  expect(res.json).toHaveBeenCalledWith({ message: "Failed to process visibility request." });
});
