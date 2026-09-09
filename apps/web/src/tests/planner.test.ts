import { describe, expect, it } from "vitest";
import { createExecutionPlan, isBudgetExceeded, nextRetryDelayMs } from "@zynvex/agents";

describe("agent planner foundations", () => {
  it("builds a structured plan with dependencies", () => {
    const plan = createExecutionPlan({
      objective: "Analyze security findings in uploaded documents and produce a report.",
      tools: ["knowledge.search"]
    });

    expect(plan.steps.length).toBeGreaterThanOrEqual(4);
    expect(plan.steps[0]?.status).toBe("READY");
    expect(plan.steps.some((step) => step.dependencies.length > 0)).toBe(true);
  });

  it("uses bounded retry backoff", () => {
    expect(nextRetryDelayMs(1)).toBe(1000);
    expect(nextRetryDelayMs(2)).toBe(3000);
    expect(nextRetryDelayMs(3)).toBe(10000);
    expect(nextRetryDelayMs(10)).toBeLessThanOrEqual(30000);
  });

  it("detects exceeded execution budgets", () => {
    expect(isBudgetExceeded({ maxCost: 1 }, { cost: 1.1 })).toBe(true);
    expect(isBudgetExceeded({ maxRuntimeMs: 500 }, { runtimeMs: 250 })).toBe(false);
  });
});
