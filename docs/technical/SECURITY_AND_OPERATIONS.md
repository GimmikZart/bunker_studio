# Bunker Studio — Security, Reliability & Operations

## 1. Secret management

Global deployment secrets:
- server environment secret manager (Vercel/Railway/Supabase settings).

Per-organization provider credentials:
- encrypted application-side before DB persistence;
- AES-256-GCM envelope encryption;
- `STUDIO_MASTER_KEY` is 32 random bytes, base64 encoded, server/worker only;
- each encrypted record stores nonce + ciphertext + auth tag + key version;
- rotation supports decrypt old/encrypt new.

Never log decrypted secret.

OAuth tokens receive same treatment.

## 2. Password/auth

Supabase Auth.
V1:
- email/password;
- magic link optional.

Session cookies secure/httpOnly where applicable.
CSRF protection for state-changing browser endpoints according to framework pattern.

## 3. Authorization

Two layers:
1. PostgreSQL RLS;
2. application authorization.

Protected approvals cannot be bypassed by service-role worker: worker must call centralized policy evaluator before side effect.

## 4. Tool sandbox

Coding worker:
- ephemeral workspace;
- no host Docker socket;
- no arbitrary production credentials;
- network allow policy configurable;
- command timeouts;
- output size limits;
- path traversal protection.

Local worker:
- pull model;
- explicit allowed workspace root;
- no implicit whole-filesystem access;
- no inbound port requirement.

## 5. Git safety

- branch protection documented;
- no force push to protected branches;
- no agent direct push to production branch;
- webhook signatures verified;
- installation/token least privilege.

## 6. Self-improvement safety

Hard-coded policy in server domain:
`is_studio_core` disables direct production merge/deploy regardless of agent prompt.

No agent can change this flag or policy without Owner-authenticated action.

## 7. Audit

Audit event minimum:
- login/security-sensitive settings;
- provider credential create/update/delete;
- permission changes;
- agent binding changes;
- approvals;
- destructive actions;
- protected merges;
- exports;
- local worker registration/revocation.

Audit events append-only in normal app path.

## 8. Backup

Managed production:
- enable PostgreSQL point-in-time recovery/backup level available;
- daily object storage backup/versioning strategy;
- quarterly restore drill initially, monthly after real critical usage.

Export is not a substitute for DB backup.

## 9. Disaster recovery

Target initial:
- RPO <= 24h for file artifacts not covered by immediate provider backup;
- DB RPO according to managed PITR, target <= 1h when available;
- RTO <= 8h for personal/small-team V1.

Document exact provider settings once deployed.

## 10. Worker recovery

Worker heartbeat every 20 seconds while active, 60 seconds idle.
Consider offline after 3 missed heartbeat windows.

Task lease:
- renewed periodically;
- if lease expires, reconciliation determines whether provider run is resumable;
- do not blindly duplicate external side effects.

## 11. Queue reconciliation

Every minute:
- find `READY` task not queued;
- find expired lease;
- find `WAITING_PROVIDER_QUOTA` with due retry;
- find stale `RUNNING` run;
- reconcile outbox not dispatched.

## 12. Idempotency

Required for:
- task scheduling;
- provider run creation when adapter supports idempotency;
- push notification dedupe;
- Git branch creation;
- PR creation;
- export generation.

Use stable `operation_key`.

## 13. Rate limiting

App API:
- per user/IP for auth/public endpoints;
- per organization for expensive commands;
- chat send protected against accidental flood.

Provider:
- adapter-level limiter + normalized retry.

## 14. Cost abuse

Before provider call:
- permission;
- task state;
- project status;
- hard budget;
- max concurrency;
- model allowed;
- retry budget.

All must pass.

## 15. Content/logging

Do not log:
- raw secrets;
- auth headers;
- full private code by default in central logs;
- full provider prompts by default.

Persist full conversation/code artifacts only in intended encrypted/tenant-scoped stores.

## 16. CI pipeline

Pull request:
1. install locked deps;
2. format check;
3. lint;
4. typecheck;
5. unit;
6. integration with ephemeral/local DB;
7. build;
8. security scans.

Main/quality:
- same + E2E.

Production:
- deploy only from approved protected ref;
- migrations reviewed;
- rollback documented.

## 17. Database migration rule

- forward-only SQL migrations;
- destructive migration requires explicit label + Owner approval in Studio self-project;
- migration tested against quality;
- backup/rollback plan for destructive changes.

## 18. Environment matrix

`local`
- local Supabase;
- fake providers;
- no production secrets.

`quality`
- isolated DB/Auth/Storage;
- limited real provider credentials/budget;
- realistic integrations.

`production`
- isolated DB;
- strict secrets;
- protected deployment.

Never reuse service keys across environments.

## 19. Security review cadence

Bunker Studio agents:
- Reviewer per feature/PR according to task policy;
- full dependency/SAST in CI.

Human/Owner:
- production/security-sensitive approval.

Future:
- optional periodic external security review.
