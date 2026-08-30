# Deployment runbook

Bunker Studio uses three isolated environments: `local`, `quality`, and
`production`. Each environment has its own Supabase project, application
deployment, provider credentials, and encryption key. Never reuse service
keys or `STUDIO_MASTER_KEY` between environments.

## Quality

1. Create an isolated Supabase project and apply the forward-only migrations:

   ```bash
   supabase link --project-ref "$QUALITY_PROJECT_REF"
   supabase db push
   ```

2. Configure the quality web deployment with `SUPABASE_URL`,
   `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, and a
   unique random `STUDIO_MASTER_KEY`.
3. Deploy the web container or Next.js application and a separate worker
   deployment. Run `pnpm verify` and `pnpm test:e2e` against the quality URL.
4. Run the quality-only external checks in
   [`docs/quality/ACCEPTANCE_MATRIX.md`](quality/ACCEPTANCE_MATRIX.md), then
   complete the backup/restore drill before release approval.

## Production

Production is promoted only from an approved protected ref after quality
verification and Owner approval. Review migrations, take the configured
backup, apply migrations, then deploy web and worker separately. No agent or
CI job may auto-merge or auto-deploy the protected Bunker Studio project.

Reference target:

- Web/API: Vercel or the web Docker image;
- Worker: Railway or the worker Docker image;
- Database, Auth, Storage, Realtime: isolated Supabase project;
- Git and CI: GitHub Actions with protected environments.

Required production checks:

- startup environment validation succeeds;
- web `/api/health` and worker heartbeat are healthy;
- RLS smoke test passes with two users from different organizations;
- no production secret is present in build artifacts or logs;
- rollback and restore contacts are recorded in the release worklog.

This document intentionally contains no credentials and does not perform a
deployment. The repository has no production auto-deploy workflow.
