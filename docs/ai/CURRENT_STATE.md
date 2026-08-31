# Current Project State

## Stato sintetico

### Checkpoint 2026-08-31

Sono stati completati e verificati gli assegnamenti agenti tenant-scoped (team/progetto/reporting line), il dettaglio agente, metriche deterministiche e la baseline activity append-only. Studio Labs ora dispone di inizializzazione Owner-only del progetto protetto, analisi deterministica, selezione task+approval e gate reviewer/CI/Owner/human con `productionDeploy: false`. Il Lead ora persiste il piano strutturato e materializza il DAG in task DRAFT con dipendenze rimappate, read/write scope, parallel group, workflow link e Definition of Done; gli stessi metadati sono preservati dall'export/import. Il runner esegue batch concorrenti solo su scope disgiunti, serializza scope sovrapposti e usa il resume della sessione quando una quota interrompe un provider dopo l'avvio. Gli adapter HTTP conservano anche gli eventi SSE terminali di solo usage e normalizzano l'usage Anthropic distribuito tra eventi. Le migrazioni Supabase `00000000000012_domain_event_triggers.sql` e `00000000000013_workflow_plan.sql` registrano eventi e metadati del piano.

Bootstrap, fondazioni domain e vertical slices principali sono implementati; il progetto non è ancora alla Definition of Done finale perché la matrice acceptance AC-001..AC-014 non è completamente verificata e alcune integrazioni richiedono credenziali quality.

## Lavoro completato e verificato

- M0: monorepo pnpm/Turborepo, web/worker, package condivisi, strict TypeScript, ESLint, Prettier, Vitest, Playwright, env Zod, Dockerfile, CI, Supabase locale e shell Office responsive.
- M1-M3: tenancy con ruoli/RLS, auth API fail-closed, CRUD organizzazioni/team/progetti/agenti/membri, progetti assegnabili a più team tramite `project_teams`, agent registry, binding-preserving identity, runtime fake/HTTP e adapter OpenAI/Anthropic/OpenAI-compatible con payload/header nativi, SSE e usage normalizzato.
- M4: state machine task, dependency DAG, parallel scope grouping, lease/reclaim, `DurableQueue`, adapter `PgBossQueue` compatibile con pg-boss v12 con retry esplicito deterministico e composition worker persistente, outbox dispatcher in-memory e Supabase con claim atomico, workflow runner concorrente con serializzazione degli scope, budget gate e quota resume con session preservation.
- M5-M6: Lead/verification/review contracts, workspace/artifact Git, safe parallelism, risultati di verifica persistiti, report review tenant-scoped e reviewer fix loop con limite cicli.
- M7-M14 verticali: design submission/owner approval, staffing proposal/confirmation, bounded meetings, bounded memory/search con provenance e delete, PWA/push adapter, worker registry/API, export/import ID remap di task e dipendenze, AES-256-GCM secrets e protected Studio policy.
- M2 capability envelope: avatar statici, skills/tools/permissions persistiti e trasferiti al runtime senza esporre segreti; migrazione compatibile per i record agent esistenti.
- UI/API: login/signup/onboarding, PWA manifest/service worker, CRUD tenancy (including reversible project/team archive), agent registry create/edit/archive, design/staffing/memory/worker, meetings/minutes, approvals, cost ledger/report, notification inbox/subscription/preferences, repository metadata, task verification, review report, Lead workflow-plan endpoint con DAG persistito e virgin template export endpoints.
- Persistenza production: repository Supabase SSR/RLS-aware per tenancy, agenti/provider binding, design gate, memorie, meetings/minutes, approval, cost ledger, notifiche/push, repository metadata e worker registry; lo store globale resta una fixture esclusivamente non-production.
- Hardening release: singleton runtime per route bundle in sviluppo, budget cumulativo sui batch concorrenti, trigger Supabase per profilo e membership Owner, Docker context workspace e runbook quality/production.

## Lavoro in corso

Eseguire in un ambiente quality isolato i cinque scenari ancora `PARTIAL` (PC loss cloud, restart multi-process pg-boss, GitHub/CI protetto, VAPID/device e runtime Ollama/LM Studio) e registrare gli esiti nella matrice.

## Verifiche

- `pnpm format:check`: PASS.
- `pnpm lint`: PASS, 15 package task.
- `pnpm typecheck`: PASS, 15 package task.
- `pnpm test`: PASS, 24 task Turborepo.
- `pnpm build`: PASS, 15 package task; Next genera 45 route/pagine.
- `pnpm exec playwright test`: PASS, 10 test (health, onboarding, login/signup, PWA, tenancy/isolation, design/staffing/memory, worker, operations/review/portability, virgin template, smoke responsive/accessibility).
- `pnpm audit --audit-level high`: PASS, nessuna vulnerabilità nota.
- `supabase db reset --local`: PASS; migrations `00000000000000..00000000000013` applicate, inclusi RLS assignments, trigger domain events e metadati workflow plan.
- Test mirati post-hardening: Lead workflow plan 2/2, AgentRuntime 6/6, Anthropic adapter 2/2, typecheck 15/15: PASS.
- Smoke pg-boss v12 su PostgreSQL Supabase locale (queue init, send/fetch batch, complete): PASS; il restart multi-processo quality resta da eseguire.

## Problemi aperti

- Provider reali, Supabase cloud, GitHub, VAPID/Web Push e pg-boss multi-process quality richiedono configurazione/credenziali; adapter pg-boss concreto, fake e contract test sono disponibili.
- La chat production seleziona un runtime HTTP configurato, usa il binding come modello di fallback e salva conversazioni/messaggi tenant-scoped; il fake runtime resta ammesso solo per fixture locali.
- Office, Agent registry, Meetings, Approvals, Cost Center e Activity hanno pannelli client live con organization selector e stati/errori espliciti; Projects e Teams espongono create/edit/archive tenant-scoped, mentre Settings mostra runtime, provider senza segreti, worker/heartbeat e preferenze notifiche per categoria.
- Mancano ancora le verifiche quality esterne dei criteri `PARTIAL` e il drill backup/restore su un progetto quality; la UI task/workflow supporta create, transizioni controllate e persistenza del piano Lead, mentre l’endpoint di esecuzione resta soggetto ai gate esistenti.
- Security: Gitleaks eseguito in Docker con 38 commit e nessun leak; `pnpm audit --audit-level high` è verde. Semgrep auto-scan in Docker non ha prodotto un risultato terminale entro il run quality e osv-scanner non è disponibile nell'host.

## Ultimo aggiornamento

2026-08-31
