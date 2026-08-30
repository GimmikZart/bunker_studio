# Bunker Studio V1 acceptance matrix

Updated 2026-08-31. `PASS` means automated evidence is present in this repository. `PARTIAL` means the in-scope foundation is implemented but requires an external credential, device, provider or multi-process quality run. The latest local release check also covers agent registry management, notification preferences, Settings/provider visibility and the task state-machine UI, without changing the external-quality statuses below.

Checkpoint 2026-08-31: the local protected Studio Labs workflow now creates gated task/approval records and enforces reviewer, CI, Owner and human-actor requirements server-side; the Lead plan endpoint persists validated DAGs, task links, Definition of Done, read/write scopes and parallel-group metadata, including export/import round-trip; provider streaming preserves terminal usage-only events; AC-009 remains `PARTIAL` until the GitHub/CI quality integration is exercised.

| Criterion | Status | Evidence / remaining verification |
|---|---|---|
| AC-001 PC loss | PARTIAL | Supabase durable schema, tenant APIs and export state exist; second-device cloud session test requires quality Supabase credentials. |
| AC-002 provider switch | PASS | Binding-preserving agent registry plus OpenAI, Anthropic and OpenAI-compatible adapter contract tests with native payload/header, SSE and normalized usage coverage. |
| AC-003 parallel frontend/backend | PASS | `WorkflowRunner` executes disjoint scopes concurrently, serializes overlapping scopes, and persisted Lead tasks retain read/write scope and parallel-group metadata; Git artifact tests preserve isolated workspaces. |
| AC-004 dependency serialization | PASS | `WorkflowRunner` DAG test proves dependent task waits for both prerequisites. |
| AC-005 review loop | PASS | Reviewer finding creates a persisted review report, deterministic fix tasks and the package-level re-review loop blocks until pass. |
| AC-006 quota interruption | PARTIAL | Fake quota resume, provider-session resume, lease reclaim and persistent composition are tested; multi-process pg-boss restart requires a configured client. |
| AC-007 budget hard stop | PASS | Workflow budget test confirms provider handler is not invoked when estimate exceeds remaining budget. |
| AC-008 design gate | PASS | Design submission/owner approval API test and immutable version policy; exercised by `tests/e2e/api-acceptance.spec.ts`. |
| AC-009 protected self-improvement | PARTIAL | Studio Labs UI/API creates protected task+Owner approval and the server gate requires reviewer, CI, Owner and human actor; GitHub/CI quality integration still needs credentials. |
| AC-010 memory scaling | PASS | Bounded relevance retrieval/provenance test; full archive is not passed to context; API search exercised by `tests/e2e/api-acceptance.spec.ts`. |
| AC-011 push notification | PARTIAL | Payload/deep-link/service-worker tests and persisted per-category preferences pass; VAPID delivery and background-device test need quality credentials/device. |
| AC-012 export/import | PASS | Export/import routes and DB tests prove secrets are excluded, organization/task/dependency IDs are remapped and provider connections are marked reauth; imported tasks remain DRAFT. |
| AC-013 local worker | PARTIAL | Registry, heartbeat, capability and concurrency tests pass; API registration/heartbeat is exercised by `tests/e2e/api-acceptance.spec.ts`; Ollama/LM Studio network smoke requires a local runtime. |
| AC-014 multiuser isolation | PASS | API cross-organization tests plus Supabase RLS migration verification; exercised by `tests/e2e/api-acceptance.spec.ts`. |

## Release blockers

The remaining `PARTIAL` rows are external quality verification or integrations whose credentials/runtimes are not available in this workspace. They must be run before changing `docs/ai/CURRENT_STATE.md` to `IMPLEMENTAZIONE COMPLETATA`.
