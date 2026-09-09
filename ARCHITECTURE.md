# ARCHITECTURE

- `apps/web`: Next.js enterprise UI and API routes.
- `apps/api`: reserved standalone API service.
- `apps/worker`: polling worker service for queued agent and workflow executions.
- `packages/*`: shared modules for config, database, security, AI, agents, workflows, RAG, memory, blockchain, observability, SDK, UI.
- `infra/docker`: local runtime stack.
- `infra/terraform`: IaC foundation.

Current runtime flow:

`User/API -> QueueJob -> Worker -> Agent/Workflow runtime -> Audit/Usage/Transitions -> SSE/UI`

Key V1.1 additions:

- Queue-backed persistent execution records.
- Structured agent planning and plan-step persistence.
- Workflow DAG batching and approval wait states.
- Agent memory governance, schedules, and webhook triggers.
- Provider health snapshots and execution timeline streaming.
