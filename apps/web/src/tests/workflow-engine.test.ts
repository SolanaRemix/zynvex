import { describe, expect, it } from "vitest";
import { computeWorkflowBatches, getRunnableNodeIds, validateWorkflowDefinition } from "@zynvex/workflows";

const nodes = [
  { id: "start", nodeType: "START", name: "Start", config: {} },
  { id: "research", nodeType: "AI", name: "Research", config: {}, dependsOn: ["start"] },
  { id: "analysis", nodeType: "AI", name: "Analysis", config: {}, dependsOn: ["start"] },
  { id: "synthesis", nodeType: "AI", name: "Synthesis", config: {}, dependsOn: ["research", "analysis"] },
  { id: "end", nodeType: "END", name: "End", config: {}, dependsOn: ["synthesis"] }
] as const;

describe("workflow dag execution", () => {
  it("validates an acyclic workflow", () => {
    expect(() => validateWorkflowDefinition(nodes as never)).not.toThrow();
  });

  it("computes parallelizable batches", () => {
    const batches = computeWorkflowBatches(nodes as never);
    const researchBatch = batches.find((step) => step.nodeId === "research");
    const analysisBatch = batches.find((step) => step.nodeId === "analysis");
    const synthesisBatch = batches.find((step) => step.nodeId === "synthesis");

    expect(researchBatch?.batch).toBe(1);
    expect(analysisBatch?.batch).toBe(1);
    expect(synthesisBatch?.batch).toBeGreaterThan(researchBatch?.batch ?? 0);
  });

  it("returns runnable nodes when dependencies are satisfied", () => {
    expect(getRunnableNodeIds(nodes as never, ["start"], [])).toEqual(["research", "analysis"]);
  });
});
