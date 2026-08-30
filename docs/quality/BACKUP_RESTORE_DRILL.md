# Backup and restore quality drill

This repository does not auto-deploy or provision production backups. Run this drill in the isolated quality Supabase project before a release.

1. Record migration revision and create a managed database snapshot/PITR marker.
2. Export the organization through the application path and verify that provider secret blobs are absent and connections are `REQUIRES_REAUTH`.
3. Restore the snapshot into a clean quality project, apply forward migrations, and run `pnpm test:e2e` against that project.
4. Import the versioned export into a second clean instance; verify remapped organization/team/project/agent/memory/history IDs and tenant isolation.
5. Reconnect provider and Git credentials through the normal approval flow; never copy service keys into the export.
6. Record RPO/RTO, migration revision, restore result, and any follow-up in the release worklog.

Targets: database RPO <= 1 hour where managed PITR exists, artifact RPO <= 24 hours, and RTO <= 8 hours for the initial V1 deployment.
