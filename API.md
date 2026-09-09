# API

Base namespace: `/api/v1`

- Auth: `/auth/signup`, `/auth/login`, `/auth/logout`, `/auth/revoke-all`, `/auth/password-reset/*`, `/auth/google/*`
- Home: `/home`
- Chat: `/chat` (SSE streaming)
- Projects: `/projects`
- Agents: `/agents`, `/agents/:id/execute`
- Workflows: `/workflows`, `/workflows/:id/execute`
- Executions: `/executions/:id`
- Documents: `/documents`
- Knowledge: `/knowledge/search`
- Usage: `/usage`
- Audit: `/audit`
- API Keys: `/api-keys`, `/api-keys/:id/revoke`
- Notifications: `/notifications`
- Health: `/health`, `/health/readiness`, `/health/liveness`
- Blockchain integration status: `/integrations/blockchain`
