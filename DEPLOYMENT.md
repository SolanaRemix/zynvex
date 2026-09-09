# DEPLOYMENT

## Required Services
- Vercel (or Node runtime) for `apps/web`
- Managed PostgreSQL
- Managed Redis
- S3-compatible object storage
- Worker runtime for long-running executions

## Steps
1. Configure env vars from `.env.example`.
2. Run Prisma migrations against production DB.
3. Deploy web app.
4. Start the worker process with `npm run dev --workspace worker` or an equivalent long-running service command.
5. Attach Redis and storage credentials.
6. Configure provider keys, worker polling env vars, and blockchain env vars.
7. Verify `/api/v1/health` and `/api/v1/admin/system` before routing production traffic.
