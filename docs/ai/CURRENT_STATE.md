# Current Project State

## Stato sintetico

Bootstrap, fondazioni domain e vertical slices principali sono implementati; il progetto non è ancora alla Definition of Done finale perché la matrice acceptance AC-001..AC-014 non è completamente verificata e alcune integrazioni richiedono credenziali quality.

## Lavoro completato e verificato

- M0: monorepo pnpm/Turborepo, web/worker, package condivisi, strict TypeScript, ESLint, Prettier, Vitest, Playwright, env Zod, Dockerfile, CI, Supabase locale e shell Office responsive.
- M1-M3: tenancy con ruoli/RLS, auth API fail-closed, CRUD organizzazioni/team/progetti/agenti/membri, agent registry, binding-preserving identity, runtime fake/HTTP e adapters OpenAI/Anthropic/OpenAI-compatible.
- M4: state machine task, dependency DAG, parallel scope grouping, lease/reclaim, `DurableQueue`, adapter `PgBossQueue`, outbox dispatcher in-memory e Supabase con claim atomico, workflow runner, budget gate e quota resume.
- M5-M6: Lead/verification/review contracts, workspace/artifact Git, safe parallelism e reviewer fix loop con limite cicli.
- M7-M14 verticali: design submission/owner approval, staffing proposal/confirmation, bounded meetings, bounded memory/search con provenance e delete, PWA/push adapter, worker registry/API, export/import ID remap, AES-256-GCM secrets e protected Studio policy.
- UI/API: login/signup/onboarding, PWA manifest/service worker, CRUD tenancy, design/staffing/memory/worker, meetings/minutes, approvals, cost ledger/report, notification inbox/subscription e repository metadata endpoints.
- Persistenza production: repository Supabase SSR/RLS-aware per tenancy, agenti/provider binding, design gate, memorie, meetings/minutes, approval, cost ledger, notifiche/push, repository metadata e worker registry; lo store globale resta una fixture esclusivamente non-production.
- Hardening release: singleton runtime per route bundle in sviluppo, budget cumulativo sui batch concorrenti, trigger Supabase per profilo e membership Owner, Docker context workspace e runbook quality/production.

## Lavoro in corso

Eseguire in un ambiente quality isolato i cinque scenari ancora `PARTIAL` (PC loss cloud, restart multi-process pg-boss, GitHub/CI protetto, VAPID/device e runtime Ollama/LM Studio) e registrare gli esiti nella matrice.

## Verifiche

- `pnpm format:check`: PASS.
- `pnpm lint`: PASS, 15 package task.
- `pnpm typecheck`: PASS, 15 package task.
- `pnpm test`: PASS, 21 task Turborepo.
- `pnpm build`: PASS, 15 package task; Next genera 37 route/pagine.
- `pnpm exec playwright test`: PASS, 8 test (health, onboarding, login/signup, PWA, tenancy/isolation, design/staffing/memory, worker, operations).
- `pnpm audit --audit-level high`: PASS, nessuna vulnerabilità nota.
- `supabase db reset --local`: PASS; 45 policy pubbliche e 38 tabelle RLS-enabled verificate sul database locale.

## Problemi aperti

- Provider reali, Supabase cloud, GitHub, VAPID/Web Push e client pg-boss concreto richiedono configurazione/credenziali quality; fake e adapter contract-first sono disponibili.
- La chat production seleziona un runtime HTTP configurato, usa il binding come modello di fallback e salva conversazioni/messaggi tenant-scoped; il fake runtime resta ammesso solo per fixture locali.
- Office, Agent registry, Meetings, Approvals, Cost Center e Activity hanno pannelli client live con organization selector e stati/errori espliciti; Projects e Teams espongono create/edit tenant-scoped, mentre Settings mostra runtime, provider senza segreti e worker/heartbeat.
- Mancano ancora le verifiche quality esterne dei criteri `PARTIAL` e il drill backup/restore su un progetto quality; la UI task/workflow ora supporta create e transizioni controllate.
- I check gitleaks/semgrep/osv-scanner non sono installati nell'host; audit pnpm è verde.

## Ultimo aggiornamento

2026-08-30
