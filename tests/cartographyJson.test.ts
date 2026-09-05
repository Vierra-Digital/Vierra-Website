import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/lib/enrichment/companyContext", () => ({
  getCompanyContextFor: vi.fn().mockResolvedValue({ company: null }),
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

it("preserves JSON containing curly quotes through the real Artemis client", async () => {
  vi.resetModules();
  vi.stubEnv("ARTEMIS_PROVIDER", "openai");
  vi.stubEnv("ARTEMIS_BASE_URL", "http://artemis.test/v1");
  const description = 'A company offering “premium” services.';
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      choices: [{ message: { content: JSON.stringify([{ company: "Acme", description }]) } }],
    }),
  });
  vi.stubGlobal("fetch", fetchMock);

  const { runCartographyAgent } = await import("@/lib/cartography/agentOrchestrator");
  const result = await runCartographyAgent("service companies");

  expect(result.candidates).toHaveLength(1);
  expect(result.candidates[0].description).toBe(description);
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).messages[0].content).not.toContain("STYLE -");
});
