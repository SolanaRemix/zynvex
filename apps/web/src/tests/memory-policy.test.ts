import { describe, expect, it } from "vitest";
import { canAutoSaveMemory, memoryExpires, searchMemories } from "@zynvex/memory";

describe("memory governance", () => {
  it("only auto-saves low-risk records when policy allows it", () => {
    expect(canAutoSaveMemory({ policy: "AUTO_SAVE_LOW_RISK", confidence: 0.7, type: "TASK" })).toBe(true);
    expect(canAutoSaveMemory({ policy: "ASK_FIRST", confidence: 0.9, type: "FACT" })).toBe(false);
  });

  it("detects expired memories", () => {
    expect(memoryExpires({ expiresAt: new Date("2020-01-01T00:00:00.000Z") }, new Date("2021-01-01T00:00:00.000Z"))).toBe(true);
  });

  it("filters memories by query and type", () => {
    const results = searchMemories(
      [
        { content: "Preferred deployment region is us-east-1", type: "PREFERENCE", scope: "user" },
        { content: "Quarterly roadmap depends on analytics backfill", type: "PROJECT", scope: "project" }
      ],
      "deploy",
      ["PREFERENCE"]
    );

    expect(results).toHaveLength(1);
  });
});
