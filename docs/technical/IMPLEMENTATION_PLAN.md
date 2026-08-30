# Bunker Studio — Implementation Plan

Questo piano stabilisce l'ordine di implementazione. L'agente procede automaticamente alla milestone successiva quando la Definition of Done locale è soddisfatta.

Non saltare una milestone se una successiva dipende da essa. È consentito implementare in parallelo attività interne alla milestone quando non confliggono.

# M0 — Repository & Toolchain

Implementare:
- Git/monorepo pnpm + Turborepo;
- `apps/web`, `apps/worker`;
- package previsti;
- TypeScript strict;
- ESLint/Prettier;
- Vitest;
- Playwright scaffold;
- env validation con Zod;
- Supabase local scaffold;
- Dockerfiles;
- GitHub Actions base;
- health endpoints.

DoD:
- clean install;
- lint/typecheck/test/build PASS;
- web/worker avviabili localmente;
- README setup.

# M1 — Auth, Tenancy & Core Data

Implementare:
- Supabase Auth;
- profiles;
- organizations;
- organization_members;
- teams;
- projects;
- RLS;
- app shell/navigation;
- Owner onboarding.

DoD:
- signup/login;
- create org/team/project;
- cross-tenant RLS tests;
- responsive base UI.

# M2 — Agent Registry & Office V1

Implementare:
- agents;
- assignments;
- bindings;
- skills/tools metadata;
- agent CRUD;
- role/personality;
- avatar selector statico;
- office 2D responsive;
- status projection;
- agent detail;
- activity events baseline.

DoD:
- create/edit/archive agent;
- provider binding placeholder;
- office status derived without LLM;
- direct agent detail navigable.

# M3 — Provider Abstraction

Implementare:
- `AgentRuntime` contract;
- fake runtime deterministic;
- model catalog;
- provider connections + encrypted secrets;
- OpenAI adapter;
- Anthropic adapter;
- OpenAI-compatible adapter;
- provider/session persistence;
- streaming normalized events.

Order:
1. fake;
2. OpenAI;
3. Anthropic;
4. compatible/local endpoint.

DoD:
- same contract suite passes per adapter;
- start/resume/cancel/probe where provider capabilities allow;
- provider-specific types do not leak into core/UI;
- real smoke tests gated by env + budget flag.

# M4 — Durable Queue & Orchestration

Implementare:
- pg-boss;
- outbox;
- tasks/dependencies/workflows;
- deterministic state machine;
- scheduler/reconciliation;
- task attempts;
- leases;
- quota/rate error normalization;
- `WAITING_PROVIDER_QUOTA`;
- delayed availability probe;
- resume payload;
- budget preflight skeleton.

DoD:
- fake multi-step workflow completes with no user continue;
- worker restart test passes;
- quota interruption/resume AC-006 passes;
- dependency DAG enforced.

# M5 — Lead + Engineering Workers + Git

Implementare:
- structured Lead contract;
- Frontend/Backend role templates;
- GitHub repository connection;
- ephemeral workspaces;
- branch/worktree isolation;
- code task runner;
- verification artifact recording;
- safe parallelism validator.

DoD:
- Lead decomposes a test project;
- two independent fake/real coding tasks run concurrently;
- overlapping scope serializes;
- branches/diffs preserved.

# M6 — CI + Reviewer Loop

Implementare:
- verification runs;
- CI ingestion;
- reviewer read-only role;
- structured findings;
- blocking policy;
- fix workflow;
- GitHub PR/status integration;
- baseline security scan integration.

DoD:
- failing review produces fix task;
- loop repeats;
- completion blocked until deterministic + reviewer gates pass.

# M7 — Designer Workflow

Implementare:
- design requests/versions;
- Designer agent contract;
- preview artifact storage;
- generated/static HTML mock support;
- approve/reject/request changes;
- immutable approved version;
- frontend design gate.

DoD:
- AC-008 passes end-to-end.

# M8 — HR + Team Builder

Implementare:
- HR role;
- staffing proposal schema;
- model/cost/capability input;
- suggested team UI;
- manual edits;
- explicit hire confirmation;
- manual agent creation retained.

DoD:
- no recommended agent is persisted before confirmation.

# M9 — Meetings

Implementare:
- meeting entities/UI;
- participant selection;
- agenda;
- bounded rounds;
- parallel contribution jobs;
- context distillation;
- minutes;
- decisions/action/task proposals;
- meeting cost.

DoD:
- Architecture meeting with 3 agents produces minutes/actions under round cap.

# M10 — Memory & Search

Implementare:
- conversations/messages;
- full-text search;
- structured memories;
- decisions;
- provenance;
- context builder;
- bounded recent history;
- summary jobs;
- pgvector-ready layer;
- optional semantic indexing.

DoD:
- AC-010 passes;
- query "perché abbiamo deciso X?" finds structured decision/source;
- no raw archive dumped into model context.

# M11 — Cost Center, Budgets & Notifications

Implementare:
- cost ledger;
- budget policies;
- preflight budget gate;
- deterministic reports/forecast;
- quota UI;
- notifications;
- Web Push/PWA;
- approval inbox;
- deep links.

DoD:
- hard cap prevents provider invocation;
- weekly report generated;
- AC-011 passes on supported browser.

# M12 — Local Worker

Implementare:
- node registration token;
- node credentials;
- pull-based job delivery;
- heartbeat;
- capability advertising;
- local OpenAI-compatible/Ollama/LM Studio support;
- scopes/concurrency;
- offline handling.

DoD:
- AC-013 passes.

# M13 — Export / Import / Multiuser Foundations

Implementare:
- versioned export;
- import ID remap;
- secrets excluded;
- virgin template export;
- Admin/Member/Viewer RLS/API foundations;
- invitations if feasible within V1 UI.

DoD:
- AC-012 and AC-014 pass.

# M14 — Protected Self-Improvement

Implementare:
- `is_studio_core`;
- protected policies;
- Studio Labs UI/action;
- metrics snapshot;
- improvement proposal workflow;
- mandatory reviewer/CI/Owner merge gate;
- hard prohibition auto production deploy.

DoD:
- AC-009 passes.

# M15 — Hardening & Release

Implementare/verificare:
- complete E2E suite;
- accessibility audit core flows;
- performance smoke;
- security scan;
- backup/restore quality drill documentation;
- quality deployment;
- production deployment docs;
- seed/demo data;
- error states;
- responsive pass;
- clean install from empty environment.

DoD:
- AC-001..AC-014 PASS;
- project Definition of Done PASS;
- handoff final.
