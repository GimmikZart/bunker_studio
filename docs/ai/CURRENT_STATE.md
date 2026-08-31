# Current Project State

## Stato sintetico

### Checkpoint 2026-08-31

Sono stati completati e verificati gli assegnamenti agenti tenant-scoped (team/progetto/reporting line), il dettaglio agente, metriche deterministiche e la baseline activity append-only. Studio Labs ora dispone di inizializzazione Owner-only del progetto protetto, analisi deterministica, selezione task+approval e gate reviewer/CI/Owner/human con `productionDeploy: false`. Il Lead ora persiste il piano strutturato e materializza il DAG in task DRAFT con dipendenze rimappate, read/write scope, parallel group, workflow link e Definition of Done; gli stessi metadati sono preservati dall’export/import. Il runner esegue batch concorrenti solo su scope disgiunti, serializza scope sovrapposti e usa il resume della sessione quando una quota interrompe un provider dopo l’avvio. Gli adapter HTTP conservano anche gli eventi SSE terminali di solo usage e normalizzano l’usage Anthropic distribuito tra eventi. Le migrazioni Supabase `00000000000012_domain_event_triggers.sql` e `00000000000013_workflow_plan.sql` registrano eventi e metadati del piano.

Bootstrap, fondazioni domain e vertical slices principali sono implementati; il progetto non è ancora alla Definition of Done finale perché la matrice acceptance AC-001..AC-014 non è completamente verificata e alcune integrazioni richiedono credenziali quality.

## Lavoro completato e verificato

- M0: monorepo pnpm/Turborepo, web/worker, package condivisi, strict TypeScript, ESLint, Prettier, Vitest, Playwright, env Zod, Dockerfile, CI, Supabase locale e shell Office responsive.
- M1-M3: tenancy con ruoli/RLS, auth API fail-closed, CRUD organizzazioni/team/progetti/agenti/membri, progetti assegnabili a più team tramite `project_teams`, agent registry, binding-preserving identity, runtime fake/HTTP e adapter OpenAI/Anthropic/OpenAI-compatible con payload/header nativi, SSE e usage normalizzato.
- M4: state machine task, dependency DAG, parallel scope grouping, lease/reclaim, `DurableQueue`, adapter `PgBossQueue` compatibile con pg-boss v12 con retry esplicito deterministico e composition worker persistente, outbox dispatcher in-memory e Supabase con claim atomico, workflow runner concorrente con serializzazione degli scope, budget gate e quota resume con session preservation. `WorkerTaskScheduler` assegna in modo deterministico solo a nodi online, compatibili, entro concurrency e con scope autorizzati; il control plane locale aggiunge claim autenticato atomico, lease/reclaim, completion e pull loop verso runtime OpenAI-compatible.
- M5-M6: Lead/verification/review contracts, workspace/artifact Git, safe parallelism, risultati di verifica persistiti, report review tenant-scoped e reviewer fix loop con limite cicli. Il package Git espone ora un adapter GitHub HTTP token-injected per branch, check-run CI e pull request, con errori sanitizzati.
- M7-M14 verticali: design submission/owner approval, staffing proposal/confirmation, bounded meetings, bounded memory/search con provenance e delete, PWA/push adapter, worker registry/API, export/import ID remap di task e dipendenze, AES-256-GCM secrets e protected Studio policy. Le notifiche includono un adapter Web Push VAPID server-only, dispatcher worker con retry/revoca subscription e flusso browser per registrare la subscription nel service worker. Il local worker ora supporta token monouso, scambio server-side per credenziale hashata, client control-plane, heartbeat autenticato tramite RPC Supabase, pull dei task compatibili e completamento con risultato.
- M2 capability envelope: avatar statici, skills/tools/permissions persistiti e trasferiti al runtime senza esporre segreti; migrazione compatibile per i record agent esistenti.
- UI/API: login/signup/onboarding, PWA manifest/service worker, CRUD tenancy (including reversible project/team archive), agent registry create/edit/archive, design/staffing/memory/worker, meetings/minutes, approvals, cost ledger/report, notification inbox/subscription/preferences, repository metadata, task verification, review report, Lead workflow-plan endpoint con DAG persistito e virgin template export endpoints.
- Persistenza production: repository Supabase SSR/RLS-aware per tenancy, agenti/provider binding, design gate, memorie, meetings/minutes, approval, cost ledger, notifiche/push, repository metadata e worker registry; lo store globale resta una fixture esclusivamente non-production.
- Hardening release: singleton runtime per route bundle in sviluppo, budget cumulativo sui batch concorrenti, trigger Supabase per profilo e membership Owner, Docker context workspace, runbook quality/production e dataset demo Supabase locale idempotente.

## Lavoro in corso

Eseguire in un ambiente quality isolato i cinque scenari ancora `PARTIAL` (PC loss cloud, restart multi-process pg-boss, GitHub/CI protetto, VAPID/device e runtime Ollama/LM Studio) e registrare gli esiti nella matrice.

## Verifiche

- `pnpm format:check`: PASS.
- `pnpm lint`: PASS, 15 package task.
- `pnpm typecheck`: PASS, 15 package task.
- `pnpm test`: PASS, 25 task Turborepo.
- `pnpm build`: PASS, 15 package task; Next genera 50 route/pagine.
- `pnpm test:e2e`: PASS, 10 test (health, onboarding, login/signup, PWA, tenancy/isolation, design/staffing/memory, worker, operations/review/portability, virgin template, smoke responsive/accessibility).
- `pnpm audit --audit-level high`: PASS, nessuna vulnerabilità nota.
- `supabase db reset --local`: PASS; migrations `00000000000000..00000000000017` applicate, inclusi RLS assignments, trigger domain events, metadati workflow plan, worker registration RPC, stato delivery push, task claim/lease locali e outbox transazionale per task `QUEUED`.
- Test mirati post-hardening: Lead workflow plan 2/2, AgentRuntime 6/6, Anthropic adapter 2/2, Git 7/7, Notifications 4/4, Worker 10/10, Web routes 25/25, DB worker scheduler 3/3, typecheck 15/15: PASS.
- Smoke SQL local worker: PASS; claim con capability/scope/dependency, capacity gate, completion e reassignment su lease scaduta sono stati verificati su PostgreSQL Supabase locale con rollback finale.
- Smoke SQL outbox: PASS; la transizione `QUEUED` crea un evento `task.run`, gli update non di stato non duplicano eventi e un nuovo passaggio `RUNNING → QUEUED` crea il retry event, con rollback finale.
- Smoke pg-boss v12 su PostgreSQL Supabase locale (queue init, send/fetch batch, complete): PASS; `pnpm quality:pg-boss-restart` verifica anche il recupero dello stesso job con due processi dopo timeout: PASS. Il restart sul database multi-processo quality resta da eseguire.
- Seed Supabase locale: PASS; `supabase db reset --local` carica il dataset demo (1 utente, 1 organizzazione, 3 agenti, 2 task, 1 memoria) senza credential o secret provider.

## Problemi aperti

- Provider reali, Supabase cloud, GitHub, VAPID/Web Push e pg-boss multi-process quality richiedono configurazione/credenziali; gli adapter GitHub, Web Push VAPID, il protocollo token/heartbeat/task pull worker e pg-boss concreto, fake e contract test sono disponibili.
- La chat production seleziona un runtime HTTP configurato, usa il binding come modello di fallback e salva conversazioni/messaggi tenant-scoped; il fake runtime resta ammesso solo per fixture locali.
- Office, Agent registry, Meetings, Approvals, Cost Center e Activity hanno pannelli client live con organization selector e stati/errori espliciti; Projects e Teams espongono create/edit/archive tenant-scoped, mentre Settings mostra runtime, provider senza segreti, worker/heartbeat e preferenze notifiche per categoria.
- Mancano ancora le verifiche quality esterne dei criteri `PARTIAL` e il drill backup/restore su un progetto quality; la UI task/workflow supporta create, transizioni controllate e persistenza del piano Lead, mentre l’endpoint di esecuzione resta soggetto ai gate esistenti.
- Security: Gitleaks eseguito in Docker con 41 commit e nessun leak; `pnpm audit --audit-level high` è verde. Semgrep ruleset JavaScript in Docker non ha prodotto un risultato terminale utile entro la finestra quality e osv-scanner non è disponibile nell'host.

## Ultimo aggiornamento

2026-08-31
