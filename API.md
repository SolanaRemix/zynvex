# API

Base namespace: `/api/v1`

- Auth: `/auth/signup`, `/auth/login`, `/auth/logout`, `/auth/revoke-all`, `/auth/password-reset/*`, `/auth/google/*`
- Home: `/home`
- Chat: `/chat` (SSE streaming)
- Projects: `/projects`
- Agents: `/agents`, `/agents/:id/execute`
- Agent schedules: `/agents/:id/schedules`
- Agent inbound webhooks: `/agents/:id/webhooks`, `/webhooks/agents/:publicId`
- Workflows: `/workflows`, `/workflows/:id/execute`
- Executions: `/executions/:id`, `/executions/:id/stream`
- Approvals: `/approvals`, `/approvals/:id`
- Documents: `/documents`
- Knowledge: `/knowledge/search`
- Memory: `/memories`, `/memories/:id`
- Prompts: `/prompts`
- Evaluations: `/evaluations`, `/evaluations/:id/run`
- Usage: `/usage`
- Audit: `/audit`
- API Keys: `/api-keys`, `/api-keys/:id/revoke`
- Notifications: `/notifications`
- Health: `/health`, `/health/readiness`, `/health/liveness`
- Admin system: `/admin/system`
- Outbound webhooks: `/webhooks`
- Blockchain integration status: `/integrations/blockchain`
