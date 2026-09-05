import { describe, expect, it } from "vitest";
import { computeRunStatus } from "@/lib/cartography/persistRun";
import type { SubAgentTaskResult } from "@/lib/cartography/agentOrchestrator";

const completed = (candidateCount: number): SubAgentTaskResult => ({
  method: "general",
  status: "completed",
  candidateCount,
});
const failed = (error = "boom"): SubAgentTaskResult => ({ method: "general", status: "failed", error });
const notImplemented = (method: SubAgentTaskResult["method"] = "google_business"): SubAgentTaskResult => ({
  method,
  status: "not_implemented",
});

describe("computeRunStatus", () => {
  it("is review_pending when there are candidates to review", () => {
    expect(computeRunStatus([completed(3)], 3)).toBe("review_pending");
  });

  it("is completed when nothing failed but there's nothing to review", () => {
    expect(computeRunStatus([completed(0), notImplemented(), notImplemented("linkedin_sales_nav")], 0)).toBe(
      "completed"
    );
  });

  it("is failed only when every task failed", () => {
    expect(computeRunStatus([failed(), failed()], 0)).toBe("failed");
  });

  it("is failed when discovery fails and the other methods are unimplemented", () => {
    expect(computeRunStatus([failed(), notImplemented(), notImplemented("linkedin_sales_nav")], 0)).toBe("failed");
  });

  it("preserves candidates when at least one task succeeded", () => {
    expect(computeRunStatus([failed(), completed(2)], 2)).toBe("review_pending");
  });

  it("is completed (not failed) when there are no tasks at all", () => {
    expect(computeRunStatus([], 0)).toBe("completed");
  });
});
