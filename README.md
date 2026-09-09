# ZYNVEX Enterprise V1.1.0

Autonomous AI agent operating platform with multi-tenant auth, RBAC, persistent agent executions, queue-backed worker orchestration, approvals, schedules, webhook-triggered agents, prompt registry, evaluation primitives, usage tracking, audit, and blockchain integration state handling.

## Quick Start

1. Copy `.env.example` to `.env`.
2. Start infrastructure: `docker compose -f infra/docker/docker-compose.yml up -d`.
3. Install: `npm install`.
4. Generate Prisma client: `npm run prisma:generate`.
5. Run migrations: `npm run prisma:migrate`.
6. Start app: `npm run dev`.
7. Start the worker: `npm run dev --workspace worker`.

## API Documentation

OpenAPI JSON is available at `/api/openapi`.

## V1.1 Highlights

- Persistent queued agent and workflow executions.
- Polling worker for long-running execution processing.
- Execution timelines with SSE streaming.
- Structured planning and workflow DAG batching.
- Memory CRUD with governance-aware auto-save hooks.
- Approval center APIs for manual and two-person gates.
- Agent schedules and inbound webhook triggers.
- Prompt registry, evaluation records, and provider health views.
