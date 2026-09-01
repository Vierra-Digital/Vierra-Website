import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/ai/artemis", () => ({
  artemisGenerate: vi.fn(),
}));
vi.mock("@/lib/enrichment/companyContext", () => ({
  getCompanyContextFor: vi.fn(),
}));

import { artemisGenerate } from "@/lib/ai/artemis";
import { getCompanyContextFor } from "@/lib/enrichment/companyContext";
import { runCartographyAgent, DISCOVERY_METHODS } from "@/lib/cartography/agentOrchestrator";

const mockGenerate = artemisGenerate as unknown as ReturnType<typeof vi.fn>;
const mockEnrich = getCompanyContextFor as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockGenerate.mockReset();
  // Default: no real domain resolved — the common case, since Artemis is explicitly allowed
  // to name an illustrative/generic company that has no real site to find.
  mockEnrich.mockReset().mockResolvedValue({ company: null });
});

function candidateJson(companies: string[]) {
  return JSON.stringify(
    companies.map((company) => ({
      company,
      industry: "Test Industry",
      description: "A test company.",
      location: "Austin, TX",
      suggestedTitle: "CEO",
    }))
  );
}

describe("runCartographyAgent", () => {
  it("fans out to one sub-agent per discovery method", async () => {
    mockGenerate.mockResolvedValue({ ok: true, text: candidateJson(["Acme Co"]) });
    const { tasks } = await runCartographyAgent("dental clinics near Austin");
    expect(tasks.map((t) => t.method).sort()).toEqual([...DISCOVERY_METHODS].sort());
  });

  it("only calls Artemis for the general method (only one with a real backend)", async () => {
    mockGenerate.mockResolvedValue({ ok: true, text: candidateJson(["Acme Co"]) });
    await runCartographyAgent("dental clinics near Austin");
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });

  it("reports google_business and linkedin_sales_nav as not_implemented", async () => {
    mockGenerate.mockResolvedValue({ ok: true, text: candidateJson(["Acme Co"]) });
    const { tasks } = await runCartographyAgent("dental clinics near Austin");
    const googleTask = tasks.find((t) => t.method === "google_business");
    const linkedinTask = tasks.find((t) => t.method === "linkedin_sales_nav");
    expect(googleTask).toEqual({ method: "google_business", status: "not_implemented" });
    expect(linkedinTask).toEqual({ method: "linkedin_sales_nav", status: "not_implemented" });
  });

  it("marks the general task completed and tags candidates with sourceMethod", async () => {
    mockGenerate.mockResolvedValue({ ok: true, text: candidateJson(["Acme Co", "Beta Inc"]) });
    const { tasks, candidates } = await runCartographyAgent("dental clinics near Austin");
    const generalTask = tasks.find((t) => t.method === "general");
    expect(generalTask).toEqual({ method: "general", status: "completed", candidateCount: 2 });
    expect(candidates).toHaveLength(2);
    expect(candidates.every((c) => c.sourceMethod === "general")).toBe(true);
  });

  it("marks the general task failed (without throwing) when Artemis errors", async () => {
    mockGenerate.mockResolvedValue({ ok: false, error: "Artemis AI isn't configured yet." });
    const { tasks, candidates } = await runCartographyAgent("dental clinics near Austin");
    const generalTask = tasks.find((t) => t.method === "general");
    expect(generalTask).toEqual({
      method: "general",
      status: "failed",
      error: "Artemis AI isn't configured yet.",
    });
    expect(candidates).toEqual([]);
  });

  it("marks the general task failed when Artemis returns unparseable JSON", async () => {
    mockGenerate.mockResolvedValue({ ok: true, text: "not json at all" });
    const { tasks, candidates } = await runCartographyAgent("dental clinics near Austin");
    const generalTask = tasks.find((t) => t.method === "general");
    expect(generalTask?.status).toBe("failed");
    expect(candidates).toEqual([]);
  });

  it("dedupes candidates with the same company name (case-insensitive)", async () => {
    mockGenerate.mockResolvedValue({ ok: true, text: candidateJson(["Acme Co", "acme co", "Beta Inc"]) });
    const { candidates } = await runCartographyAgent("dental clinics near Austin");
    expect(candidates.map((c) => c.company)).toEqual(["Acme Co", "Beta Inc"]);
  });

  it("caps candidates at 6", async () => {
    mockGenerate.mockResolvedValue({
      ok: true,
      text: candidateJson(["A", "B", "C", "D", "E", "F", "G", "H"]),
    });
    const { candidates } = await runCartographyAgent("dental clinics near Austin");
    expect(candidates).toHaveLength(6);
  });

  it("strips a markdown code fence if Artemis wraps the JSON anyway", async () => {
    mockGenerate.mockResolvedValue({ ok: true, text: "```json\n" + candidateJson(["Acme Co"]) + "\n```" });
    const { candidates } = await runCartographyAgent("dental clinics near Austin");
    expect(candidates).toHaveLength(1);
    expect(candidates[0].company).toBe("Acme Co");
  });

  it("attaches a resolved domain when enrichment finds a real company", async () => {
    mockGenerate.mockResolvedValue({ ok: true, text: candidateJson(["Acme Co"]) });
    mockEnrich.mockResolvedValue({ company: { domain: "acme.co" } });
    const { candidates } = await runCartographyAgent("dental clinics near Austin");
    expect(candidates[0].domain).toBe("acme.co");
  });

  it("leaves domain null when enrichment finds no match, without failing the candidate", async () => {
    mockGenerate.mockResolvedValue({ ok: true, text: candidateJson(["Acme Co"]) });
    mockEnrich.mockResolvedValue({ company: null });
    const { candidates } = await runCartographyAgent("dental clinics near Austin");
    expect(candidates[0].domain).toBeNull();
  });

  it("leaves domain null (without throwing) when enrichment itself errors", async () => {
    mockGenerate.mockResolvedValue({ ok: true, text: candidateJson(["Acme Co"]) });
    mockEnrich.mockRejectedValue(new Error("network blip"));
    const { candidates } = await runCartographyAgent("dental clinics near Austin");
    expect(candidates[0].domain).toBeNull();
  });

  it("enriches each deduped candidate once, not once per contributing sub-agent", async () => {
    mockGenerate.mockResolvedValue({ ok: true, text: candidateJson(["Acme Co", "acme co"]) });
    await runCartographyAgent("dental clinics near Austin");
    expect(mockEnrich).toHaveBeenCalledTimes(1);
  });
});
