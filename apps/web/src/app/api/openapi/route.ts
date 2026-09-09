export async function GET() {
  return Response.json({
    openapi: "3.1.0",
    info: { title: "ZYNVEX Enterprise API", version: "1.0.0" },
    paths: {
      "/api/v1/chat": { post: { summary: "Streaming chat" } },
      "/api/v1/agents": { get: { summary: "List agents" }, post: { summary: "Create agent" } },
      "/api/v1/agents/{id}/execute": { post: { summary: "Execute agent" } },
      "/api/v1/workflows": { get: { summary: "List workflows" }, post: { summary: "Create workflow" } },
      "/api/v1/workflows/{id}/execute": { post: { summary: "Execute workflow" } },
      "/api/v1/projects": { get: { summary: "List projects" }, post: { summary: "Create project" } },
      "/api/v1/documents": { post: { summary: "Upload document" } },
      "/api/v1/knowledge/search": { post: { summary: "Search knowledge" } },
      "/api/v1/usage": { get: { summary: "Usage records" } },
      "/api/v1/audit": { get: { summary: "Audit events" } },
      "/api/v1/api-keys": { get: { summary: "List API keys" }, post: { summary: "Create API key" } }
    }
  });
}
