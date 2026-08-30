# Development Worklog

Storico append-only.

## 2026-08-30 — Persistenza production dei verticali

### Lavoro svolto

- Aggiunto adapter Supabase SSR/RLS-aware per design versions, memorie, meetings/minutes, approval, cost ledger, notifiche/push, repository metadata e worker registry.
- Corretto il bypass production nei PATCH di team/progetto e nella staffing confirmation.
- Aggiunti vincoli SQL per costo meeting, capacità/concorrenza worker, upsert push/repository e isolamento tenant delle design versions.

### Verifiche

- `pnpm typecheck`: PASS, 15 package task.
- `pnpm lint`: PASS, 15 package task.
- `supabase db reset --local`: PASS, migrations 00000000000000..06.
- `pnpm exec playwright test tests/e2e/api-acceptance.spec.ts`: PASS, 4 scenari.

### Prossimo passo

Comporre il provider runtime production e persistere conversations/messages con RLS; i provider reali restano subordinati a credenziali quality.

## 2026-08-30 — Acceptance E2E e operational API slices

### Lavoro svolto

- Reso lo store fixture condiviso tra i route bundle Next tramite `globalThis`, mantenendo la separazione tenant.
- Aggiunte API per meeting/minutes, approvals, cost ledger/report, notification inbox/subscription e repository metadata.
- Aggiunti contratti Zod, E2E API per tenancy, design, staffing, memory, worker e operations.
- Rafforzato il workflow con budget cumulativo sui task concorrenti.
- Aggiunti trigger Supabase per profilo utente e membership Owner, contesto Docker workspace e runbook quality/production.
- Aggiunto `SupabaseTenancyRepository` con client SSR/RLS-aware e fallback fixture limitato a non-production per organizzazioni, team, progetti e membri.
- Aggiunto `SupabaseAgentRepository`, RPC atomiche per creazione/switch binding provider e route agenti production-aware.

### Verifiche

- `pnpm verify`: PASS; formatter, lint, typecheck, 21 task di test, build e audit.
- `pnpm test:e2e`: PASS, 8 scenari.
- `supabase db reset --local`: PASS; migration trigger applicata.
- Query locale: 45 policy pubbliche, 38 tabelle RLS-enabled, trigger tenancy e funzione claim outbox presenti.

### Stato finale della sessione

Acceptance locale stabilizzata. Prossimo passo: eseguire in quality le righe `PARTIAL` della matrice con credenziali/device/runtime espliciti.

Nota di handoff: gli endpoint web sono ancora in-memory in sviluppo e devono
essere cablati al repository Supabase autenticato prima della verifica
multi-processo quality.

## 2026-08-30 — Sessione 1 — Product & architecture definition

### Lavoro svolto

- Definito il prodotto Bunker Studio.
- Definiti requisiti UX e organizzativi.
- Definita architettura tecnica cloud-first e provider-independent.
- Definito runtime agentico durable con resume automatico.
- Definite policy di costo, memoria, approvazione, self-improvement e portabilità.
- Specializzato lo scaffolding AI-first per l'implementazione.

### File principali modificati

- `AGENTS.md`
- `README.md`
- `docs/product/PRODUCT_UX.md`
- `docs/technical/TECHNICAL_SPECIFICATION.md`
- `docs/technical/ARCHITECTURE.md`
- `docs/technical/AGENT_RUNTIME.md`
- `docs/technical/DATA_MODEL.md`
- `docs/technical/SECURITY_AND_OPERATIONS.md`
- `docs/ai/*`

### Verifiche

- Coerenza documentale: da verificare prima del handoff definitivo.
- Build/test applicativi: N/A.

### Problemi emersi

Nessuno.

## 2026-08-30 — Acceptance smoke, persistent outbox e worker composition

### Lavoro svolto

- Aggiunti `SupabaseOutboxRepository` e funzione SQL atomica `claim_outbox_event` con `FOR UPDATE SKIP LOCKED`.
- Collegati `PgBossQueue`, `AsyncOutboxDispatcher` e composition root `createPersistentWorker`.
- Aggiunti direct chat fake/runtime endpoint, memory delete, weekly cost report, design max 3 versioni e test reviewer fix loop.
- Aggiunti E2E browser per onboarding, login/signup, manifest/service worker oltre all'health check.

### Verifiche

- Format, lint, typecheck, unit/integration test e build: PASS.
- Playwright: 4 test PASS.
- Supabase `db reset --local`: PASS; query schema: 45 policy pubbliche, 38 tabelle RLS-enabled, funzione outbox presente.
- `pnpm audit --audit-level high`: PASS.

### Problemi emersi

- Il client pg-boss concrete e le credenziali cloud/provider/VAPID/GitHub restano configurazione quality; la composition root accetta client iniettati e non contiene secret.
- La matrice acceptance AC-001..AC-014 va ancora chiusa con fixture E2E/integration e procedura manuale per le parti esterne.

## 2026-08-30 — M4-M14 vertical slices e hardening

### Lavoro svolto

- Aggiunti lease/reclaim, adapter pg-boss contract-first, outbox dispatcher, worker loop e workflow DAG deterministico con hard budget gate.
- Aggiunti contratti Lead/verification/review, Git workspace/artifact adapter, bounded meeting runner e worker registry con capability/concurrency.
- Aggiunti API design/owner approval, staffing proposal/confirmation, membri/CRUD tenancy, memory bounded search, PWA service worker e push adapter con deep-link.
- Corretto onboarding per non usare fixture identity in produzione; aggiunta policy RLS service-role-only per outbox.

### Verifiche

- Typecheck, test mirati e lint: PASS dopo le correzioni.
- Supabase `db reset --local`: PASS con tutte le migration.
- Playwright health E2E: PASS.
- `pnpm audit --audit-level high`: PASS, nessuna vulnerabilità nota.

### Problemi emersi

- Il client pg-boss/Supabase persistente deve ancora essere cablato nell'app worker; gli adapter sono pronti e testabili con fake.
- La suite E2E completa AC-001..AC-014 e le integrazioni cloud quality richiedono ulteriori implementazioni/credenziali.

### Stato finale della sessione

Specifiche pronte. Prossimo passo: Milestone M0.

## 2026-08-30 — Bootstrap M0

### Lavoro svolto

- Creato monorepo pnpm/Turborepo con app web e worker.
- Aggiunti package condivisi, configurazione TypeScript strict, ESLint, Prettier, Vitest e Playwright.
- Aggiunti env schema Zod, scaffold Supabase, Dockerfile e CI.
- Creata shell Office responsive e health endpoint web; worker con heartbeat.

### File principali modificati

- `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `turbo.json`
- `apps/web/**`, `apps/worker/**`, `packages/**`
- `supabase/**`, `.github/workflows/ci.yml`, `docs/SETUP.md`

### Verifiche

- Format check, lint, typecheck, unit test e build: PASS.
- Playwright health E2E: PASS.
- Smoke web health e worker heartbeat: PASS.

### Stato finale della sessione

M0 completata. Prossimo passo: M1 — Auth, Tenancy & Core Data.

## 2026-08-30 — M1–M4 foundations e hardening domain

### Lavoro svolto

- Implementati tenancy store autorizzato, agent registry, binding-preserving identity, API organizations/agents e onboarding.
- Aggiunte migrazioni Supabase per tenancy, domain tables, pgvector-ready memory e RLS policies.
- Implementati runtime contract, fake quota-aware, HTTP normalized runtime e adapter contract tests.
- Implementati task transitions, dependency scheduler, safe parallelism, quota retry/resume, bounded meeting context e review/design/HR gates.
- Implementati bounded memory retrieval, cost forecast, push policy, worker registration/eligibility, export/import ID remap, provider secret encryption e protected self-improvement policy.
- Aggiunte pagine web base per agents, projects, teams, approvals, meetings, costs, activity e settings.

### File principali modificati

- `packages/core/**`, `packages/contracts/**`, `packages/db/**`, `packages/agent-runtime/**`
- `packages/orchestration/**`, `packages/git/**`, `packages/notifications/**`, `packages/observability/**`
- `packages/provider-*/*`, `apps/web/app/**`, `supabase/migrations/**`
- `docs/ai/CURRENT_STATE.md`, `docs/ai/NEXT_STEPS.md`

### Verifiche

- Format check: PASS.
- Lint: PASS dopo ignore dei file generati Next/dist.
- Typecheck: PASS.
- Test package: PASS; 20 task Turborepo, inclusi quota, tenancy, encryption, memory, export/import e provider contracts.
- Build: PASS; Next routes `/`, `/onboarding`, `/api/health`, `/api/organizations`, `/api/agents` generate correttamente.
- Supabase locale: migrazioni reset/start applicate e stack avviato su porte dedicate.

### Problemi emersi

- Supabase ha richiesto porte locali dedicate perché altri progetti Docker occupavano i default; configurato 55421–55427.
- Mancano ancora queue pg-boss/outbox dispatch, auth UI/sessione completa, CRUD end-to-end restante, workflow UI e suite E2E completa.

### Stato finale della sessione

Fondamenti M1–M4 e policy trasversali stabilizzati. Riprendere da `docs/ai/NEXT_STEPS.md` per completare Auth/sessione Supabase e CRUD tenancy.
