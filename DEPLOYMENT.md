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
4. Attach Redis and storage credentials.
5. Configure provider keys and blockchain env vars.
