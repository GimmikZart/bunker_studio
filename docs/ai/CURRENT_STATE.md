# Current Project State

## Stato sintetico

Bootstrap, fondazioni domain e vertical slices principali sono implementati; il progetto non è ancora alla Definition of Done finale perché la matrice acceptance AC-001..AC-014 non è completamente verificata e alcune integrazioni richiedono credenziali quality.

## Lavoro completato e verificato

- M0: monorepo pnpm/Turborepo, web/worker, package condivisi, strict TypeScript, ESLint, Prettier, Vitest, Playwright, env Zod, Dockerfile, CI, Supabase locale e shell Office responsive.
- M1-M3: tenancy con ruoli/RLS, auth API fail-closed, CRUD organizzazioni/team/progetti/agenti/membri, agent registry, binding-preserving identity, runtime fake/HTTP e adapters OpenAI/Anthropic/OpenAI-compatible.
- M4: state machine task, dependency DAG, parallel scope grouping, lease/reclaim, `DurableQueue`, adapter `PgBossQueue`, outbox dispatcher in-memory e Supabase con claim atomico, workflow runner, budget gate e quota resume.
- M5-M6: Lead/verification/review contracts, workspace/artifact Git, safe parallelism e reviewer fix loop con limite cicli.
- M7-M14 verticali: design submission/owner approval, staffing proposal/confirmation, bounded meetings, bounded memory/search con provenance e delete, PWA/push adapter, worker registry/API, export/import ID remap, AES-256-GCM secrets e protected Studio policy.
- UI/API: login/signup/onboarding, PWA manifest/service worker, design/staffing/memory/worker endpoints e CRUD tenancy.

## Lavoro in corso

Completare la matrice acceptance AC-001..AC-014 con fixture E2E/integration per workflow persistente, quota/budget, design gate, push, export/import, local worker e isolamento multiutente.

## Verifiche

- `pnpm format:check`: PASS.
- `pnpm lint`: PASS, 15 package task.
- `pnpm typecheck`: PASS, 15 package task.
- `pnpm test`: PASS, 21 task Turborepo.
- `pnpm build`: PASS, 15 package task; Next genera 28 route/pagine.
- `pnpm exec playwright test`: PASS, 4 test (health, onboarding, login/signup, PWA).
- `pnpm audit --audit-level high`: PASS, nessuna vulnerabilità nota.
- `supabase db reset --local`: PASS; 45 policy pubbliche e 38 tabelle RLS-enabled verificate sul database locale.

## Problemi aperti

- Provider reali, Supabase cloud, GitHub, VAPID/Web Push e client pg-boss concreto richiedono configurazione/credenziali quality; fake e adapter contract-first sono disponibili.
- Mancano ancora la matrice E2E completa AC-001..AC-014, UI operative per tutti i flussi task/meeting/cost/approval e drill backup/restore quality.
- I check gitleaks/semgrep/osv-scanner non sono installati nell'host; audit pnpm è verde.

## Ultimo aggiornamento

2026-08-30
