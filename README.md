# ZYNVEX Enterprise V1.0.0

Autonomous Intelligence Network production foundation with multi-tenant auth, RBAC, chat, agents, workflows, API keys, usage tracking, audit, blockchain integration state handling, and CI-ready workspace architecture.

## Quick Start

1. Copy `.env.example` to `.env`.
2. Start infrastructure: `docker compose -f infra/docker/docker-compose.yml up -d`.
3. Install: `npm install`.
4. Generate Prisma client: `npm run prisma:generate`.
5. Run migrations: `npm run prisma:migrate`.
6. Start app: `npm run dev`.

## API Documentation

OpenAPI JSON is available at `/api/openapi`.
