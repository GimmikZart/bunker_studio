# Bunker Studio — Technical Specification

**Stato documento:** Implementation-ready / Approved  
**Versione:** 1.0  
**Ultimo aggiornamento:** 2026-08-30  
**Product Owner:** User  
**Technical authority:** questa specifica + documenti specialistici referenziati

---

# 1. Executive summary

Bunker Studio è un sistema cloud-first per creare e gestire organizzazioni virtuali composte da agenti AI persistenti e specializzati.

Obiettivo centrale: consentire a un utente di affidare progetti software a team di agenti che operano autonomamente per lunghi periodi, minimizzando il costo e richiedendo intervento umano solo per decisioni importanti.

La rappresentazione visuale è un ufficio virtuale professionale. L'ufficio è una vista dello stato reale del sistema, non una simulazione LLM.

Gli agenti sono identità persistenti. Il processo che li esegue è effimero. Un agente deve conservare nome, personalità, memoria, skill, tool, autorizzazioni, storico, metriche e relazioni anche se:
- cambia provider;
- cambia modello;
- cambia runtime;
- cambia worker;
- il PC dell'utente viene perso;
- un worker cloud viene riavviato.

---

# 2. Product principles — invarianti

## P-001 — User owns the company

Configurazione, storico, agenti, memorie, decisioni e skill devono essere esportabili. I secret non devono essere esportati in chiaro.

## P-002 — Provider-independent identity

`Agent != Model`.

Il dominio core non può identificare un agente tramite un model ID.

## P-003 — Durable state

Nessuna operazione critica può dipendere esclusivamente dalla memoria RAM del worker o dalla chat di un provider.

## P-004 — Deterministic where possible

Calcoli, budget, scheduling, dependency resolution, retries, approval policy, presence e metriche devono essere deterministici.

## P-005 — LLMs where valuable

LLM per:
- planning/decomposition;
- implementation;
- design generation;
- review/analysis;
- summarization;
- conflict resolution.

Non LLM per:
- animazioni;
- counters;
- state transition enforcement;
- budget arithmetic;
- job retry timer.

## P-006 — Cheap workers, expensive escalation

Il sistema deve favorire modelli economici per lavoro ben circoscritto e usare modelli più capaci solo nei punti decisionali.

## P-007 — Human ownership of risk

Le policy di approvazione sono server-enforced.

## P-008 — Restartable

Ogni run deve essere:
- completabile;
- fallibile in modo esplicito;
- pausabile;
- riprendibile;
- auditabile.

---

# 3. Release strategy

## Release V1 — Functional Studio

Deve includere:
- Organization/Team/Project;
- agent creation/manual + HR recommendation;
- agent profile/personality;
- provider abstraction;
- OpenAI runtime;
- Anthropic runtime;
- OpenAI-compatible local runtime;
- Lead/Frontend/Backend/Reviewer/Designer/HR templates;
- orchestrator;
- parallel worker isolation;
- durable job queue;
- retry/quota pause/resume;
- project GitHub connection;
- task/dependency system;
- code review cycle;
- CI result ingestion;
- Designer proposal/approval/handoff;
- chat with each agent;
- meeting room;
- approval inbox;
- budget/cost tracking;
- Web Push;
- office home;
- activity/timeline;
- structured memory + searchable raw conversation archive;
- export/import;
- local worker registration;
- protected Studio self-improvement mode;
- PWA responsive.

## Release V1.1 — Hardening

- GitLab adapter;
- Figma integration;
- richer semantic retrieval;
- quality environment workflow;
- advanced provider failover;
- Tauri desktop shell;
- advanced analytics;
- team templates marketplace local/import-export.

## Future

- public marketplace;
- additional AI providers;
- remote human collaborators with granular task assignment;
- richer office rendering;
- audio/voice meetings;
- automatic optimization proposals under explicit user invocation.

---

# 4. Out of scope for V1

- 3D office;
- multiplayer avatar movement;
- autonomous production deploy of Bunker Studio core;
- automatic purchase of third-party API credits unless provider itself offers an explicit user-enabled mechanism;
- unsupported scraping of provider quota pages;
- storing plaintext provider secrets;
- training/fine-tuning foundation models;
- full project management replacement for Jira/Linear;
- unrestricted shell on user's local machine;
- autonomous security-sensitive changes without approval.

---

# 5. Primary roles

## Human roles

`OWNER`
- full control;
- approve protected actions;
- manage billing/provider secrets;
- export organization;
- invite/remove humans.

`ADMIN`
- manage teams/projects/agents;
- cannot transfer ownership or export secret material.

`MEMBER`
- collaborate according to permissions.

`VIEWER`
- read-only.

V1 may ship initially with Owner only in UI, but schema/RLS must support all roles.

## Agent role templates

- Lead Architect / Orchestrator;
- Frontend Engineer;
- Backend Engineer;
- Reviewer / QA / Security;
- Product Designer;
- HR / Staffing;
- generic Custom Agent.

Templates are editable and versioned.

---

# 6. Functional requirements

## Organization, team, project

| ID | Requirement | Acceptance |
|---|---|---|
| FR-001 | Create Organization | Owner sees new organization and default settings |
| FR-002 | Create Team | Team belongs to one Organization |
| FR-003 | Create Project | Project belongs to one Organization and can have one or more Teams |
| FR-004 | Archive instead of destructive delete by default | Archived entities disappear from active views and remain recoverable |
| FR-005 | Link Git repository | Project stores provider/repo/default branch metadata without plaintext tokens |

## Agents

| ID | Requirement | Acceptance |
|---|---|---|
| FR-010 | Create agent manually | Persisted identity with role/personality/provider binding |
| FR-011 | Edit agent name/avatar/personality | Change survives model/provider changes |
| FR-012 | Assign skills/tools/permissions | Runtime receives only authorized capabilities |
| FR-013 | Change provider/model | Agent ID/history/memory remain unchanged |
| FR-014 | Agent direct chat | User can chat without bypassing policy |
| FR-015 | Agent presence | Office reflects durable/derived runtime state |
| FR-016 | Agent metrics | Derived from event/task/cost data, no LLM needed |

## HR

| ID | Requirement | Acceptance |
|---|---|---|
| FR-020 | Team recommendation | HR returns structured staffing proposal |
| FR-021 | Explain model/effort/cost rationale | Each proposed role includes rationale |
| FR-022 | Human final approval | No agent created until user confirms |
| FR-023 | Manual override | User can modify every proposed field |

## Orchestration

| ID | Requirement | Acceptance |
|---|---|---|
| FR-030 | Lead creates plan | Plan is structured, validated and persisted |
| FR-031 | Dependency graph | Tasks have explicit dependencies |
| FR-032 | Safe parallelism | Independent tasks run concurrently in isolated workspaces |
| FR-033 | Sequential fallback | Conflicting scopes are serialized |
| FR-034 | Autonomous continuation | Next eligible task starts without user "continue" |
| FR-035 | Review loop | Failed review creates fix tasks and cycles again |
| FR-036 | Human gate | Required approvals pause workflow |
| FR-037 | Durable resume | Worker restart does not lose workflow |
| FR-038 | Provider quota resume | Quota failure becomes delayed/polling wait, not terminal failure |
| FR-039 | Budget enforcement | Hard cap prevents new paid runs |

## Development

| ID | Requirement | Acceptance |
|---|---|---|
| FR-040 | Frontend worker | Can implement scoped frontend task |
| FR-041 | Backend worker | Can implement scoped backend task |
| FR-042 | Work isolation | Concurrent writers cannot share mutable checkout |
| FR-043 | Verification | Task completion records executed checks |
| FR-044 | Merge preparation | Candidate diff/branch is reviewable |
| FR-045 | CI integration | Workflow consumes test/lint/typecheck/security results |

## Reviewer

| ID | Requirement | Acceptance |
|---|---|---|
| FR-050 | Read-only by default | Reviewer runtime lacks write permission |
| FR-051 | Structured findings | severity/category/location/evidence/recommendation |
| FR-052 | Security/performance/correctness/test review | categories explicitly evaluated |
| FR-053 | Pass/fail policy | critical/high findings block completion per policy |

## Designer

| ID | Requirement | Acceptance |
|---|---|---|
| FR-060 | Design proposal | 1–3 versioned variants with preview + spec |
| FR-061 | Approval workflow | Approve/Reject/Changes |
| FR-062 | Immutable approved version | Frontend task references exact design version |
| FR-063 | Design changes gate | Major design changes require owner |

## Meetings

| ID | Requirement | Acceptance |
|---|---|---|
| FR-070 | Create meeting | agenda, participants, project, type |
| FR-071 | Cost-bounded turn-taking | configured round limit enforced |
| FR-072 | Minutes | decisions/actions/task proposals |
| FR-073 | Meeting cost | aggregate run cost visible |

## Memory/history

| ID | Requirement | Acceptance |
|---|---|---|
| FR-080 | Store conversation archive | searchable historical messages |
| FR-081 | Structured memory | project knowledge/decision/lesson/pin |
| FR-082 | Context retrieval | only relevant memory is injected |
| FR-083 | Provenance | memory links to source message/run/artifact when available |
| FR-084 | Delete/correct memory | user can manage persistent memory |
| FR-085 | No full-history prompt | tests prevent naive full archive injection |

## Cost

| ID | Requirement | Acceptance |
|---|---|---|
| FR-090 | Cost ledger | usage attributed to run/task/agent/project/provider |
| FR-091 | Budgets | daily/monthly/task/run budget policies |
| FR-092 | Forecast | deterministic month forecast |
| FR-093 | Weekly report | configurable scheduled report |
| FR-094 | Escalation policy | expensive model use constrained by rules |

## Notifications

| ID | Requirement | Acceptance |
|---|---|---|
| FR-100 | In-app notifications | persisted and read/unread |
| FR-101 | Web Push | approval/security/budget/quota critical notification |
| FR-102 | Notification preferences | per category |
| FR-103 | Deep links | push opens relevant entity |

## Provider/local

| ID | Requirement | Acceptance |
|---|---|---|
| FR-110 | OpenAI adapter | run + stream + resume |
| FR-111 | Anthropic adapter | run + stream + resume |
| FR-112 | OpenAI-compatible adapter | local/remote compatible endpoints |
| FR-113 | Capability catalog | model capability metadata |
| FR-114 | Local worker | heartbeat/capabilities/job execution |
| FR-115 | Provider switch | identity preserved |

## Portability

| ID | Requirement | Acceptance |
|---|---|---|
| FR-120 | Organization export | data/config/memories/history/assets metadata |
| FR-121 | Import | creates equivalent organization with remapped IDs |
| FR-122 | No plaintext secrets export | verified |
| FR-123 | Virgin template export | infrastructure/config/template without tenant data |

## Self-improvement

| ID | Requirement | Acceptance |
|---|---|---|
| FR-130 | Studio as project | own repo can be linked |
| FR-131 | Protected mode | dedicated policy automatically enabled |
| FR-132 | No auto production merge/deploy | hard server rule |
| FR-133 | Owner approval | required before protected merge |
| FR-134 | Manual improvement session | user can ask agents to analyze Studio metrics and propose work |

---

# 7. Non-functional requirements

## Reliability

- Every state transition must be transactionally persisted.
- Job execution is at-least-once; handlers must be idempotent.
- A worker process termination must not lose a queued task.
- A running job abandoned due to worker death must be reclaimable.
- External side effects require idempotency keys where supported.

## Performance

Initial targets:
- normal page server response p95 < 800 ms excluding provider calls;
- realtime event to connected UI p95 < 2 s;
- task scheduling after dependency completion < 5 s;
- approval action reflected < 2 s;
- office animation 60fps target on modern desktop, gracefully reduced on mobile.

## Security

- RLS for tenant data.
- Service-role credentials server/worker only.
- Provider secrets encrypted at rest at application layer.
- Audit log append-only semantics.
- Protected actions checked server-side.
- Reviewer AI never substitutes deterministic security tooling.

## Accessibility

- WCAG 2.2 AA target for core workflows.
- Office interactions must have non-visual equivalent list/navigation.
- Keyboard accessible approvals/chat/settings.

## Observability

Every run/task/job must have:
- `correlation_id`;
- structured logs;
- duration;
- result;
- provider/model;
- cost metadata when available;
- retry count.

---

# 8. Autonomy policy

Default project mode: `AUTONOMOUS`.

Approval required regardless of mode (except explicit owner-configured sandbox LAB where applicable, but production/destructive security boundaries remain protected):
1. projected spend crosses hard/user confirmation threshold;
2. product requirement change;
3. approved design replacement;
4. critical security decision;
5. destructive data operation;
6. permission escalation;
7. production deploy;
8. protected Bunker Studio self-modification merge.

The runtime must not rely on an agent "remembering" these rules.

---

# 9. Cost policy

## Model tier abstraction

Do not hardcode Sol/Terra/Luna semantics into core.

Define:
- `ECONOMY_WORKER`;
- `BALANCED_REVIEWER`;
- `PREMIUM_REASONER`.

Provider bindings map tiers to concrete models.

Initial OpenAI recommended mapping is configurable, not invariant.

## Default routing intent

Lead:
- premium only when decomposition/architecture/escalation requires it;
- otherwise balanced allowed for routine coordination.

Frontend/Backend:
- economy worker first.

Reviewer:
- balanced reviewer.

Designer:
- economy/balanced depending output modality.

HR:
- economy/balanced.

## Escalation

A task may escalate after:
- two failed implementation attempts;
- repeated test failure with no progress;
- reviewer finding requires architectural reasoning;
- conflicting agent proposals.

Escalation must create a ledger event.

## Hard budget

Before starting a paid run:
`estimated_minimum_cost <= remaining_hard_budget`.

If not:
- transition to `WAITING_BUDGET_APPROVAL`;
- notify user;
- do not call provider.

---

# 10. Memory and context

Raw messages are persisted in DB and may be archived to object storage if scale requires.

Context builder input:
- agent identity/personality;
- agent role instructions;
- current task;
- relevant technical/product documents;
- explicit dependencies/handoffs;
- pinned decisions;
- retrieved project memories;
- last bounded conversation window;
- summary of older relevant context.

Never:
- inject full organization history;
- inject unrelated team chatter;
- inject raw logs when summary/evidence references suffice.

Semantic retrieval:
- V1 must support PostgreSQL FTS.
- `pgvector` support must be included in schema/interface.
- Embeddings are generated only for durable knowledge units (decisions, summaries, docs, lessons), not automatically for every message.
- Embedding provider is configurable and can be local.

Conversation archive storage has negligible token cost by itself. Token cost is incurred only when text is sent to a model.

---

# 11. Quota, rate limit and autonomous resume

This is a mandatory core capability.

Provider errors must normalize to:
- `RATE_LIMIT_TEMPORARY`;
- `QUOTA_EXHAUSTED_RESETTABLE`;
- `CREDITS_EXHAUSTED`;
- `AUTH_ERROR`;
- `PROVIDER_OUTAGE`;
- `CONTENT/SAFETY_BLOCK`;
- `UNKNOWN_PROVIDER_ERROR`.

## Temporary rate limit

- exponential backoff with jitter;
- respect provider `retry-after` when available;
- max rapid retry window 15 minutes;
- then delayed retry.

## Resettable quota

On quota exhaustion:
1. persist provider/session/thread/run identifiers;
2. commit partial task state if safe;
3. transition run/task to `WAITING_PROVIDER_QUOTA`;
4. compute `next_retry_at` from provider reset metadata when available;
5. otherwise use progressive polling schedule: 15m, 30m, 60m, then hourly;
6. scheduler enqueues a lightweight availability probe, not a full run;
7. when availability returns, resume same provider session when adapter supports it; otherwise start a new session with persisted handoff;
8. continue workflow automatically.

No user "continue" is required.

## Credits exhausted

Default:
- pause;
- notify owner;
- do not auto-purchase credits from Bunker Studio.

If provider account itself has user-enabled auto-reload outside Bunker Studio, the next probe may naturally succeed.

Optional fallback:
- if `allow_provider_fallback=true`, scheduler may route to an approved alternative that satisfies task capability/security constraints and budget.
- fallback must be logged and must not silently downgrade protected security review.

## Consumer subscription limits

Support is best-effort when the underlying runtime authenticates through a consumer subscription with opaque quotas. Guaranteed unattended operation should use metered API/provider credentials or runtimes exposing machine-readable quota/retry state.

The architecture must therefore never depend on a fixed "5-hour window" implementation detail.

---

# 12. Code work isolation

Each code-writing task receives:
- repository URL;
- base commit SHA;
- dedicated workspace;
- dedicated branch;
- declared read scope;
- declared write scope;
- allowed commands/tools.

Branch convention:
`bunker/<project-slug>/<task-id>-<slug>`.

Parallel tasks are allowed only if:
- no unresolved dependency path between them;
- write scopes do not overlap OR tasks run in separate workspaces and merge ordering is explicitly planned;
- shared contract is frozen/versioned.

The Lead returns `parallel_group_id`; control plane validates actual dependency constraints.

Reviewer operates against immutable candidate SHA/diff.

---

# 13. Definition of task complete

A coding task is `IMPLEMENTED` only when:
- code is written;
- required tests added/updated;
- declared verification commands executed;
- results persisted;
- no known failing check caused by task;
- handoff artifact generated.

`DONE` requires downstream review/merge policy.

---

# 14. Reviewer policy

Review dimensions:
1. correctness;
2. security;
3. regression risk;
4. performance;
5. maintainability;
6. tests;
7. specification compliance.

Finding schema:
- id;
- severity: `INFO|LOW|MEDIUM|HIGH|CRITICAL`;
- category;
- title;
- description;
- evidence;
- file/path/symbol;
- recommendation;
- blocking boolean;
- confidence.

Default block:
- any `CRITICAL`;
- any `HIGH`;
- specification mismatch;
- failing deterministic gate.

Reviewer sandbox read-only by default.

---

# 15. CI/security gates

Minimum:
- formatter check;
- lint;
- TypeScript typecheck;
- unit tests;
- integration tests;
- build;
- Playwright E2E critical paths;
- dependency vulnerability scan;
- secret scan;
- SAST baseline.

Suggested tooling:
- ESLint;
- Prettier;
- Vitest;
- Playwright;
- Gitleaks;
- OSV-Scanner;
- Semgrep Community rules.

CI results are first-class entities and may be consumed by Reviewer.

---

# 16. Notification policy

Push-worthy default:
- approval required;
- critical/high security issue;
- hard budget reached;
- provider quota causes long pause;
- workflow blocked > configurable duration;
- release candidate ready.

Do not push:
- every task start;
- normal subagent completion;
- low-severity review notes.

---

# 17. Self-improvement

When Project has `is_studio_core=true`:
- protected policy auto-attached;
- branch from protected base;
- no direct write to protected branch;
- no production deploy tool;
- DB destructive migrations require Owner approval;
- Reviewer mandatory;
- CI mandatory;
- Owner approval mandatory before merge;
- no agent can approve own protected request.

Studio Labs workflow:
1. user initiates analysis;
2. Lead receives selected metrics/feedback;
3. agents propose improvements;
4. user selects;
5. normal protected development flow;
6. review/CI;
7. owner merge approval.

The system may calculate potential optimization signals automatically, but must not invoke expensive periodic "self reflection" unless enabled.

---

# 18. Export/import

Export format is versioned.

Package:
- `manifest.json`;
- `organization.json`;
- `teams.jsonl`;
- `projects.jsonl`;
- `agents.jsonl`;
- `agent_templates.jsonl`;
- `skills/`;
- `memories.jsonl`;
- `decisions.jsonl`;
- `meetings.jsonl`;
- `tasks.jsonl`;
- `conversations/` or archive references;
- `artifacts/` optional;
- `cost-ledger.jsonl`;
- `settings.json`.

Never include:
- plaintext API keys;
- OAuth refresh tokens;
- server master encryption key.

Import must:
- validate schema version;
- generate new tenant-local IDs;
- preserve logical relationships via mapping;
- mark provider connections `REQUIRES_REAUTH`.

Virgin export:
- app config/schema/templates;
- no user/organization data;
- no memories/history;
- no secrets.

---

# 19. Environment strategy

## Local development

- Docker;
- Supabase local stack;
- local object storage as provided by Supabase;
- mock/fake providers;
- optional Ollama;
- local web/worker.

## Quality

Separate Supabase project and application deployment.
Real provider tests only behind explicit test budget and labels.

## Production

Separate Supabase project.
Separate app/worker deployments.
No shared database/secret between quality and production.

Environment variables validated at startup.

---

# 20. Deployment target

Reference managed deployment:
- Web/API: Vercel;
- Worker: Railway;
- Database/Auth/Storage/Realtime: Supabase;
- Git/CI: GitHub + GitHub Actions.

This is the initial supported path, not a domain invariant.

Self-host path:
- Docker images for web and worker;
- PostgreSQL-compatible DB;
- S3-compatible object storage adapter if Supabase Storage unavailable;
- configurable public URLs.

V1 must produce Dockerfiles even if managed deployment is primary.

---

# 21. Initial monorepo

Required:

```text
/
├─ apps/
│  ├─ web/
│  └─ worker/
├─ packages/
│  ├─ contracts/
│  ├─ core/
│  ├─ db/
│  ├─ orchestration/
│  ├─ agent-runtime/
│  ├─ provider-openai/
│  ├─ provider-anthropic/
│  ├─ provider-openai-compatible/
│  ├─ git/
│  ├─ notifications/
│  ├─ observability/
│  └─ ui/
├─ supabase/
│  ├─ migrations/
│  ├─ seed.sql
│  └─ config.toml
├─ docs/
├─ tests/
└─ .github/workflows/
```

Toolchain:
- Node.js 24 LTS;
- TypeScript strict;
- pnpm workspaces;
- Turborepo;
- Next.js App Router;
- React;
- Tailwind CSS;
- Radix/shadcn-compatible component primitives;
- Motion for restrained UI animation;
- Supabase JS;
- Zod;
- pg-boss;
- Vitest;
- Playwright.

Use current compatible stable minor/patch versions at implementation time; pin lockfile.

---

# 22. API style

Internal HTTP endpoints:
- REST/route handlers for commands/query not covered by realtime;
- SSE for provider/run streaming where appropriate;
- Supabase Realtime for persisted state/activity updates.

All mutation endpoints:
- authenticated;
- organization authorization;
- Zod validation;
- idempotency support where externally retried;
- correlation ID.

Provider events are normalized before entering UI.

---

# 23. Event model

All meaningful domain events append to `domain_events`.

Examples:
- `agent.created`;
- `agent.binding.changed`;
- `task.created`;
- `task.started`;
- `task.waiting_quota`;
- `task.completed`;
- `review.failed`;
- `approval.requested`;
- `approval.resolved`;
- `meeting.started`;
- `design.approved`;
- `budget.threshold_reached`;
- `worker.online`;
- `worker.offline`.

Office/timeline consume these events and current projections.

---

# 24. Security boundaries

Trust boundaries:
1. browser ↔ app server;
2. app server ↔ database;
3. worker ↔ database;
4. worker ↔ provider API;
5. worker ↔ Git provider;
6. cloud control plane ↔ local worker;
7. agent ↔ executable tools.

Never expose service role key/browser.
Never expose provider secret to an agent unless tool/runtime requires it; prefer server-side proxy/harness.
Tool permissions are capability-based.

---

# 25. Acceptance criteria — release V1

A release candidate is acceptable only if all scenarios pass.

## AC-001 — PC loss scenario
1. Create organization/team/project/agents.
2. Run tasks and conversations.
3. Close browser.
4. Access from a second device.
5. All durable state is present.

## AC-002 — Provider switch
1. Agent has history/memory.
2. Change model/provider binding.
3. Agent ID/profile/memory/history remain.
4. New run uses new provider.

## AC-003 — Parallel frontend/backend
1. Lead creates independent frontend/backend tasks.
2. Both execute concurrently in isolated workspaces.
3. No shared mutable checkout.
4. Results merge/reconcile through explicit flow.

## AC-004 — Dependency serialization
1. Backend task depends on schema task.
2. Scheduler does not start backend before dependency passes.

## AC-005 — Review feedback loop
1. Reviewer reports blocking finding.
2. Task does not close.
3. Lead/fix workflow produces follow-up.
4. Reviewer/CI re-run.
5. Task closes only after pass.

## AC-006 — Quota interruption
1. Provider adapter fake returns `QUOTA_EXHAUSTED_RESETTABLE`.
2. Run persists and transitions `WAITING_PROVIDER_QUOTA`.
3. Worker process is restarted.
4. scheduler retry fires.
5. fake provider becomes available.
6. run resumes automatically.
7. no manual "continue".

## AC-007 — Budget hard stop
1. Project hard budget below needed estimate.
2. No provider call occurs.
3. approval/budget alert created.

## AC-008 — Design gate
1. Designer submits proposal.
2. Frontend implementation cannot start on gated screen without approved version.
3. User approves.
4. implementation task receives immutable design artifact ref.

## AC-009 — Protected self-improvement
1. Link Bunker Studio repo.
2. project is marked core.
3. agents implement candidate.
4. CI + reviewer pass.
5. merge still blocked until Owner approval.

## AC-010 — Memory scaling
1. Seed large conversation archive.
2. New agent run context builder selects bounded relevant items.
3. full archive is not sent.

## AC-011 — Push notification
1. Create approval while browser not foreground.
2. push generated for subscribed client.
3. deep link opens approval.

## AC-012 — Export/import
1. Export organization.
2. verify no plaintext secret.
3. import into clean instance.
4. agents/teams/projects/memory/history relationships restored.
5. provider connections require reauth.

## AC-013 — Local worker
1. register local node;
2. heartbeat online;
3. advertise compatible model;
4. eligible task assigned;
5. node offline;
6. no new task assigned until reconnect.

## AC-014 — Multiuser isolation
Cross-organization access attempts fail at RLS/API level.

---

# 26. Definition of Done — project

- [ ] All FR required for V1 implemented.
- [ ] All AC-001..AC-014 automated where feasible and manually verified where browser/device integration requires.
- [ ] Unit/integration/E2E test suites green.
- [ ] Security checks green or accepted findings documented.
- [ ] RLS policies have isolation tests.
- [ ] Provider adapters have contract tests with fakes.
- [ ] Quota resume test survives worker restart.
- [ ] Export/import round-trip test passes.
- [ ] Docker local setup documented and reproducible.
- [ ] Quality deployment documented.
- [ ] Production deployment documented.
- [ ] No secrets in repository.
- [ ] Backup/restore procedure documented and tested on quality.
- [ ] `CURRENT_STATE.md` updated.
- [ ] `NEXT_STEPS.md` contains no required in-scope implementation.
