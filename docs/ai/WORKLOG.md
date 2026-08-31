# Development Worklog

## 2026-08-31 — GitHub/CI e Web Push VAPID adapter

- Aggiunto `@bunker-studio/git` adapter HTTP GitHub con branch creation, check-run CI normalizzati (`PASS`/`FAIL`/`PENDING`) e apertura di pull request; il token è iniettato solo negli header e non compare negli errori.
- Aggiunti test contract con trasporto `fetch` fake per branch, CI pending, pull request e sanitizzazione degli errori.
- Aggiunto `@bunker-studio/notifications` adapter server-only basato su `web-push` con VAPID runtime config, TTL/urgency deterministici e test senza rete.
- Aggiunto endpoint controllato per la VAPID public key e flusso Settings browser → service worker → `/api/notifications/subscribe`.
- Aggiunte variabili opzionali di configurazione per GitHub e Web Push; nessuna chiave è stata inserita nel repository.
- Verifiche mirate: Git 7 test/typecheck, Notifications 3 test/typecheck, Config test/typecheck, Web typecheck/build PASS.

Prossimo passo: eseguire gli scenari quality esterni `PARTIAL` con credenziali, device e runtime dedicati.

## 2026-08-31 — Protocollo credenziale local worker

- Aggiunta migrazione `00000000000014_worker_registration.sql` con token monouso, scadenza, scope/concurrency, RPC `exchange_worker_registration_token` e RPC `heartbeat_local_worker`.
- Aggiunti endpoint amministrativo per emettere il token e endpoint runtime separati per exchange e heartbeat con `Bearer` credential; il database conserva solo hash SHA-256 della credenziale.
- Aggiunti contratti Zod e test di validazione; il reset Supabase locale applica la migrazione senza errori.
- Smoke SQL locale: exchange token restituisce la credenziale una sola volta e heartbeat autenticato mantiene il nodo `ONLINE`; dati di prova rollbackati.

Prossimo passo: eseguire in quality il flusso AC-013 con un runtime Ollama/LM Studio e verificare assignment/offline reassignment.

## 2026-08-31 — Verifica sicurezza dopo le integrazioni

- `pnpm verify`: PASS completo sul tree corrente; installazione frozen, format, lint, typecheck, 24 task test, build e audit.
- `pnpm test:e2e`: 10/10 PASS in circa 3 minuti.
- Gitleaks Docker: PASS, 39 commit scansionati, nessun leak trovato.
- Semgrep Docker con ruleset JavaScript esplicito: nessun risultato terminale utile entro la finestra quality; resta `inconclusive`, non viene conteggiato come PASS.

Prossimo passo: eseguire gli scenari quality esterni `PARTIAL` con credenziali, device e runtime dedicati.

## 2026-08-31 — Daemon control-plane local worker

- Aggiunto `apps/worker/src/runtime-client.ts` con register tramite token monouso e heartbeat autenticato via `Bearer` credential.
- L’entrypoint worker usa il control plane quando configurato (`WORKER_CONTROL_PLANE_URL`, token oppure `WORKER_NODE_ID` + `WORKER_CREDENTIAL`) e conserva il comportamento heartbeat locale quando non configurato.
- Aggiunti test client e variabili Zod; Worker 7 test, typecheck e build PASS.

Prossimo passo: eseguire in quality il flusso AC-013 con un runtime Ollama/LM Studio e verificare assignment/offline reassignment.

Storico append-only.

## 2026-08-31 — Persistenza completa dei metadati Lead e usage SSE

### Lavoro svolto

- Persistiti `readScope` e `parallelGroupId` nei task locali/Supabase e nel percorso Lead; export/import mantiene i metadati con compatibilità per pacchetti precedenti.
- Corretto il mapper Supabase che leggeva erroneamente `write_scope_json` come read scope.
- Il runtime HTTP ora emette anche eventi SSE senza testo ma con usage; l’adapter Anthropic ricompone input/output usage provenienti da eventi distinti.

### Verifiche

- Test Lead workflow plan: 2/2 PASS.
- AgentRuntime: 6/6 PASS.
- Anthropic adapter: 2/2 PASS.
- Typecheck: 15/15 task PASS.

### Prossimo passo

Completare gli smoke quality esterni ancora `PARTIAL` quando saranno disponibili Supabase cloud, secondo device, GitHub/CI, VAPID/Web Push, pg-boss multi-process e runtime Ollama/LM Studio.

## 2026-08-31 — OpenAI-compatible SSE contract

### Verifiche

- Corretto l’adapter OpenAI-compatible per dichiarare e gestire realmente gli stream SSE; aggiunto contract test con chunk `delta` e terminazione `[DONE]`.
- Typecheck, lint, build e 3 test del package OpenAI-compatible: PASS.

### Prossimo passo

Eseguire smoke su Ollama/LM Studio in quality quando il runtime locale è disponibile.

## 2026-08-31 — Adapter provider nativi e streaming normalizzato

### Lavoro svolto

- Collegati al runtime web gli adapter OpenAI, Anthropic e OpenAI-compatible in base a `AGENT_PROVIDER_TYPE`.
- Implementati payload/header nativi, parsing delle risposte e stream SSE normalizzato in `AgentRuntime`, con usage provider-reported quando disponibile.
- Mantenuta la capability `resume` esplicita: il resume nativo viene usato solo quando l’adapter lo dichiara supportato; altrimenti il percorso quota riparte con una nuova sessione.

### Verifiche

- Contract test OpenAI, Anthropic e OpenAI-compatible: PASS.
- Test SSE/usage runtime: PASS.
- `pnpm verify`: PASS, lint/typecheck/test/build/audit; 24 task Turborepo.

### Prossimo passo

Eseguire gli smoke reali con credenziali provider e runtime quality; gli scenari `PARTIAL` restano vincolati a risorse esterne.

## 2026-08-31 — Verifica E2E completa aggiornata

### Verifiche

- `pnpm test:e2e`: PASS, 10/10 scenari, inclusi lo smoke responsive/accessibility e tutti i flussi API/UI precedenti.

### Prossimo passo

Eseguire AC-001 in quality con Supabase cloud e secondo dispositivo; i cinque scenari `PARTIAL` restano vincolati a risorse esterne.

## 2026-08-31 — Quality smoke responsive/accessibility

### Lavoro svolto

- Aggiunto `tests/e2e/quality-smoke.spec.ts` per verificare rendering, controlli interattivi nominati, assenza di errori pagina e overflow alle viewport desktop/mobile sulle pagine core.

### Verifiche

- `pnpm exec playwright test tests/e2e/quality-smoke.spec.ts`: PASS, 1/1.

### Prossimo passo

Eseguire l’audit manuale WCAG/device e gli scenari quality esterni quando saranno disponibili le risorse richieste.

## 2026-08-31 — Runner concorrente e resume sessione provider

### Lavoro svolto

- `WorkflowRunner` ora esegue in parallelo i task con scope disgiunti, applica il limite di concorrenza e serializza automaticamente i gruppi con scope sovrapposti.
- Gli errori quota che arrivano dopo `SESSION_STARTED` conservano il `sessionId`; il resume usa `AgentRuntime.resume`, con fallback a `start` quando la quota fallisce prima dell’apertura della sessione.
- Aggiunti test di concorrenza/scope e test di resume post-sessione.

### Verifiche

- `@bunker-studio/orchestration`: 19 test PASS.
- `@bunker-studio/agent-runtime`: typecheck, lint e test PASS.

### Prossimo passo

Eseguire AC-001 in quality con Supabase cloud e secondo dispositivo; i cinque scenari `PARTIAL` restano vincolati a risorse esterne.

## 2026-08-31 — Lead workflow plan persistito

### Lavoro svolto

- Aggiunto il contratto `leadPlanSubmissionSchema` e l’endpoint tenant-scoped `POST/GET /api/workflows/plan`.
- Validato il DAG Lead prima della materializzazione; le dipendenze vengono rimappate agli UUID persistiti in ordine topologico.
- Persistiti workflow, task DRAFT, `workflow_id` e Definition of Done strutturata nell’adapter locale e nel repository Supabase; aggiunta la migration `00000000000013_workflow_plan.sql`.

### Verifiche

- Test mirati workflow: PASS, 2 test.
- `pnpm verify`: PASS, format/lint/typecheck/test/build/audit.
- `supabase db reset --local`: PASS fino alla migration `00000000000013`.
- `pnpm test:e2e`: PASS, 9/9.

### Prossimo passo

Eseguire AC-001 in quality con Supabase cloud e secondo dispositivo; le verifiche `PARTIAL` restano bloccate da credenziali/runtime/device esterni.

## 2026-08-31 — Agent detail, activity e Studio Labs protetto

### Lavoro svolto

- Aggiunti assegnamenti agenti tenant-scoped con vincoli RLS su organizzazione, team, progetto e reporting agent; export/import conserva le relazioni con ID rimappati.
- Aggiunti endpoint e UI per dettaglio agente, assegnamenti, metriche deterministiche e activity append-only; gli eventi Supabase sono garantiti da trigger sulle tabelle di dominio.
- Aggiunto Studio Labs con inizializzazione Owner-only di Studio Core, analisi segnali, proposta selezionabile, task+approval persistiti e gate server-side reviewer/CI/Owner/human senza deploy production.

### Verifiche

- `pnpm verify`: PASS, format, lint/typecheck 15/15, 21 task test, build Next e audit high verdi.
- `supabase db reset --local`: PASS fino alle migration 00000000000012.
- `pnpm exec playwright test tests/e2e/api-acceptance.spec.ts`: PASS 5/5; suite E2E completa precedente 8/9 per un’aspettativa activity obsoleta, poi caso corretto e mirato verificato.

### Prossimo passo

Eseguire AC-001 in quality con Supabase cloud e secondo dispositivo; i restanti quattro scenari `PARTIAL` restano bloccati da credenziali/runtime/device esterni.

## 2026-08-30 — Capability envelope e progetti multi-team

### Lavoro svolto

- Estesa l’identità persistita degli agenti con avatar, skills, tools e permissions; la chat inoltra al runtime solo il capability envelope autorizzato e la portabilità conserva questi metadati senza provider secrets.
- Aggiunta la migrazione Supabase `00000000000009_agent_capabilities.sql`, con default e vincoli JSON compatibili con i record esistenti.
- Completato il supporto a progetti associati a più team tramite `teamIds`/`project_teams`, validazione tenant-aware e import/export; aggiunta la migrazione RLS `00000000000010_project_team_rls.sql` per impedire relazioni cross-organization.
- Aggiornati UI e test del registry agenti e tenancy.

### Verifiche

- `pnpm verify`: PASS dopo l’incremento multi-team; lint/typecheck 15 package task, test 21 task, build Next 41 route e audit verde.
- `pnpm test:e2e`: PASS dopo l’incremento multi-team, 9 scenari; reset Supabase locale PASS fino alla migration 10.

### Prossimo passo

Ripetere la verifica monorepo/E2E dopo il consolidamento del supporto multi-team, poi mantenere aperte soltanto le verifiche quality esterne già registrate come `PARTIAL`.

## 2026-08-30 — Hardening multi-team e runtime capabilities

### Lavoro svolto

- Reso l’aggiornamento delle associazioni `project_teams` tenant-aware e coerente tra adapter locale e Supabase, con sostituzione controllata dell’insieme di team.
- Aggiunto il test HTTP del runtime che verifica il capability envelope effettivamente serializzato verso il provider.

### Verifiche

- Test runtime: PASS, 4 test.
- Typecheck db/web: PASS.
- Test tenancy: PASS, 2 test.
- Il checkpoint precedente resta coperto da `pnpm verify`, `pnpm test:e2e` 9/9 e reset Supabase locale fino alla migration 10.

### Stato

Repository stabile e riprendibile; restano soltanto i blocker quality esterni già riportati nella matrice acceptance.

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

## 2026-08-30 — Office e pannelli operativi live

### Lavoro svolto

- Sostituiti i placeholder statici di Office, Agents, Meetings, Approvals e Costs con pannelli client che selezionano l'organizzazione e leggono le API tenant-scoped.
- Aggiunte azioni Approve/Reject nell'inbox e visualizzazione deterministica degli agenti nelle aree dell'Office.
- Mantenuti stati di caricamento, empty state ed error state senza introdurre decisioni LLM lato client.

### Verifiche

- `pnpm --filter @bunker-studio/web lint`: PASS.
- `pnpm --filter @bunker-studio/web typecheck`: PASS.
- `pnpm exec playwright test tests/e2e/studio.spec.ts`: PASS, 3 scenari.

### Prossimo passo

Completare Projects, Teams, Settings e Activity con viste client collegate alle rispettive API.

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

## 2026-08-30 — Operational UI and Settings

### Lavoro svolto

- Aggiunti endpoint e adapter tenant-scoped per task/activity e pannelli live per il control plane.
- Projects e Teams ora supportano creazione e modifica dalla UI con organization selector e ruoli API invariati.
- Settings ora mostra runtime configurato, provider e catalogo modelli, worker, capabilities e heartbeat senza restituire segreti.
- Aggiunta copertura route per Settings e aggiornata la build E2E per compilare i package condivisi prima di Playwright.

### Verifiche

- `pnpm verify`: PASS; 21 test task, build Next.js e audit sicurezza verdi.
- `pnpm test:e2e`: PASS; 8/8 scenari.
- `pnpm --filter @bunker-studio/web test`: PASS; 9 test.

### Stato finale della sessione

UI tenancy/operational e task/workflow aggiornati; repository stabile. Prossimo passo: eseguire i cinque scenari quality `PARTIAL` e il backup/restore drill quando saranno disponibili gli accessi esterni.

## 2026-08-30 — Agent registry e notification preferences

### Lavoro svolto

- Aggiunta UI Agents per create/edit/archive tenant-scoped, con provider binding label e credenziali sempre server-side.
- Aggiunta archiviazione reversibile per team e progetti tramite DELETE semantico, con protezione del progetto Studio core e test di isolamento.
- Aggiunte preferenze notifiche per categoria (`APPROVAL`, `SECURITY`, `BUDGET`, `QUOTA`, `WORKFLOW`) con route GET/PATCH, stato locale e persistenza Supabase/RLS.
- Estesa la policy push provider-neutral per rispettare le preferenze categoria quando il dispatcher viene configurato.

### Verifiche

- `pnpm verify`: PASS; format, lint, typecheck, 21 task di test, build Next e audit sicurezza.
- `pnpm test:e2e`: PASS; 8/8 scenari.
- `supabase db reset --local`: PASS; migration `00000000000007_notification_preferences.sql` applicata.

### Stato finale della sessione

Checkpoint stabile nei commit `4e1a5b3`, `65884f7` e `9853717`. Restano i cinque scenari quality `PARTIAL` e il backup/restore drill con accessi esterni.

## 2026-08-30 — Organization portability and persisted review outcomes

### Lavoro svolto

- Aggiunte route tenant-scoped per export/import organizzazione con formato versionato, remap degli ID di organizzazione/task/dipendenze, esclusione dei secret e stato provider `REQUIRES_REAUTH`.
- Aggiunta persistenza conversazioni necessaria alla portabilità chat, sia nello store locale di test sia nell'adapter Supabase.
- Aggiunti endpoint per registrare/listare verifiche di task e report di review, con findings protetti da RLS e fix task creati solo dal risultato deterministico della policy.

### Verifiche

- `pnpm verify`: PASS; format, lint, typecheck, 21 task di test, build Next a 41 route e audit sicurezza.
- `pnpm test:e2e`: PASS; 9/9 scenari.
- `supabase db reset --local`: PASS; migration `00000000000008_review_findings_rls.sql` applicata.
- Test web: 11 file, 17 test passati, inclusi portabilità, verifica e review.

### Stato finale della sessione

Checkpoint stabile nei commit `0ab5f46`, `2de5113`, `322acb2`, `79967bf` e `26b4f76`. Restano le verifiche quality `PARTIAL` dipendenti da Supabase/GitHub/VAPID/provider/multiprocess e il backup/restore drill con accessi esterni.

## 2026-08-30 — Virgin template and verification evidence completion

### Lavoro svolto

- Aggiunto endpoint pubblico di virgin template export con manifest versionato, configurazione supportata e role templates, senza tenant data o secret.
- I verification runs inclusi nei review report vengono ora persistiti insieme al report; gli artifact ID sono validati come UUID coerenti con lo schema Supabase.

### Verifiche

- Test route review e template: PASS.
- `pnpm verify`: PASS; format, lint, typecheck, 21 task di test, build Next a 41 route e audit sicurezza.
- `pnpm test:e2e`: PASS; 9/9 scenari, inclusi review/verifica, portabilità E2E e virgin template.

### Stato finale della sessione

Restano le verifiche quality `PARTIAL` dipendenti da accessi esterni e il backup/restore drill.

## 2026-08-31 — Re-verifica schema Supabase locale

### Verifiche

- `supabase db reset --local`: PASS.
- Migration `00000000000000..00000000000013`, seed e restart dei container locali completati senza errori.

### Stato

- Nessuna variazione sui blocker: AC-001, AC-006, AC-009, AC-011 e AC-013 richiedono rispettivamente quality cloud/device, pg-boss multi-processo, GitHub/CI, VAPID/device e runtime Ollama/LM Studio.

## 2026-08-31 — Adapter pg-boss concreto e worker persistente

### Lavoro svolto

- Aggiunta la dipendenza `pg-boss` e l’adapter di processo che normalizza i job batch v12 nel contratto interno.
- Aggiunto `startPersistentWorker` con polling della coda, dispatch periodico dell’outbox e shutdown ordinato; gli handler restano obbligatori e iniettati.
- Mantenuta la compatibilità dell’orchestrazione con client fake e con client pg-boss che restituiscono un singolo job o una lista.

### Verifiche

- Queue orchestration: 20/20 test PASS.
- Worker: 5/5 test PASS.
- Typecheck e build worker: PASS.

### Stato

- AC-006 e AC-013 restano `PARTIAL` fino al test multi-processo con database quality e allo smoke di un runtime Ollama/LM Studio; non vengono simulati come completati.

## 2026-08-31 — Smoke pg-boss PostgreSQL locale

### Verifiche

- Avviato `pg-boss` v12 contro il PostgreSQL Supabase locale.
- Creazione queue, `send`, `fetch` batch e `complete`: PASS.
- Il controllo ha rilevato e corretto la necessità di creare esplicitamente la queue prima del primo invio.

### Stato

- La prova conferma l’integrazione single-process locale; non sostituisce il test di restart multi-processo su quality richiesto da AC-006.

## 2026-08-31 — Security scan locale

### Verifiche

- Gitleaks Docker: PASS, 38 commit scansionati, nessun leak trovato.
- `pnpm audit --audit-level high`: PASS, nessuna vulnerabilità nota.
- Semgrep auto-scan Docker è stato limitato a `apps`, `packages` e `supabase`, ma non ha raggiunto uno stato terminale utile e non viene conteggiato come PASS.
- `osv-scanner` non è disponibile nell’host.

## 2026-08-31 — Retry pg-boss senza duplicazioni

### Lavoro svolto

- Configurato il queue bootstrap con `retryLimit: 0` per evitare il doppio retry implicito + esplicito.
- Mantenuto il retry esplicito Bunker con operation key derivata dal tentativo e relativa copertura nel contratto orchestration.

### Verifiche

- Queue orchestration: 21/21 test PASS.
- Smoke PostgreSQL locale ripetuto dopo l’inizializzazione queue: PASS.
