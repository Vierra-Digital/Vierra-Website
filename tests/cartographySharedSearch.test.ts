import type { NextApiRequest, NextApiResponse } from "next";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { $queryRaw: vi.fn() } }));

import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import search from "@/pages/api/cartography/search";
import locations from "@/pages/api/cartography/locations";

function response() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn(), setHeader: vi.fn() };
}

beforeEach(() => vi.resetAllMocks());

describe.each([
  ["search", search, { company: "Shared company", contact_name: null, distance_miles: null }],
  ["locations", locations, { city: "Denver", state: "CO", lat: 39.7, lng: -104.9, count: BigInt(3) }],
] as const)("shared Cartography %s", (_name, handler, row) => {
  it("uses the same directory query for members of different companies", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([row]);
    for (const companyId of ["company-a", "company-b"]) {
      vi.mocked(requireRole).mockResolvedValue({
        kind: "member", companyId,
        user: { id: "user", email: "staff@example.com", name: null, role: "staff", isPlatformAdmin: false },
      });
      const res = response();
      await handler({ method: "GET", query: {} } as NextApiRequest, res as unknown as NextApiResponse);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ results: [expect.any(Object)] });
    }
    const calls = vi.mocked(prisma.$queryRaw).mock.calls;
    expect(calls[0]).toEqual(calls[1]);
    expect(String(calls[0][0])).not.toMatch(/\bcompany_id\s*=/);
  });

  it("does not read the directory when authentication denies access", async () => {
    vi.mocked(requireRole).mockResolvedValue(null);
    await handler({ method: "GET", query: {} } as NextApiRequest, response() as unknown as NextApiResponse);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it("rejects writes before querying", async () => {
    const res = response();
    await handler({ method: "POST", query: {} } as NextApiRequest, res as unknown as NextApiResponse);
    expect(res.status).toHaveBeenCalledWith(405);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
});
