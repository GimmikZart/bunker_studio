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

2. Configure the quality web deployment with `BUNKER_PERSISTENCE_MODE=supabase`, `SUPABASE_URL`,
   `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, and a
   unique random `STUDIO_MASTER_KEY`.
   Configure `WEB_PUSH_VAPID_SUBJECT`, `WEB_PUSH_VAPID_PUBLIC_KEY`,
   `WEB_PUSH_VAPID_PRIVATE_KEY`, and expose only
   `NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY` to the browser when Web Push is
   enabled. Provider and repository credentials are added per organization or
   project in the application and encrypted before database persistence.
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

Local worker bootstrap:

1. An Owner/Admin creates a registration token through
   `POST /api/workers/registration-tokens` and transfers it once to the
   local machine through a secure channel.
2. Start the worker with `WORKER_CONTROL_PLANE_URL`,
   `WORKER_REGISTRATION_TOKEN`, `WORKER_NAME`, and comma-separated
   `WORKER_CAPABILITIES`. For repository work also set an explicit
   `WORKER_WORKSPACE_ROOT`. The exchange stores the node credential in
   `.bunker/worker-identity.json` (or `WORKER_IDENTITY_FILE`) for later starts;
   the one-time registration token is not reused.
3. The daemon calls the authenticated runtime heartbeat endpoint. A revoked or
   invalid credential never falls back to the user-authenticated administrative
   endpoint. The daemon pulls scoped `QUEUED` tasks, receives the assigned
   agent's encrypted-at-rest provider/repository execution context over the
   authenticated HTTPS boundary, renews the lease while active, and reports
   the result through the completion endpoint. Provider and model selection
   belongs to each agent binding, never to worker environment variables.

Required production checks:

- startup environment validation succeeds;
- web `/api/health` and worker heartbeat are healthy;
- RLS smoke test passes with two users from different organizations;
- no production secret is present in build artifacts or logs;
- rollback and restore contacts are recorded in the release worklog.

This document intentionally contains no credentials and does not perform a
deployment. The repository has no production auto-deploy workflow.
