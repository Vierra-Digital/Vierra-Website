import { afterEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ created: vi.fn(), delegate: { findMany: vi.fn() } }));
vi.mock("@/lib/generated/prisma/client", () => ({
  Prisma: { ModelName: { Contact: "Contact", CartographyContact: "CartographyContact" } },
  PrismaClient: class {
    contact = {};
    cartographyContact = state.delegate;
    constructor() { state.created(); }
  },
}));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: class {} }));

afterEach(() => {
  global.prisma = undefined;
  vi.resetModules();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

it("replaces a cached client that predates the Cartography models", async () => {
  vi.stubEnv("DATABASE_URL", "postgresql://test:test@localhost/test");
  const disconnect = vi.fn().mockResolvedValue(undefined);
  global.prisma = { contact: {}, $disconnect: disconnect } as unknown as NonNullable<typeof global.prisma>;
  const { prisma } = await import("@/lib/prisma");
  expect(prisma.cartographyContact).toBe(state.delegate);
  expect(disconnect).toHaveBeenCalledOnce();
  expect(state.created).toHaveBeenCalledOnce();
});

it("reuses a cached client that already supports the current models", async () => {
  const cached = { contact: {}, cartographyContact: state.delegate };
  global.prisma = cached as unknown as NonNullable<typeof global.prisma>;
  const { prisma } = await import("@/lib/prisma");
  expect(prisma.cartographyContact).toBe(state.delegate);
  expect(state.created).not.toHaveBeenCalled();
});
