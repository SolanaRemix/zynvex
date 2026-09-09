import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@zynvex/agents",
    "@zynvex/ai",
    "@zynvex/blockchain",
    "@zynvex/config",
    "@zynvex/database",
    "@zynvex/memory",
    "@zynvex/observability",
    "@zynvex/rag",
    "@zynvex/security",
    "@zynvex/workflows"
  ]
};

export default nextConfig;
