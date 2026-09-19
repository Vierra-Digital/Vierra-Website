import type { NextApiRequest, NextApiResponse } from "next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/lib/generated/prisma/client";

/**
 * pages/api/contacts/tags.ts (a user's tag definitions) and pages/api/contacts/[id]/tags.ts (tag
 * assignments on one contact) — neither had a route-level test before. Both take ids straight
 * from the request (body or URL) and hand them to Prisma @db.Uuid columns; both create/rename
 * tags against a unique (user_id, name) key. These pin the isUuid guards and P2002 mapping added
 * to close those gaps.
 */

const db = vi.hoisted(() => ({
  contact: { findFirst: vi.fn() },
  contactTag: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
  contactTagAssignment: { findMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/auth", () => ({ requireRole: vi.fn() }));

import { requireRole } from "@/lib/auth";
import tagsHandler from "@/pages/api/contacts/tags";
import contactTagsHandler from "@/pages/api/contacts/[id]/tags";

const CONTACT_ID = "33333333-3333-4333-8333-333333333333";
const TAG_ID = "44444444-4444-4444-8444-444444444444";

function prismaKnownError(code: string) {
  return new Prisma.PrismaClientKnownRequestError("simulated", { code, clientVersion: "test" });
}

async function call(handler: typeof tagsHandler, method: string, body: Record<string, unknown> = {}, query: Record<string, unknown> = {}) {
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

describe("pages/api/contacts/tags.ts", () => {
  it("400s a POST with no name, without touching the database", async () => {
    const res = await call(tagsHandler, "POST", {});
    expect(res.status).toHaveBeenCalledWith(400);
    expect(db.contactTag.create).not.toHaveBeenCalled();
  });

  it("answers a clean 409 (not 500) creating a tag name the user already has", async () => {
    db.contactTag.create.mockRejectedValue(prismaKnownError("P2002"));
    const res = await call(tagsHandler, "POST", { name: "VIP" });
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ message: "A record with that value already exists." });
  });

  it("400s a PUT with a malformed tag id, without touching the database", async () => {
    const res = await call(tagsHandler, "PUT", { id: "not-a-uuid", name: "New name" });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "A valid tag id is required." });
    expect(db.contactTag.findFirst).not.toHaveBeenCalled();
  });

  it("404s a PUT for a well-formed id that isn't one of the user's tags", async () => {
    db.contactTag.findFirst.mockResolvedValue(null);
    const res = await call(tagsHandler, "PUT", { id: TAG_ID, name: "New name" });
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("answers a clean 409 (not 500) renaming a tag to a name that collides", async () => {
    db.contactTag.findFirst.mockResolvedValue({ id: TAG_ID, name: "Old", color: "#000" });
    db.contactTag.update.mockRejectedValue(prismaKnownError("P2002"));
    const res = await call(tagsHandler, "PUT", { id: TAG_ID, name: "Taken" });
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it("400s a DELETE with a malformed tag id, without touching the database", async () => {
    const res = await call(tagsHandler, "DELETE", { id: "../../etc/passwd" });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(db.contactTag.deleteMany).not.toHaveBeenCalled();
  });
});

describe("pages/api/contacts/[id]/tags.ts", () => {
  beforeEach(() => {
    db.contact.findFirst.mockResolvedValue({ id: CONTACT_ID });
  });

  it("400s a missing contact id without touching the database", async () => {
    const res = await call(contactTagsHandler, "GET", {}, {});
    expect(res.status).toHaveBeenCalledWith(400);
    expect(db.contact.findFirst).not.toHaveBeenCalled();
  });

  it("404s a malformed (non-UUID) contact id without touching the database", async () => {
    const res = await call(contactTagsHandler, "GET", {}, { id: "not-a-uuid" });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Contact not found." });
    expect(db.contact.findFirst).not.toHaveBeenCalled();
  });

  it("404s a well-formed contact id that doesn't name a real contact", async () => {
    db.contact.findFirst.mockResolvedValue(null);
    const res = await call(contactTagsHandler, "GET", {}, { id: CONTACT_ID });
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("400s a POST with a malformed tagId, without looking it up", async () => {
    const res = await call(contactTagsHandler, "POST", { tagId: "not-a-uuid" }, { id: CONTACT_ID });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "A valid tagId is required" });
    expect(db.contactTagAssignment.upsert).not.toHaveBeenCalled();
  });

  it("404s a POST for a well-formed tagId that isn't one of the user's tags", async () => {
    db.contactTag.findFirst.mockResolvedValue(null);
    const res = await call(contactTagsHandler, "POST", { tagId: TAG_ID }, { id: CONTACT_ID });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Tag not found." });
  });

  it("drops malformed ids from a PUT's tagIds list instead of letting them reach Prisma", async () => {
    db.contactTag.findMany.mockResolvedValue([{ id: TAG_ID }]);
    await call(contactTagsHandler, "PUT", { tagIds: ["not-a-uuid", TAG_ID, "'; drop table contacts;--"] }, { id: CONTACT_ID });
    expect(db.contactTag.findMany).toHaveBeenCalledWith({
      where: { user_id: "user-1", id: { in: [TAG_ID] } },
      select: { id: true },
    });
  });

  it("400s a DELETE with a malformed tagId, without touching the database", async () => {
    const res = await call(contactTagsHandler, "DELETE", { tagId: "not-a-uuid" }, { id: CONTACT_ID });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(db.contactTagAssignment.deleteMany).not.toHaveBeenCalled();
  });
});
