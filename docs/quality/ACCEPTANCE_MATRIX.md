# Bunker Studio V1 acceptance matrix

Updated 2026-08-31. `PASS` means automated evidence is present in this repository. `PARTIAL` means the in-scope foundation is implemented but requires an external credential, device, provider or multi-process quality run. The latest local release check also covers agent registry management, notification preferences, Settings/provider visibility, the task state-machine UI and the core-page performance smoke, without changing the external-quality statuses below.

Checkpoint 2026-08-31: the local protected Studio Labs workflow now creates gated task/approval records and enforces reviewer, CI, Owner and human-actor requirements server-side; the Lead plan endpoint persists validated DAGs, task links, Definition of Done, read/write scopes and parallel-group metadata, including export/import round-trip; provider streaming preserves terminal usage-only events; concrete GitHub branch/check-run/PR and VAPID Web Push adapters are covered by contract tests; AC-009 and AC-011 remain `PARTIAL` until their quality integrations are exercised with real credentials/device.

| Criterion | Status | Evidence / remaining verification |
|---|---|---|
| AC-001 PC loss | PARTIAL | Supabase durable schema, tenant APIs and export state exist; second-device cloud session test requires quality Supabase credentials. |
| AC-002 provider switch | PASS | Binding-preserving agent registry plus OpenAI, Anthropic and OpenAI-compatible adapter contract tests with native payload/header, SSE and normalized usage coverage. |
| AC-003 parallel frontend/backend | PASS | `WorkflowRunner` executes disjoint scopes concurrently, serializes overlapping scopes, and persisted Lead tasks retain read/write scope and parallel-group metadata; Git artifact tests preserve isolated workspaces. |
| AC-004 dependency serialization | PASS | `WorkflowRunner` DAG test proves dependent task waits for both prerequisites. |
| AC-005 review loop | PASS | Reviewer finding creates a persisted review report, deterministic fix tasks and the package-level re-review loop blocks until pass. |
| AC-006 quota interruption | PARTIAL | Fake quota resume, provider-session resume, lease reclaim, concrete pg-boss v12 adapter with deterministic explicit retries, queue initialization, local PostgreSQL send/fetch/complete smoke, local two-process crash/restart smoke and persistent worker composition are tested; the same restart scenario with the configured quality database still requires quality execution. |
| AC-007 budget hard stop | PASS | Workflow budget test confirms provider handler is not invoked when estimate exceeds remaining budget. |
| AC-008 design gate | PASS | Design submission/owner approval API test and immutable version policy; exercised by `tests/e2e/api-acceptance.spec.ts`. |
| AC-009 protected self-improvement | PARTIAL | Studio Labs UI/API creates protected task+Owner approval and the server gate requires reviewer, CI, Owner and human actor; GitHub branch/check-run/PR adapter and webhook boundary are tested, while the real GitHub/CI quality integration still needs credentials. |
| AC-010 memory scaling | PASS | Bounded relevance retrieval/provenance test; full archive is not passed to context; API search exercised by `tests/e2e/api-acceptance.spec.ts`. |
| AC-011 push notification | PARTIAL | Payload/deep-link/service-worker tests, browser subscription flow, persisted per-category preferences, server-side VAPID adapter and worker pending-notification dispatcher tests pass; VAPID delivery and background-device test need quality credentials/device. |
| AC-012 export/import | PASS | Export/import routes and DB tests prove secrets are excluded, organization/task/dependency IDs are remapped and provider connections are marked reauth; imported tasks remain DRAFT. |
| AC-013 local worker | PARTIAL | Registry, deterministic capability/scope/concurrency scheduler, heartbeat tests, one-time registration-token issuance, server-side credential exchange, authenticated task claim/lease/reclaim/completion RPCs, daemon control-plane client and runtime pull loop are available; Ollama/LM Studio network smoke and end-to-end assignment/offline reassignment with a configured quality node still require external runtime execution. |
| AC-014 multiuser isolation | PASS | API cross-organization tests plus Supabase RLS migration verification; exercised by `tests/e2e/api-acceptance.spec.ts`. |

## Release blockers

The remaining `PARTIAL` rows are external quality verification or integrations whose credentials/runtimes are not available in this workspace. They must be run before changing `docs/ai/CURRENT_STATE.md` to `IMPLEMENTAZIONE COMPLETATA`.
