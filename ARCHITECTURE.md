# ARCHITECTURE

- `apps/web`: Next.js enterprise UI and API routes.
- `apps/api`: reserved standalone API service.
- `apps/worker`: reserved queue worker service.
- `packages/*`: shared modules for config, database, security, AI, agents, workflows, RAG, memory, blockchain, observability, SDK, UI.
- `infra/docker`: local runtime stack.
- `infra/terraform`: IaC foundation.

Current runtime is API-route based and enforces tenant-scoped DB access in all implemented handlers.
