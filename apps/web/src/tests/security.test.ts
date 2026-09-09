import { describe, expect, it } from "vitest";
import { can } from "@zynvex/security";
import { getTokenIntegrationState } from "@zynvex/blockchain";

describe("security and blockchain configuration", () => {
  it("enforces RBAC permissions", () => {
    expect(can("VIEWER", "projects.read")).toBe(true);
    expect(can("VIEWER", "projects.delete")).toBe(false);
  });

  it("returns explicit token integration state", () => {
    expect(getTokenIntegrationState({}).configured).toBe(false);
    expect(getTokenIntegrationState({ ZVX_MINT_ADDRESS: "mint", SOLANA_RPC_URL: "rpc", JUPITER_API_URL: "jup" }).configured).toBe(true);
  });
});
